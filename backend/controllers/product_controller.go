// controllers/product_controller.go
package controllers

import (
	"bytes"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/derry/anggijajan-v2-backend/database"
	"github.com/derry/anggijajan-v2-backend/models"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	apiGamesSyncMutex sync.Mutex

	ErrApiGamesSyncInProgress = errors.New("sinkronisasi ApiGames sedang berjalan")
	digiflazzPriceListURL     = "https://api.digiflazz.com/v1/price-list"
	digiflazzHTTPClient       = &http.Client{Timeout: 30 * time.Second}

	apiGamesPriceListBaseURL = "https://v1.apigames.id/v2/pricelist"
	apiGamesHTTPClient       = &http.Client{Timeout: 30 * time.Second}
)

type apiGamesProductSnapshot struct {
	SKU, Brand, Name, CatalogCardCode string
	IsActive                          bool
}

// 1. GET ALL PRODUCTS
var (
	errProviderProductStillPresent = errors.New("produk masih tercatat di provider")
	errProviderProductHasHistory   = errors.New("produk memiliki riwayat transaksi")
)

func validateProviderProductPermanentDelete(providerRemoved bool, transactionCount int64) error {
	if !providerRemoved {
		return errProviderProductStillPresent
	}
	if transactionCount > 0 {
		return errProviderProductHasHistory
	}
	return nil
}

func DeleteProviderRemovedProduct(c *fiber.Ctx) error {
	productID, err := c.ParamsInt("id")
	if err != nil || productID <= 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ID produk tidak valid."})
	}

	err = database.DB.Transaction(func(tx *gorm.DB) error {
		var product models.Product
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&product, uint(productID)).Error; err != nil {
			return err
		}

		var transactionCount int64
		if err := tx.Model(&models.Transaction{}).Where("product_id = ?", product.ID).Count(&transactionCount).Error; err != nil {
			return err
		}
		if err := validateProviderProductPermanentDelete(product.ProviderRemoved, transactionCount); err != nil {
			return err
		}

		result := tx.Unscoped().Delete(&product)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return gorm.ErrRecordNotFound
		}
		return nil
	})

	switch {
	case errors.Is(err, gorm.ErrRecordNotFound):
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Produk tidak ditemukan."})
	case errors.Is(err, errProviderProductStillPresent):
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Produk masih tercatat di provider dan tidak dapat dihapus permanen."})
	case errors.Is(err, errProviderProductHasHistory):
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Produk memiliki riwayat transaksi dan tidak dapat dihapus permanen."})
	case err != nil:
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Produk masih direferensikan data lain atau gagal dihapus permanen."})
	default:
		return c.JSON(fiber.Map{"message": "Produk berhasil dihapus permanen.", "id": productID})
	}
}

func GetProducts(c *fiber.Ctx) error {
	var products []models.Product
	if err := database.DB.
		Preload("Catalog").
		Preload("ProductGroup").
		Order("id desc").
		Find(&products).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal ambil data produk"})
	}
	for productIndex := range products {
		product := &products[productIndex]
		var groupMarkup *float64
		if product.ProductGroup != nil {
			groupMarkup = product.ProductGroup.MarkupPercent
		}
		product.ApplyStorefrontPricing(product.Catalog.MarkupPercent, groupMarkup)
	}
	var latestProduct models.Product
	database.DB.Order("updated_at desc").First(&latestProduct)
	return c.JSON(fiber.Map{"products": products, "last_update": latestProduct.UpdatedAt})
}

// 2. HANDLER SYNC (SEKARANG PUNYA RADAR)
func SyncAllProducts(c *fiber.Ctx) error {
	provider := c.Params("provider")

	if provider == "all" {
		t1, a1, unmapped1, e1 := RunDigiflazzSync("manual")
		if errors.Is(e1, ErrDigiflazzSyncInProgress) || errors.Is(e1, ErrDigiflazzSyncCooldown) {
			return digiflazzSyncRejectionResponse(c, e1)
		}
		if e1 != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":   "Gagal Sync digiflazz",
				"message": e1.Error(),
			})
		}
		t2, a2, unmapped2, e2 := RunApiGamesSync()

		return c.JSON(fiber.Map{
			"message": "Proses Sinkronisasi Selesai",
			"details": fiber.Map{
				"digiflazz": fiber.Map{"success": e1 == nil, "total": t1, "active": a1, "butuh_katalog_baru": unmapped1, "error": fmt.Sprintf("%v", e1)},
				"apigames":  fiber.Map{"success": e2 == nil, "total": t2, "active": a2, "butuh_katalog_baru": unmapped2, "error": fmt.Sprintf("%v", e2)},
			},
		})
	}

	var total, active int
	var unmapped []string
	var err error

	switch provider {
	case "digiflazz":
		total, active, unmapped, err = RunDigiflazzSync("manual")
	case "apigames":
		total, active, unmapped, err = RunApiGamesSync()
	default:
		return c.Status(400).JSON(fiber.Map{"error": "Provider tidak dikenal"})
	}

	if err != nil {
		if errors.Is(err, ErrDigiflazzSyncInProgress) || errors.Is(err, ErrDigiflazzSyncCooldown) {
			return digiflazzSyncRejectionResponse(c, err)
		}

		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Gagal Sync " + provider,
			"message": err.Error(),
		})
	}

	// Nah, di response API ini bakal muncul nama-nama game yang belum lu bikin katalognya!
	return c.JSON(fiber.Map{
		"message":            "Sync " + provider + " Berhasil",
		"total_masuk":        total,
		"total_aktif":        active,
		"butuh_katalog_baru": unmapped,
	})
}

// 3. MESIN DIGIFLAZZ (DENGAN RADAR GAME BARU)
type DigiflazzSyncProgressReporter func(stage string, processed, total int)

