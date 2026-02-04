// controllers/product_controller.go
package controllers

import (
	"bytes"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
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
	if err := database.DB.Preload("Catalog").Order("id desc").Find(&products).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal ambil data produk"})
	}
	var latestProduct models.Product
	database.DB.Order("updated_at desc").First(&latestProduct)
	return c.JSON(fiber.Map{"products": products, "last_update": latestProduct.UpdatedAt})
}

// 2. HANDLER SYNC (ANTI-EROR 500)
func SyncAllProducts(c *fiber.Ctx) error {
	provider := c.Params("provider")

	if provider == "all" {
		t1, a1, _, e1 := RunDigiflazzSync()
		t2, a2, _, e2 := RunApiGamesSync()

		return c.JSON(fiber.Map{
			"message": "Proses Sinkronisasi Selesai",
			"details": fiber.Map{
				"digiflazz": fiber.Map{"success": e1 == nil, "total": t1, "active": a1, "error": fmt.Sprintf("%v", e1)},
				"apigames":  fiber.Map{"success": e2 == nil, "total": t2, "active": a2, "error": fmt.Sprintf("%v", e2)},
			},
		})
	}

	var total, active int
	var err error
	switch provider {
	case "digiflazz":
		total, active, _, err = RunDigiflazzSync()
	case "apigames":
		total, active, _, err = RunApiGamesSync()
	default:
		return c.Status(400).JSON(fiber.Map{"error": "Provider tidak dikenal"})
	}

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal Sync " + provider, "message": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Sync " + provider + " Berhasil", "total": total, "active": active})
}

// 3. MESIN DIGIFLAZZ
func RunDigiflazzSync() (int, int, int, error) {
	username := os.Getenv("DIGIFLAZZ_USERNAME")
	apiKey := os.Getenv("DIGIFLAZZ_API_KEY")
	payload := map[string]interface{}{"cmd": "prepaid", "username": username, "sign": GenerateMD5(username + apiKey + "depo")}
	jsonPayload, _ := json.Marshal(payload)

	resp, err := http.Post("https://api.digiflazz.com/v1/price-list", "application/json", bytes.NewBuffer(jsonPayload))
	if err != nil {
		return 0, 0, 0, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	data, _ := result["data"].([]interface{})

	count, activeCount := 0, 0
	err = database.DB.Transaction(func(tx *gorm.DB) error {
		for _, item := range data {
			p, _ := item.(map[string]interface{})
			sku, _ := p["buyer_sku_code"].(string)
			brand, _ := p["brand"].(string)
			price, _ := p["price"].(float64)
			isActive := p["buyer_product_status"].(bool) && p["seller_product_status"].(bool)
			if sku == "" {
				continue
			}

			smartCode := GenerateSmartCode(brand)
			if err := tx.Unscoped().Where("code = ?", sku).First(&models.Product{}).Error; err != nil {
				tx.Create(&models.Product{Name: p["product_name"].(string), Code: sku, Price: price, IsActive: isActive, Provider: "digiflazz", CatalogCardCode: smartCode})
			} else {
				tx.Model(&models.Product{}).Where("code = ?", sku).Updates(map[string]interface{}{"is_active": isActive, "price": price, "deleted_at": nil})
			}
			count++
			if isActive {
				activeCount++
			}
		}
		return nil
	})
	return count, activeCount, 0, err
}

// 4. MESIN APIGAMES
func RunApiGamesSync() (int, int, int, error) {
	mID := os.Getenv("APIGAMES_MERCHANT_ID")
	sKey := os.Getenv("APIGAMES_SECRET_KEY")
	sign := GenerateMD5(mID + sKey)

	url := fmt.Sprintf("https://v1.apigames.id/v2/pricelist?merchant=%s&signature=%s", mID, sign)
	resp, err := http.Get(url)
	if err != nil {
		return 0, 0, 0, err
	}
	defer resp.Body.Close()

	var result struct {
		Data []map[string]interface{} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, 0, 0, err
	}

	count, activeCount := 0, 0
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

			if err := tx.Unscoped().Where("code = ?", sku).First(&models.Product{}).Error; err != nil {
				tx.Create(&models.Product{Name: p["product_name"].(string), Code: sku, Price: 0, IsActive: isActive, Provider: "apigames", CatalogCardCode: smartCode})
			} else {
				tx.Model(&models.Product{}).Where("code = ?", sku).Updates(map[string]interface{}{"is_active": isActive, "deleted_at": nil})
			}
			count++
			if isActive {
				activeCount++
			}
		}
		return nil
	})
	return count, activeCount, 0, err
}

// 5. CRUD FUNCTIONS (Biar api.go nggak error undefined)
func UpdateProduct(c *fiber.Ctx) error {
	id := c.Params("id")
	var product models.Product
	if err := database.DB.First(&product, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Produk tidak ditemukan"})
	}
	var input models.Product
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Input bapuk"})
	}
	database.DB.Model(&product).Updates(input)
	return c.JSON(product)
}

func DeleteProduct(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := database.DB.Delete(&models.Product{}, id).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal hapus"})
	}
	return c.JSON(fiber.Map{"message": "Terhapus! 🗑️"})
}

func UpdateProductImage(c *fiber.Ctx) error {
	id := c.Params("id")
	var input struct {
		ImageURL string `json:"image_url"`
	}
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Format bapuk"})
	}
	database.DB.Model(&models.Product{}).Where("id = ?", id).Update("image_url", input.ImageURL)
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
