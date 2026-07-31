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
	"strings"

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
		Order("id desc").
		Find(&products).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal ambil data produk"})
	}
	var latestProduct models.Product
	database.DB.Order("updated_at desc").First(&latestProduct)
	return c.JSON(fiber.Map{"products": products, "last_update": latestProduct.UpdatedAt})
}

// 2. HANDLER SYNC (SEKARANG PUNYA RADAR)
func SyncAllProducts(c *fiber.Ctx) error {
	provider := c.Params("provider")

	if provider == "all" {
		t1, a1, unmapped1, e1 := RunDigiflazzSync()
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
		total, active, unmapped, err = RunDigiflazzSync()
	case "apigames":
		total, active, unmapped, err = RunApiGamesSync()
	default:
		return c.Status(400).JSON(fiber.Map{"error": "Provider tidak dikenal"})
	}

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal Sync " + provider, "message": err.Error()})
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
func RunDigiflazzSync() (int, int, []string, error) { // <--- Perhatikan return type-nya berubah
	username := os.Getenv("DIGIFLAZZ_USERNAME")
	apiKey := os.Getenv("DIGIFLAZZ_API_KEY")

	signStr := username + apiKey + "depo"
	hash := md5.Sum([]byte(signStr))
	signature := hex.EncodeToString(hash[:])

	payload := map[string]interface{}{"cmd": "prepaid", "username": username, "sign": signature}
	jsonPayload, _ := json.Marshal(payload)

	resp, err := http.Post("https://api.digiflazz.com/v1/price-list", "application/json", bytes.NewBuffer(jsonPayload))
	if err != nil {
		return 0, 0, nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	data, ok := result["data"].([]interface{})
	if !ok {
		return 0, 0, nil, fmt.Errorf("format data provider tidak valid")
	}

	count, activeCount := 0, 0
	unmappedMap := make(map[string]bool) // Buku catatan buat game yang belum ada rumahnya

	err = database.DB.Transaction(func(tx *gorm.DB) error {
		// Produk testing lokal jangan ikut dimatikan oleh sinkronisasi provider.
		// Selain tetap aktif, stock dibuat unlimited agar frontend tidak menguncinya sebagai KOSONG.
		if err := tx.Model(&models.Product{}).
			Where("LOWER(provider) = ?", "digiflazz").
			Where("(UPPER(COALESCE(name, '')) LIKE ? OR UPPER(COALESCE(code, '')) LIKE ?)", "%TEST%", "%TEST%").
			Updates(map[string]interface{}{
				"is_active": true,
				"stock":     -1,
			}).Error; err != nil {
			return err
		}

		// Produk Digiflazz biasa di-reset sebelum status terbaru dari provider diterapkan.
		// Produk testing dikecualikan dari reset ini.
		if err := tx.Model(&models.Product{}).
			Where("LOWER(provider) = ?", "digiflazz").
			Where("UPPER(COALESCE(name, '')) NOT LIKE ?", "%TEST%").
			Where("UPPER(COALESCE(code, '')) NOT LIKE ?", "%TEST%").
			Update("is_active", false).Error; err != nil {
			return err
		}

		var catalogs []models.Catalog
		tx.Select("card_code").Find(&catalogs) // Cari katalog yg aktif aja

		validCatalogs := make(map[string]bool)
		for _, c := range catalogs {
			if c.CardCode != "" {
				validCatalogs[c.CardCode] = true
			}
		}

		for _, item := range data {
			p, ok := item.(map[string]interface{})
			if !ok {
				continue
			}

			sku, _ := p["buyer_sku_code"].(string)
			if sku == "" {
				continue
			}

			brand, _ := p["brand"].(string)
			name, _ := p["product_name"].(string)
			price, _ := p["price"].(float64)

			buyerStatus, _ := p["buyer_product_status"].(bool)
			sellerStatus, _ := p["seller_product_status"].(bool)
			isActive := buyerStatus && sellerStatus

			unlimitedStock, _ := p["unlimited_stock"].(bool)
			digiStock, _ := p["stock"].(float64)
			finalStock := 0
			if unlimitedStock {
				finalStock = -1
			} else {
				finalStock = int(digiStock)
			}

			smartCode := GenerateSmartCode(brand)

			// 🔥 GATEKEEPER & RADAR
			if !validCatalogs[smartCode] {
				// Cek apakah SKU ini udah ada di tabel pending biar gak spam insert
				var existingPending models.PendingProduct
				errCheck := tx.Where("raw_sku = ?", sku).First(&existingPending).Error

				// Kalau belum ada di pending, baru kita insert
				if errCheck != nil {
					tx.Create(&models.PendingProduct{
						RawSKU:   sku,
						RawBrand: brand,
						RawName:  name,
						Provider: "digiflazz",
						Status:   "pending",
					})
				}
				continue // Langsung lanjut, JANGAN buat produk di tabel utama!
			}

			var existing models.Product
			errFind := tx.Unscoped().Where("code = ?", sku).First(&existing).Error
			if errors.Is(errFind, gorm.ErrRecordNotFound) {
				tx.Create(&models.Product{Name: name, Code: sku, Price: price, IsActive: isActive, Provider: "digiflazz", CatalogCardCode: smartCode, Stock: finalStock})
			} else if errFind != nil {
				return errFind
			} else if existing.DeletedAt.Valid {
				continue
			} else {
				tx.Model(&existing).Updates(map[string]interface{}{"name": name, "is_active": isActive, "price": price, "stock": finalStock, "catalog_card_code": smartCode})
			}

			count++
			if isActive {
				activeCount++
			}
		}
		return nil
	})

	// Pindahin dari buku catatan ke format list array
	var unmappedBrands []string
	for b := range unmappedMap {
		unmappedBrands = append(unmappedBrands, b)
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
		updates["catalog_cardcode"] = *input.CatalogCardCode
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
		if err := database.DB.Model(&product).Updates(updates).Error; err != nil {
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