type digiflazzPriceListEnvelope struct {
	Data    json.RawMessage `json:"data"`
	Message string          `json:"message"`
	RC      json.RawMessage `json:"rc"`
}

type digiflazzProviderError struct {
	Message string          `json:"message"`
	RC      json.RawMessage `json:"rc"`
}

func digiflazzPriceListSignature(username, apiKey string) string {
	digest := md5.Sum([]byte(username + apiKey + "pricelist"))
	return hex.EncodeToString(digest[:])
}

func digiflazzResponseCode(raw json.RawMessage) string {
	if len(raw) == 0 || string(raw) == "null" {
		return ""
	}

	var text string
	if err := json.Unmarshal(raw, &text); err == nil {
		return strings.TrimSpace(text)
	}

	return strings.Trim(strings.TrimSpace(string(raw)), `"`)
}

func decodeDigiflazzPriceList(body io.Reader) ([]map[string]interface{}, error) {
	var envelope digiflazzPriceListEnvelope
	if err := json.NewDecoder(body).Decode(&envelope); err != nil {
		return nil, fmt.Errorf("response Digiflazz tidak valid: %w", err)
	}

	var products []map[string]interface{}
	if err := json.Unmarshal(envelope.Data, &products); err == nil {
		if len(products) == 0 {
			return nil, fmt.Errorf("Digiflazz mengembalikan daftar harga kosong")
		}
		return products, nil
	}

	providerError := digiflazzProviderError{
		Message: strings.TrimSpace(envelope.Message),
		RC:      envelope.RC,
	}
	if len(envelope.Data) > 0 && string(envelope.Data) != "null" {
		var dataError digiflazzProviderError
		if err := json.Unmarshal(envelope.Data, &dataError); err == nil {
			if message := strings.TrimSpace(dataError.Message); message != "" {
				providerError.Message = message
			}
			if len(dataError.RC) > 0 {
				providerError.RC = dataError.RC
			}
		}
	}

	responseCode := digiflazzResponseCode(providerError.RC)
	if providerError.Message != "" {
		if responseCode != "" {
			return nil, fmt.Errorf(
				"Digiflazz menolak price list (RC %s): %s",
				responseCode,
				providerError.Message,
			)
		}
		return nil, fmt.Errorf("Digiflazz menolak price list: %s", providerError.Message)
	}

	return nil, fmt.Errorf("format data price list Digiflazz tidak dikenali")
}

type digiflazzPriceListProduct struct {
	BuyerSKUCode        string  `json:"buyer_sku_code"`
	Brand               string  `json:"brand"`
	ProductName         string  `json:"product_name"`
	Price               float64 `json:"price"`
	BuyerProductStatus  bool    `json:"buyer_product_status"`
	SellerProductStatus bool    `json:"seller_product_status"`
	UnlimitedStock      bool    `json:"unlimited_stock"`
	Stock               int     `json:"stock"`
}

type digiflazzProductSnapshot struct {
	SKU             string
	Brand           string
	Name            string
	CatalogCardCode string
	Price           float64
	Stock           int
	IsActive        bool
}

type digiflazzSyncAction uint8

const (
	digiflazzSyncSkip digiflazzSyncAction = iota
	digiflazzSyncPending
	digiflazzSyncCreate
	digiflazzSyncUpdate
)

type digiflazzSyncPlan struct {
	Action  digiflazzSyncAction
	Pending *models.PendingProduct
	Create  *models.Product
	Updates map[string]interface{}
}

func buildDigiflazzPriceListSignature(username string, apiKey string) string {
	return GenerateMD5(username + apiKey + "pricelist")
}

func parseDigiflazzProduct(product digiflazzPriceListProduct) (digiflazzProductSnapshot, bool) {
	sku := strings.TrimSpace(product.BuyerSKUCode)
	if sku == "" {
		return digiflazzProductSnapshot{}, false
	}

	stock := product.Stock
	if product.UnlimitedStock {
		stock = -1
	}

	brand := strings.TrimSpace(product.Brand)
	return digiflazzProductSnapshot{
		SKU:             sku,
		Brand:           brand,
		Name:            strings.TrimSpace(product.ProductName),
		CatalogCardCode: strings.TrimSpace(GenerateSmartCode(brand)),
		Price:           product.Price,
		Stock:           stock,
		IsActive:        product.BuyerProductStatus && product.SellerProductStatus,
	}, true
}

func planDigiflazzProduct(
	snapshot digiflazzProductSnapshot,
	validCatalogs map[string]bool,
	existing *models.Product,
) digiflazzSyncPlan {
	providerLastSeenAt := time.Now().UTC()

	if existing != nil {
		if existing.DeletedAt.Valid {
			return digiflazzSyncPlan{Action: digiflazzSyncSkip}
		}

		// Existing products may have been manually mapped by admin. Provider sync
		// only refreshes provider-owned fields and never detaches product grouping.
		return digiflazzSyncPlan{
			Action: digiflazzSyncUpdate,
			Updates: map[string]interface{}{
				"name":                  snapshot.Name,
				"price":                 snapshot.Price,
				"stock":                 snapshot.Stock,
				"is_active":             snapshot.IsActive,
				"provider":              "digiflazz",
				"provider_removed":      false,
				"provider_last_seen_at": providerLastSeenAt,
			},
		}
	}

	if snapshot.CatalogCardCode == "" || !validCatalogs[snapshot.CatalogCardCode] {
		return digiflazzSyncPlan{
			Action: digiflazzSyncPending,
			Pending: &models.PendingProduct{
				RawSKU:   snapshot.SKU,
				RawBrand: snapshot.Brand,
				RawName:  snapshot.Name,
				Provider: "digiflazz",
				Status:   "pending",
			},
		}
	}

	return digiflazzSyncPlan{
		Action: digiflazzSyncCreate,
		Create: &models.Product{
			Name:               snapshot.Name,
			Code:               snapshot.SKU,
			Price:              snapshot.Price,
			Stock:              snapshot.Stock,
			IsActive:           snapshot.IsActive,
			Provider:           "digiflazz",
			ProviderRemoved:    false,
			ProviderLastSeenAt: &providerLastSeenAt,
			CatalogCardCode:    snapshot.CatalogCardCode,
		},
	}
}

