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
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/derry/anggijajan-v2-backend/database"
	"github.com/derry/anggijajan-v2-backend/models"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// 1. GET ALL PRODUCTS
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

	signature := digiflazzPriceListSignature(username, apiKey)

	payload := map[string]interface{}{
		"cmd":      "prepaid",
		"username": username,
		"sign":     signature,
	}
	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return 0, 0, nil, fmt.Errorf("gagal membuat payload Digiflazz: %w", err)
	}

	request, err := http.NewRequest(
		http.MethodPost,
		"https://api.digiflazz.com/v1/price-list",
		bytes.NewBuffer(jsonPayload),
	)
	if err != nil {
		return 0, 0, nil, fmt.Errorf("gagal membuat request Digiflazz: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	providerRequestSent = true
	resp, err := client.Do(request)
	if err != nil {
		return 0, 0, nil, fmt.Errorf("gagal menghubungi Digiflazz: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return 0, 0, nil, fmt.Errorf(
			"Digiflazz mengembalikan HTTP %d",
			resp.StatusCode,
		)
	}

	data, err := decodeDigiflazzPriceList(resp.Body)
	if err != nil {
		return 0, 0, nil, err
	}
	if reportProgress != nil {
		reportProgress("validating_snapshot", 0, len(data))
	}

	count, activeCount := 0, 0
	unmappedMap := make(map[string]bool)

	err = database.DB.Transaction(func(tx *gorm.DB) error {
		// Produk testing lokal jangan ikut dimatikan oleh sinkronisasi provider.
		if err := tx.Model(&models.Product{}).
			Where("LOWER(provider) = ?", "digiflazz").
			Where(
				"(UPPER(COALESCE(name, '')) LIKE ? OR UPPER(COALESCE(code, '')) LIKE ?)",
				"%TEST%",
				"%TEST%",
			).
			Updates(map[string]interface{}{
				"is_active": true,
				"stock":     -1,
			}).Error; err != nil {
			return err
		}

		// Produk Digiflazz biasa di-reset sebelum status terbaru diterapkan.
		// Produk testing dikecualikan dari reset ini.
		if err := tx.Model(&models.Product{}).
			Where("LOWER(provider) = ?", "digiflazz").
			Where("UPPER(COALESCE(name, '')) NOT LIKE ?", "%TEST%").
			Where("UPPER(COALESCE(code, '')) NOT LIKE ?", "%TEST%").
			Update("is_active", false).Error; err != nil {
			return err
		}

		var catalogs []models.Catalog
		if err := tx.Select("card_code").Find(&catalogs).Error; err != nil {
			return err
		}

		validCatalogs := make(map[string]bool, len(catalogs))
		for _, catalog := range catalogs {
			if catalog.CardCode != "" {
				validCatalogs[catalog.CardCode] = true
			}
		}

		for itemIndex, providerProduct := range data {
			if reportProgress != nil && (itemIndex%25 == 0 || itemIndex == len(data)-1) {
				reportProgress("updating_products", itemIndex+1, len(data))
			}

			sku, _ := providerProduct["buyer_sku_code"].(string)
			sku = strings.TrimSpace(sku)
			if sku == "" {
				continue
			}

			brand, _ := providerProduct["brand"].(string)
			name, _ := providerProduct["product_name"].(string)
			price, _ := providerProduct["price"].(float64)

			buyerStatus, _ := providerProduct["buyer_product_status"].(bool)
			sellerStatus, _ := providerProduct["seller_product_status"].(bool)
			isActive := buyerStatus && sellerStatus

			unlimitedStock, _ := providerProduct["unlimited_stock"].(bool)
			digiStock, _ := providerProduct["stock"].(float64)
			finalStock := 0
			if unlimitedStock {
				finalStock = -1
			} else {
				finalStock = int(digiStock)
			}

			smartCode := GenerateSmartCode(brand)

			// Produk tanpa katalog valid masuk staging area, bukan inventory utama.
			if !validCatalogs[smartCode] {
				unmappedLabel := strings.TrimSpace(brand)
				if unmappedLabel == "" {
					unmappedLabel = smartCode
				}
				if unmappedLabel != "" {
					unmappedMap[unmappedLabel] = true
				}

				var existingPending models.PendingProduct
				errCheck := tx.
					Where("raw_sku = ?", sku).
					First(&existingPending).
					Error

				switch {
				case errors.Is(errCheck, gorm.ErrRecordNotFound):
					if err := tx.Create(&models.PendingProduct{
						RawSKU:   sku,
						RawBrand: brand,
						RawName:  name,
						Provider: "digiflazz",
						Status:   "pending",
					}).Error; err != nil {
						return err
					}
				case errCheck != nil:
					return errCheck
				}

				continue
			}

			var existing models.Product
			errFind := tx.Unscoped().
				Where("code = ?", sku).
				First(&existing).
				Error

			switch {
			case errors.Is(errFind, gorm.ErrRecordNotFound):
				if err := tx.Create(&models.Product{
					Name:            name,
					Code:            sku,
					Price:           price,
					IsActive:        isActive,
					Provider:        "digiflazz",
					CatalogCardCode: smartCode,
					Stock:           finalStock,
				}).Error; err != nil {
					return err
				}

			case errFind != nil:
				return errFind

			case existing.DeletedAt.Valid:
				// Produk legacy yang masih soft-deleted tidak dihidupkan diam-diam.
				continue

			default:
				updates := map[string]interface{}{
					"name":      name,
					"is_active": isActive,
					"price":     price,
					"stock":     finalStock,
				}

				// Grouping dan sort order tetap dikelola admin. Jika mapping
				// provider memindahkan produk ke katalog lain, grup lama dilepas.
				if existing.CatalogCardCode != smartCode {
					updates["catalog_cardcode"] = smartCode
					updates["product_group_id"] = nil
					updates["sort_order"] = 0
				}

				if err := tx.Model(&existing).Updates(updates).Error; err != nil {
					return err
				}
			}

			count++
			if isActive {
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
	if reportProgress != nil && err == nil {
		reportProgress("finalizing", len(data), len(data))
	}

	return count, activeCount, unmappedBrands, err
}

// 4. MESIN APIGAMES (Biar nggak error undefined saat direturn)
func RunApiGamesSync() (int, int, []string, error) {
	// Fungsi ApiGames lu tetep sama, cuma return type-nya disesuaiin
	mID := os.Getenv("APIGAMES_MERCHANT_ID")
	sKey := os.Getenv("APIGAMES_SECRET_KEY")
	sign := GenerateMD5(mID + sKey)

	url := fmt.Sprintf("https://v1.apigames.id/v2/pricelist?merchant=%s&signature=%s", mID, sign)
	resp, err := http.Get(url)
	if err != nil {
		return 0, 0, nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Data []map[string]interface{} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, 0, nil, err
	}

	count, activeCount := 0, 0
	var unmappedBrands []string // Dikosongin dulu aja buat ApiGames

	err = database.DB.Transaction(func(tx *gorm.DB) error {
		for _, p := range result.Data {
			sku, _ := p["product_id"].(string)
			brand, _ := p["brand"].(string)
			status, _ := p["status"].(string)
			if sku == "" {
				continue
			}

			isActive := status == "tersedia"
			smartCode := GenerateSmartCode(brand)

			var existing models.Product
			errFind := tx.Unscoped().Where("code = ?", sku).First(&existing).Error
			if errors.Is(errFind, gorm.ErrRecordNotFound) {
				tx.Create(&models.Product{Name: p["product_name"].(string), Code: sku, Price: 0, IsActive: isActive, Provider: "apigames", CatalogCardCode: smartCode})
			} else if errFind != nil {
				return errFind
			} else if existing.DeletedAt.Valid {
				continue
			} else {
				tx.Model(&existing).Update("is_active", isActive)
			}
			count++
			if isActive {
				activeCount++
			}
		}
		return nil
	})
	return count, activeCount, unmappedBrands, err
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
func ApprovePendingProduct(c *fiber.Ctx) error {
	var input struct {
		PendingID       uint   `json:"pending_id"`
		CatalogCardCode string `json:"catalog_cardcode"`
	}
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Input bapuk"})
	}

	// A. Ambil data dari pending
	var pending models.PendingProduct
	if err := database.DB.First(&pending, input.PendingID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Data pending tidak ditemukan"})
	}

	// B. Cek apakah katalognya valid
	var catalog models.Catalog
	if err := database.DB.Where("card_code = ?", input.CatalogCardCode).First(&catalog).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Katalog tujuan tidak ditemukan"})
	}

	// C. Pindah ke tabel Produk (Transaction biar aman)
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		// Create produk baru
		newProduct := models.Product{
			Name:            pending.RawName,
			Code:            pending.RawSKU, // SKU dari provider
			Price:           0,              // Defaultin 0, nanti admin update di dashboard
			IsActive:        true,
			Provider:        pending.Provider,
			CatalogCardCode: catalog.CardCode,
			Stock:           0,
		}
		if err := tx.Create(&newProduct).Error; err != nil {
			return err
		}

		// Update status pending jadi 'processed'
		tx.Model(&pending).Update("status", "processed")
		return nil
	})

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal Approve Produk"})
	}

	return c.JSON(fiber.Map{"message": "Produk berhasil di-approve & live!"})
}