func upsertPendingProviderProduct(tx *gorm.DB, pending models.PendingProduct) (bool, error) {
	pending.RawSKU = strings.TrimSpace(pending.RawSKU)
	pending.Provider = strings.ToLower(strings.TrimSpace(pending.Provider))
	if pending.RawSKU == "" || pending.Provider == "" {
		return false, fmt.Errorf("provider dan SKU pending wajib diisi")
	}

	var stored models.PendingProduct
	err := tx.
		Where(
			"LOWER(BTRIM(provider)) = ? AND LOWER(BTRIM(raw_sku)) = ?",
			pending.Provider,
			strings.ToLower(pending.RawSKU),
		).
		First(&stored).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return true, tx.Create(&pending).Error
	}
	if err != nil {
		return false, err
	}

	err = tx.Model(&stored).Updates(map[string]interface{}{
		"raw_brand": pending.RawBrand,
		"raw_name":  pending.RawName,
		"status":    "pending",
	}).Error
	return false, err
}

func fetchDigiflazzSnapshot(
	client *http.Client,
	endpoint string,
	username string,
	apiKey string,
) ([]digiflazzPriceListProduct, error) {
	payload := struct {
		Command  string `json:"cmd"`
		Username string `json:"username"`
		Sign     string `json:"sign"`
	}{
		Command:  "prepaid",
		Username: username,
		Sign:     buildDigiflazzPriceListSignature(username, apiKey),
	}

	encodedPayload, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("gagal membentuk request Digiflazz: %w", err)
	}

	request, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(encodedPayload))
	if err != nil {
		return nil, fmt.Errorf("gagal membuat request Digiflazz: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")

	response, err := client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("gagal menghubungi Digiflazz: %w", err)
	}
	defer response.Body.Close()

	body, err := io.ReadAll(io.LimitReader(response.Body, 8<<20))
	if err != nil {
		return nil, fmt.Errorf("gagal membaca response Digiflazz: %w", err)
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("Digiflazz mengembalikan HTTP %d", response.StatusCode)
	}

	var envelope struct {
		Data json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(body, &envelope); err != nil {
		return nil, fmt.Errorf("response Digiflazz tidak valid: %w", err)
	}
	if len(envelope.Data) == 0 || string(envelope.Data) == "null" {
		return nil, fmt.Errorf("response Digiflazz tidak memiliki data pricelist")
	}

	var products []digiflazzPriceListProduct
	if err := json.Unmarshal(envelope.Data, &products); err != nil {
		var providerError struct {
			RC      string `json:"rc"`
			Message string `json:"message"`
		}
		if objectErr := json.Unmarshal(envelope.Data, &providerError); objectErr == nil &&
			(strings.TrimSpace(providerError.RC) != "" || strings.TrimSpace(providerError.Message) != "") {
			return nil, fmt.Errorf(
				"Digiflazz menolak pricelist (rc=%s): %s",
				strings.TrimSpace(providerError.RC),
				strings.TrimSpace(providerError.Message),
			)
		}
		return nil, fmt.Errorf("format data pricelist Digiflazz tidak valid: %w", err)
	}

	if len(products) == 0 {
		return nil, fmt.Errorf("snapshot pricelist Digiflazz kosong; inventory tidak diubah")
	}

	validSKUCount := 0
	for _, product := range products {
		if strings.TrimSpace(product.BuyerSKUCode) != "" {
			validSKUCount++
		}
	}
	if validSKUCount == 0 {
		return nil, fmt.Errorf("snapshot pricelist Digiflazz tidak memiliki SKU valid; inventory tidak diubah")
	}

	return products, nil
}

func missingDigiflazzProductUpdates() map[string]interface{} {
	return map[string]interface{}{
		"is_active":        false,
		"stock":            0,
		"provider_removed": true,
	}
}

func syncDigiflazzSnapshot(
	db *gorm.DB,
	products []digiflazzPriceListProduct,
) (int, int, []string, error) {
	if len(products) == 0 {
		return 0, 0, nil, fmt.Errorf("snapshot pricelist Digiflazz kosong; inventory tidak diubah")
	}

	uniqueProducts := make([]digiflazzPriceListProduct, 0, len(products))
	normalizedSKUs := make([]string, 0, len(products))
	seenSKUs := make(map[string]struct{}, len(products))
	for _, product := range products {
		normalizedSKU := strings.ToLower(strings.TrimSpace(product.BuyerSKUCode))
		if normalizedSKU == "" {
			continue
		}
		if _, duplicate := seenSKUs[normalizedSKU]; duplicate {
			continue
		}
		seenSKUs[normalizedSKU] = struct{}{}
		uniqueProducts = append(uniqueProducts, product)
		normalizedSKUs = append(normalizedSKUs, normalizedSKU)
	}
	if len(uniqueProducts) == 0 {
		return 0, 0, nil, fmt.Errorf("snapshot pricelist Digiflazz tidak memiliki SKU unik yang valid; inventory tidak diubah")
	}

	count, activeCount := 0, 0
	existingUpdated, pendingCreated, missingCount := 0, 0, int64(0)
	providerOnline, providerOffline := 0, 0
	unmappedMap := make(map[string]bool)

	err := db.Transaction(func(tx *gorm.DB) error {
		var existingProviderCount int64
		if err := tx.Model(&models.Product{}).
			Where("LOWER(BTRIM(provider)) = ?", "digiflazz").
			Where("UPPER(COALESCE(name, '')) NOT LIKE ?", "%TEST%").
			Where("UPPER(COALESCE(code, '')) NOT LIKE ?", "%TEST%").
			Count(&existingProviderCount).Error; err != nil {
			return err
		}
		if existingProviderCount >= 20 && int64(len(uniqueProducts))*4 < existingProviderCount {
			return fmt.Errorf(
				"snapshot pricelist Digiflazz tidak masuk akal: %d SKU unik untuk %d produk existing; inventory tidak diubah",
				len(uniqueProducts),
				existingProviderCount,
			)
		}

		var catalogs []models.Catalog
		if err := tx.Select("card_code").Find(&catalogs).Error; err != nil {
			return err
		}

		validCatalogs := make(map[string]bool, len(catalogs))
		for _, catalog := range catalogs {
			code := strings.TrimSpace(catalog.CardCode)
			if code != "" {
				validCatalogs[code] = true
			}
		}

		// Hanya SKU yang benar-benar tidak ada di snapshot valid yang ditandai
		// removed. Produk yang hadir namun offline akan diperbarui di loop bawah.
		missingResult := tx.Model(&models.Product{}).
			Where("LOWER(BTRIM(provider)) = ?", "digiflazz").
			Where("UPPER(COALESCE(name, '')) NOT LIKE ?", "%TEST%").
			Where("UPPER(COALESCE(code, '')) NOT LIKE ?", "%TEST%").
			Where("LOWER(BTRIM(code)) NOT IN ?", normalizedSKUs).
			Updates(missingDigiflazzProductUpdates())
		if missingResult.Error != nil {
			return missingResult.Error
		}
		missingCount = missingResult.RowsAffected

		if err := tx.Model(&models.Product{}).
			Where("LOWER(BTRIM(provider)) = ?", "digiflazz").
			Where("(UPPER(COALESCE(name, '')) LIKE ? OR UPPER(COALESCE(code, '')) LIKE ?)", "%TEST%", "%TEST%").
			Updates(map[string]interface{}{
				"is_active":        true,
				"stock":            -1,
				"provider_removed": false,
			}).Error; err != nil {
			return err
		}

		for _, providerProduct := range uniqueProducts {
			snapshot, valid := parseDigiflazzProduct(providerProduct)
			if !valid {
				continue
			}

			var existing models.Product
			errFind := tx.Unscoped().
				Where("LOWER(BTRIM(code)) = LOWER(BTRIM(?))", snapshot.SKU).
				First(&existing).Error
			var existingPtr *models.Product
			switch {
			case errors.Is(errFind, gorm.ErrRecordNotFound):
				existingPtr = nil
			case errFind != nil:
				return errFind
			default:
				existingPtr = &existing
			}

			plan := planDigiflazzProduct(snapshot, validCatalogs, existingPtr)
			if snapshot.IsActive {
				providerOnline++
			} else {
				providerOffline++
			}
			switch plan.Action {
			case digiflazzSyncPending:
				if plan.Pending == nil {
					return fmt.Errorf("Digiflazz pending plan tidak valid untuk SKU %s", snapshot.SKU)
				}
				created, err := upsertPendingProviderProduct(tx, *plan.Pending)
				if err != nil {
					return err
				}
				if created {
					pendingCreated++
				}
				label := snapshot.Brand
				if label == "" {
					label = snapshot.CatalogCardCode
				}
				if label != "" {
					unmappedMap[label] = true
				}
				continue
			case digiflazzSyncCreate:
				if plan.Create == nil {
					return fmt.Errorf("Digiflazz create plan tidak valid untuk SKU %s", snapshot.SKU)
				}
				if err := tx.Create(plan.Create).Error; err != nil {
					return err
				}
			case digiflazzSyncUpdate:
				if err := tx.Model(&existing).Updates(plan.Updates).Error; err != nil {
					return err
				}
				existingUpdated++
			case digiflazzSyncSkip:
				continue
			default:
				return fmt.Errorf("Digiflazz sync plan tidak dikenal untuk SKU %s", snapshot.SKU)
			}

			count++
			if snapshot.IsActive {
				activeCount++
			}
		}

		return nil
	})

	unmappedBrands := make([]string, 0, len(unmappedMap))
	for brand := range unmappedMap {
		unmappedBrands = append(unmappedBrands, brand)
	}
	sort.Strings(unmappedBrands)
	if err == nil {
		log.Printf(
			"[SYNC][DIGIFLAZZ] snapshot=%d sku_unik=%d existing_diperbarui=%d pending_baru=%d hilang=%d online=%d offline=%d",
			len(products),
			len(uniqueProducts),
			existingUpdated,
			pendingCreated,
			missingCount,
			providerOnline,
			providerOffline,
		)
	}

	return count, activeCount, unmappedBrands, err
}

func RunDigiflazzSync(source string) (int, int, []string, error) {
	return runDigiflazzSync(source, nil)
}

func RunDigiflazzSyncWithProgress(
	source string,
	reportProgress DigiflazzSyncProgressReporter,
) (int, int, []string, error) {
	return runDigiflazzSync(source, reportProgress)
}

func runDigiflazzSync(
	source string,
	reportProgress DigiflazzSyncProgressReporter,
) (int, int, []string, error) {
	lease, err := digiflazzCoordinator.Start(source)
	if err != nil {
		return 0, 0, nil, err
	}
	return runDigiflazzSyncWithLease(lease, reportProgress)
}

func runDigiflazzSyncWithLease(
	lease *digiflazzSyncLease,
	reportProgress DigiflazzSyncProgressReporter,
) (total int, active int, unmapped []string, syncErr error) {
	providerRequestSent := false
	defer func() {
		if recovered := recover(); recovered != nil {
			panicErr := fmt.Errorf("proses sync Digiflazz panic: %v", recovered)
			_ = digiflazzCoordinator.Finish(lease, panicErr, providerRequestSent)
			panic(recovered)
		}
		if finishErr := digiflazzCoordinator.Finish(lease, syncErr, providerRequestSent); finishErr != nil && syncErr == nil {
			syncErr = finishErr
		}
	}()

	if reportProgress != nil {
		reportProgress("fetching_price_list", 0, 0)
	}

	username := strings.TrimSpace(os.Getenv("DIGIFLAZZ_USERNAME"))
	apiKey := strings.TrimSpace(os.Getenv("DIGIFLAZZ_API_KEY"))
	if username == "" || apiKey == "" {
		return 0, 0, nil, fmt.Errorf("credential Digiflazz belum lengkap")
	}

	providerRequestSent = true
	products, err := fetchDigiflazzSnapshot(
		digiflazzHTTPClient,
		digiflazzPriceListURL,
		username,
		apiKey,
	)
	if err != nil {
		return 0, 0, nil, err
	}
	if reportProgress != nil {
		reportProgress("validating_snapshot", 0, len(products))
		reportProgress("updating_products", 0, len(products))
	}

	total, active, unmapped, syncErr = syncDigiflazzSnapshot(database.DB, products)
	if reportProgress != nil && syncErr == nil {
		reportProgress("finalizing", len(products), len(products))
	}
	return total, active, unmapped, syncErr
}

// 4. MESIN APIGAMES (Biar nggak error undefined saat direturn)
func parseApiGamesProduct(providerProduct map[string]interface{}) (apiGamesProductSnapshot, bool) {
	sku, _ := providerProduct["product_id"].(string)
	sku = strings.TrimSpace(sku)
	if sku == "" {
		return apiGamesProductSnapshot{}, false
	}

	brand, _ := providerProduct["brand"].(string)
	brand = strings.TrimSpace(brand)
	name, _ := providerProduct["product_name"].(string)
	status, _ := providerProduct["status"].(string)

	return apiGamesProductSnapshot{
		SKU:             sku,
		Brand:           brand,
		Name:            strings.TrimSpace(name),
		CatalogCardCode: strings.TrimSpace(GenerateSmartCode(brand)),
		IsActive:        strings.EqualFold(strings.TrimSpace(status), "tersedia"),
	}, true
}

type apiGamesSyncAction uint8

const (
	apiGamesSyncSkip apiGamesSyncAction = iota
	apiGamesSyncPending
	apiGamesSyncCreate
	apiGamesSyncUpdate
)

type apiGamesSyncPlan struct {
	Action  apiGamesSyncAction
	Pending *models.PendingProduct
	Create  *models.Product
	Updates map[string]interface{}
}

func planApiGamesProduct(
	snapshot apiGamesProductSnapshot,
	validCatalogs map[string]bool,
	existing *models.Product,
) apiGamesSyncPlan {
	if snapshot.CatalogCardCode == "" || !validCatalogs[snapshot.CatalogCardCode] {
		return apiGamesSyncPlan{
			Action: apiGamesSyncPending,
			Pending: &models.PendingProduct{
				RawSKU:   snapshot.SKU,
				RawBrand: snapshot.Brand,
				RawName:  snapshot.Name,
				Provider: "apigames",
				Status:   "pending",
			},
		}
	}

	if existing == nil {
		return apiGamesSyncPlan{
			Action: apiGamesSyncCreate,
			Create: &models.Product{
				Name:            snapshot.Name,
				Code:            snapshot.SKU,
				Price:           0,
				IsActive:        snapshot.IsActive,
				Provider:        "apigames",
				CatalogCardCode: snapshot.CatalogCardCode,
			},
		}
	}

	if existing.DeletedAt.Valid {
		return apiGamesSyncPlan{Action: apiGamesSyncSkip}
	}

	updates := map[string]interface{}{
		"name":      snapshot.Name,
		"is_active": snapshot.IsActive,
	}
	if existing.CatalogCardCode != snapshot.CatalogCardCode {
		updates["catalog_cardcode"] = snapshot.CatalogCardCode
		updates["product_group_id"] = nil
		updates["sort_order"] = 0
	}

	return apiGamesSyncPlan{Action: apiGamesSyncUpdate, Updates: updates}
}

func upsertPendingApiGamesProduct(tx *gorm.DB, pending models.PendingProduct) error {
	stored := models.PendingProduct{}
	return tx.
		Where("provider = ? AND raw_sku = ?", pending.Provider, pending.RawSKU).
		Assign(map[string]interface{}{
			"raw_brand": pending.RawBrand,
			"raw_name":  pending.RawName,
			"status":    "pending",
		}).
		FirstOrCreate(&stored, pending).Error
}

func syncApiGamesSnapshot(db *gorm.DB, data []map[string]interface{}) (int, int, []string, error) {
	count, activeCount := 0, 0
	unmappedMap := make(map[string]bool)

	err := db.Transaction(func(tx *gorm.DB) error {
		var catalogs []models.Catalog
		if err := tx.Select("card_code").Find(&catalogs).Error; err != nil {
			return err
		}

		validCatalogs := make(map[string]bool, len(catalogs))
		for _, catalog := range catalogs {
			cardCode := strings.TrimSpace(catalog.CardCode)
			if cardCode != "" {
				validCatalogs[cardCode] = true
			}
		}

		for _, providerProduct := range data {
			snapshot, valid := parseApiGamesProduct(providerProduct)
			if !valid {
				continue
			}

			if snapshot.CatalogCardCode == "" || !validCatalogs[snapshot.CatalogCardCode] {
				plan := planApiGamesProduct(snapshot, validCatalogs, nil)
				if plan.Pending == nil {
					return fmt.Errorf("ApiGames pending plan tidak valid untuk SKU %s", snapshot.SKU)
				}
				if err := upsertPendingApiGamesProduct(tx, *plan.Pending); err != nil {
					return err
				}

				unmappedLabel := snapshot.Brand
				if unmappedLabel == "" {
					unmappedLabel = snapshot.CatalogCardCode
				}
				if unmappedLabel != "" {
					unmappedMap[unmappedLabel] = true
				}

				// Existing Product is intentionally not queried or mutated here.
				continue
			}

			var existing models.Product
			errFind := tx.Unscoped().Where("code = ?", snapshot.SKU).First(&existing).Error
			var existingPtr *models.Product
			switch {
			case errors.Is(errFind, gorm.ErrRecordNotFound):
				existingPtr = nil
			case errFind != nil:
				return errFind
			default:
				existingPtr = &existing
			}

			plan := planApiGamesProduct(snapshot, validCatalogs, existingPtr)
			switch plan.Action {
			case apiGamesSyncCreate:
				if plan.Create == nil {
					return fmt.Errorf("ApiGames create plan tidak valid untuk SKU %s", snapshot.SKU)
				}
				if err := tx.Create(plan.Create).Error; err != nil {
					return err
				}
			case apiGamesSyncUpdate:
				if err := tx.Model(&existing).Updates(plan.Updates).Error; err != nil {
					return err
				}
			case apiGamesSyncSkip:
				continue
			default:
				return fmt.Errorf("ApiGames sync plan tidak dikenal untuk SKU %s", snapshot.SKU)
			}

			count++
			if snapshot.IsActive {
				activeCount++
			}
		}

		return nil
	})

	unmappedBrands := make([]string, 0, len(unmappedMap))
	for brand := range unmappedMap {
		unmappedBrands = append(unmappedBrands, brand)
	}
	sort.Strings(unmappedBrands)

	return count, activeCount, unmappedBrands, err
}

func fetchApiGamesSnapshot(
	client *http.Client,
	baseURL string,
	merchantID string,
	secretKey string,
) ([]map[string]interface{}, error) {
	signature := GenerateMD5(merchantID + secretKey)
	endpoint, err := url.Parse(baseURL)
	if err != nil {
		return nil, fmt.Errorf("URL ApiGames tidak valid: %w", err)
	}

	query := endpoint.Query()
	query.Set("merchant", merchantID)
	query.Set("signature", signature)
	endpoint.RawQuery = query.Encode()

	request, err := http.NewRequest(http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("gagal membuat request ApiGames: %w", err)
	}

	response, err := client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("gagal menghubungi ApiGames: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("ApiGames mengembalikan HTTP %d", response.StatusCode)
	}

	var result struct {
		Data []map[string]interface{} `json:"data"`
	}
	if err := json.NewDecoder(response.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("response ApiGames tidak valid: %w", err)
	}

	return result.Data, nil
}

// 4. MESIN APIGAMES
func RunApiGamesSync() (int, int, []string, error) {
	if !apiGamesSyncMutex.TryLock() {
		return 0, 0, nil, ErrApiGamesSyncInProgress
	}
	defer apiGamesSyncMutex.Unlock()

	merchantID := strings.TrimSpace(os.Getenv("APIGAMES_MERCHANT_ID"))
	secretKey := strings.TrimSpace(os.Getenv("APIGAMES_SECRET_KEY"))
	if merchantID == "" || secretKey == "" {
		return 0, 0, nil, fmt.Errorf("credential ApiGames belum lengkap")
	}

	data, err := fetchApiGamesSnapshot(
		apiGamesHTTPClient,
		apiGamesPriceListBaseURL,
		merchantID,
		secretKey,
	)
	if err != nil {
		return 0, 0, nil, err
	}

	// Empty snapshots are safe: this flow never mass-disables ApiGames rows.
	return syncApiGamesSnapshot(database.DB, data)
}

// 5. CRUD FUNCTIONS (Biar api.go nggak error undefined)
func UpdateProduct(c *fiber.Ctx) error {
	id := c.Params("id")
	var product models.Product
	if err := database.DB.First(&product, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Produk tidak ditemukan"})
	}

	var input struct {
		Name            *string         `json:"name"`
		Code            *string         `json:"code"`
		Price           *float64        `json:"price"`
		OriginalPrice   json.RawMessage `json:"original_price"`
		Stock           *int            `json:"stock"`
		AdminEnabled    *bool           `json:"admin_enabled"`
		ImageURL        *string         `json:"image_url"`
		CatalogCardCode *string         `json:"catalog_cardcode"`
		SortOrder       *int            `json:"sort_order"`
	}
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Input produk tidak valid"})
	}

	updates := make(map[string]interface{})
	if input.Name != nil {
		updates["name"] = *input.Name
	}
	if input.Code != nil {
		updates["code"] = *input.Code
	}
	if input.Price != nil {
		updates["price"] = *input.Price
	}
	if input.Stock != nil {
		updates["stock"] = *input.Stock
	}
	if input.AdminEnabled != nil {
		updates["admin_enabled"] = *input.AdminEnabled
	}
	if input.ImageURL != nil {
		updates["image_url"] = *input.ImageURL
	}
	if input.CatalogCardCode != nil {
		catalogCardCode := strings.TrimSpace(*input.CatalogCardCode)
		if catalogCardCode == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "catalog_cardcode tidak boleh kosong",
			})
		}

		updates["catalog_cardcode"] = catalogCardCode
	}
	if input.SortOrder != nil {
		if *input.SortOrder < 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "sort_order tidak boleh negatif",
			})
		}
		updates["sort_order"] = *input.SortOrder
	}
	if catalogCardCode, changesCatalog := updates["catalog_cardcode"].(string); changesCatalog && catalogCardCode != product.CatalogCardCode {
		updates["product_group_id"] = nil
		updates["sort_order"] = 0
	}

	if len(input.OriginalPrice) > 0 {
		rawOriginalPrice := strings.TrimSpace(string(input.OriginalPrice))

		if rawOriginalPrice == "null" || rawOriginalPrice == `""` {
			updates["original_price"] = nil
		} else {
			var originalPrice float64
			if err := json.Unmarshal(input.OriginalPrice, &originalPrice); err != nil {
				return c.Status(400).JSON(fiber.Map{
					"error": "Harga normal harus berupa angka atau null",
				})
			}
			if originalPrice < 0 {
				return c.Status(400).JSON(fiber.Map{
					"error": "Harga normal tidak boleh negatif",
				})
			}
			updates["original_price"] = originalPrice
		}
	}

	if len(updates) > 0 {
		err := database.DB.Transaction(func(tx *gorm.DB) error {
			if input.CatalogCardCode != nil {
				var catalogCount int64
				if err := tx.Model(&models.Catalog{}).
					Where("card_code = ?", updates["catalog_cardcode"]).
					Count(&catalogCount).Error; err != nil {
					return err
				}
				if catalogCount == 0 {
					return gorm.ErrRecordNotFound
				}
			}

			return tx.Model(&product).Updates(updates).Error
		})
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Katalog tujuan tidak ditemukan",
			})
		}
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
	}

	if err := database.DB.First(&product, id).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error": "Produk tersimpan tetapi gagal dimuat ulang",
		})
	}

	return c.JSON(product)
}

const maxBulkProductIDs = 500

type bulkProductChanges struct {
	AdminEnabled    *bool   `json:"admin_enabled"`
	CatalogCardCode *string `json:"catalog_cardcode"`
	ImageURL        *string `json:"image_url"`
}

type bulkUpdateProductsInput struct {
	ProductIDs []uint             `json:"product_ids"`
	Changes    bulkProductChanges `json:"changes"`
}

func decodeStrictProductJSON(c *fiber.Ctx, destination interface{}) error {
	decoder := json.NewDecoder(bytes.NewReader(c.Body()))
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(destination); err != nil {
		return err
	}

	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		if err == nil {
			return fmt.Errorf("body hanya boleh berisi satu objek JSON")
		}
		return err
	}

	return nil
}

func normalizeBulkProductIDs(productIDs []uint) ([]uint, error) {
	if len(productIDs) == 0 {
		return nil, fmt.Errorf("product_ids wajib berisi minimal satu ID")
	}
	if len(productIDs) > maxBulkProductIDs {
		return nil, fmt.Errorf("maksimal %d produk per request", maxBulkProductIDs)
	}

	seen := make(map[uint]struct{}, len(productIDs))
	uniqueIDs := make([]uint, 0, len(productIDs))

	for _, productID := range productIDs {
		if productID == 0 {
			return nil, fmt.Errorf("product_ids hanya boleh berisi ID valid")
		}
		if _, exists := seen[productID]; exists {
			continue
		}

		seen[productID] = struct{}{}
		uniqueIDs = append(uniqueIDs, productID)
	}

	if len(uniqueIDs) == 0 {
		return nil, fmt.Errorf("product_ids wajib berisi minimal satu ID unik")
	}

	return uniqueIDs, nil
}

func normalizeBulkProductImageURL(rawImageURL string) (string, error) {
	imageURL := strings.TrimSpace(rawImageURL)
	if imageURL == "" {
		return "", fmt.Errorf("image_url tidak boleh kosong")
	}
	if len(imageURL) > 2048 {
		return "", fmt.Errorf("image_url terlalu panjang")
	}
	if strings.HasPrefix(imageURL, "/") && !strings.HasPrefix(imageURL, "//") {
		return imageURL, nil
	}

	parsedURL, err := url.ParseRequestURI(imageURL)
	if err != nil || parsedURL.Host == "" || (parsedURL.Scheme != "http" && parsedURL.Scheme != "https") {
		return "", fmt.Errorf("image_url harus berupa URL mentah http(s) atau path lokal /images/...")
	}

	return imageURL, nil
}

func BulkUpdateProducts(c *fiber.Ctx) error {
	var input bulkUpdateProductsInput
	if err := decodeStrictProductJSON(c, &input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Payload bulk update tidak valid: " + err.Error(),
		})
	}

	productIDs, err := normalizeBulkProductIDs(input.ProductIDs)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	updates := make(map[string]interface{}, 3)
	if input.Changes.AdminEnabled != nil {
		updates["admin_enabled"] = *input.Changes.AdminEnabled
	}

	catalogCardCode := ""
	if input.Changes.CatalogCardCode != nil {
		catalogCardCode = strings.TrimSpace(*input.Changes.CatalogCardCode)
		if catalogCardCode == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "catalog_cardcode tidak boleh kosong",
			})
		}

		updates["catalog_cardcode"] = catalogCardCode
	}
	if input.Changes.ImageURL != nil {
		imageURL, imageURLError := normalizeBulkProductImageURL(*input.Changes.ImageURL)
		if imageURLError != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": imageURLError.Error(),
			})
		}

		updates["image_url"] = imageURL
	}

	if len(updates) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Tidak ada perubahan yang diizinkan",
		})
	}

	var matched int64
	var updated int64
	catalogNotFound := false
	err = database.DB.Transaction(func(tx *gorm.DB) error {
		if catalogCardCode != "" {
			var catalogCount int64
			if err := tx.Model(&models.Catalog{}).
				Where("card_code = ?", catalogCardCode).
				Count(&catalogCount).Error; err != nil {
				return err
			}
			if catalogCount == 0 {
				catalogNotFound = true
				return nil
			}
		}

		if err := tx.Model(&models.Product{}).
			Where("id IN ?", productIDs).
			Count(&matched).Error; err != nil {
			return err
		}

		if matched == 0 {
			return nil
		}

		if catalogCardCode != "" {
			if err := tx.Model(&models.Product{}).
				Where("id IN ?", productIDs).
				Where("COALESCE(catalog_cardcode, '') <> ?", catalogCardCode).
				Updates(map[string]interface{}{
					"product_group_id": nil,
					"sort_order":       0,
				}).Error; err != nil {
				return err
			}
		}

		result := tx.Model(&models.Product{}).
			Where("id IN ?", productIDs).
			Updates(updates)
		if result.Error != nil {
			return result.Error
		}

		updated = result.RowsAffected
		return nil
	})
	if catalogNotFound {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Katalog tujuan tidak ditemukan",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal memperbarui produk secara massal",
		})
	}

	return c.JSON(fiber.Map{
		"message":   "Bulk update produk selesai",
		"requested": len(productIDs),
		"matched":   matched,
		"updated":   updated,
	})
}

func UpdateProductImage(c *fiber.Ctx) error {
	id := c.Params("id")
	var input struct {
		ImageURL string `json:"image_url"`
	}
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Format bapuk"})
	}
	result := database.DB.Model(&models.Product{}).
		Where("id = ?", id).
		Update("image_url", input.ImageURL)
	if result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal memperbarui thumbnail produk",
		})
	}
	if result.RowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Produk tidak ditemukan",
		})
	}
	return c.JSON(fiber.Map{"message": "Gambar Update! 📸"})
}

// 6. HELPERS
func GenerateMD5(text string) string {
	hash := md5.Sum([]byte(text))
	return hex.EncodeToString(hash[:])
}

func GenerateSmartCode(name string) string {
	name = strings.ToUpper(name)
	special := map[string]string{"MOBILE LEGENDS": "MLBB", "FREE FIRE": "FF", "PUBG MOBILE": "PUBGM"}
	for k, v := range special {
		if strings.Contains(name, k) {
			return v
		}
	}
	if len(name) > 4 {
		return name[:4]
	}
	return name
}

// 1. GET PENDING PRODUCTS
func GetPendingProducts(c *fiber.Ctx) error {
	var pending []models.PendingProduct
	database.DB.Where("status = ?", "pending").Order("created_at desc").Find(&pending)
	return c.JSON(pending)
}

// 2. APPROVE / MAP PENDING PRODUCT
type pendingApprovalPlan struct {
	ExistingProductID uint
	Create            *models.Product
}

func planPendingProductApproval(
	pending models.PendingProduct,
	catalogCardCode string,
	existing *models.Product,
) (pendingApprovalPlan, error) {
	if existing != nil {
		if existing.DeletedAt.Valid {
			return pendingApprovalPlan{}, fmt.Errorf("SKU sudah dimiliki produk yang terarsip")
		}
		return pendingApprovalPlan{ExistingProductID: existing.ID}, nil
	}

	sku := strings.TrimSpace(pending.RawSKU)
	provider := strings.ToLower(strings.TrimSpace(pending.Provider))
	catalogCardCode = strings.TrimSpace(catalogCardCode)
	if sku == "" || provider == "" || catalogCardCode == "" {
		return pendingApprovalPlan{}, fmt.Errorf("data pending atau katalog tidak valid")
	}

	return pendingApprovalPlan{
		Create: &models.Product{
			Name:            strings.TrimSpace(pending.RawName),
			Code:            sku,
			Price:           0,
			Stock:           0,
			IsActive:        false,
			AdminEnabled:    false,
			Provider:        provider,
			CatalogCardCode: catalogCardCode,
		},
	}, nil
}

func ApprovePendingProduct(c *fiber.Ctx) error {
	var input struct {
		PendingID       uint   `json:"pending_id"`
		CatalogCardCode string `json:"catalog_cardcode"`
	}
	if err := c.BodyParser(&input); err != nil || input.PendingID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Input approval tidak valid"})
	}
	input.CatalogCardCode = strings.TrimSpace(input.CatalogCardCode)
	if input.CatalogCardCode == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Katalog tujuan wajib dipilih"})
	}

	var productID uint
	created := false
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		var pending models.PendingProduct
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			First(&pending, input.PendingID).Error; err != nil {
			return err
		}

		var catalog models.Catalog
		if err := tx.Where("card_code = ?", input.CatalogCardCode).First(&catalog).Error; err != nil {
			return err
		}

		var existing models.Product
		errFind := tx.Unscoped().
			Where("LOWER(BTRIM(code)) = LOWER(BTRIM(?))", pending.RawSKU).
			First(&existing).Error
		var existingPtr *models.Product
		switch {
		case errors.Is(errFind, gorm.ErrRecordNotFound):
			existingPtr = nil
		case errFind != nil:
			return errFind
		default:
			existingPtr = &existing
		}

		plan, err := planPendingProductApproval(pending, catalog.CardCode, existingPtr)
		if err != nil {
			return err
		}

		if plan.Create != nil {
			result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(plan.Create)
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				var racedExisting models.Product
				if err := tx.Unscoped().
					Where("LOWER(BTRIM(code)) = LOWER(BTRIM(?))", pending.RawSKU).
					First(&racedExisting).Error; err != nil {
					return err
				}
				productID = racedExisting.ID
			} else {
				productID = plan.Create.ID
				created = true
			}
		} else {
			productID = plan.ExistingProductID
		}

		if err := tx.Model(&pending).Update("status", "processed").Error; err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		switch {
		case errors.Is(err, gorm.ErrRecordNotFound):
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Data pending atau katalog tidak ditemukan"})
		case strings.Contains(strings.ToLower(err.Error()), "terarsip"):
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error()})
		default:
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal approve produk"})
		}
	}

	message := "Pending product ditandai selesai; SKU existing dipertahankan tanpa duplikasi."
	if created {
		message = "Produk baru dibuat dalam kondisi nonaktif; sync provider berikutnya akan mengisi harga dan stok."
	}
	return c.JSON(fiber.Map{
		"message":    message,
		"product_id": productID,
		"created":    created,
	})
}
