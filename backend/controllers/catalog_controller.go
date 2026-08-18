package controllers

import (
	"encoding/json"
	"errors"
	"strings"

	"github.com/derry/anggijajan-v2-backend/database"
	"github.com/derry/anggijajan-v2-backend/models"
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var errCatalogStillReferenced = errors.New("catalog masih direferensikan")
var deleteCatalogByCardCode = deleteCatalogByCardCodeFromDB

// --- 1. GET ALL CATALOGS (ADMIN) ---
func GetAdminCatalogs(c *fiber.Ctx) error {
	var catalogs []models.Catalog
	database.DB.Order("created_at desc").Find(&catalogs) //
	return c.JSON(catalogs)
}

// --- 2. GET PUBLIC CATALOGS ---
func GetCatalogs(c *fiber.Ctx) error {
	var catalogs []models.Catalog

	if err := database.DB.
		Where("is_active = ? AND is_public = ?", true, true).
		Order("sort_order ASC, name ASC").
		Find(&catalogs).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal mengambil katalog publik",
		})
	}

	return c.JSON(catalogs)
}

// --- 3. GET PUBLIC CATALOG BY SLUG ---
func GetCatalogBySlug(c *fiber.Ctx) error {
	slug := c.Params("slug")
	var catalog models.Catalog

	if err := database.DB.
		Preload("Products", func(db *gorm.DB) *gorm.DB {
			return db.
				Where("product_group_id IS NULL AND is_active = ? AND admin_enabled = ? AND stock <> ?", true, true, 0).
				Order("sort_order ASC, price ASC, name ASC, id ASC")
		}).
		Preload("ProductGroups", func(db *gorm.DB) *gorm.DB {
			return db.
				Where("is_active = ?", true).
				Order("sort_order ASC, name ASC, id ASC")
		}).
		Preload("ProductGroups.Products", func(db *gorm.DB) *gorm.DB {
			return db.
				Where("is_active = ? AND admin_enabled = ? AND stock <> ?", true, true, 0).
				Order("sort_order ASC, price ASC, name ASC, id ASC")
		}).
		Where(
			"slug = ? AND is_active = ? AND is_public = ?",
			slug,
			true,
			true,
		).
		First(&catalog).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Catalog not found",
		})
	}

	for productIndex := range catalog.Products {
		catalog.Products[productIndex].ApplyStorefrontPricing(catalog.MarkupPercent, nil)
	}
	for groupIndex := range catalog.ProductGroups {
		productGroup := &catalog.ProductGroups[groupIndex]
		for productIndex := range productGroup.Products {
			productGroup.Products[productIndex].ApplyStorefrontPricing(
				catalog.MarkupPercent,
				productGroup.MarkupPercent,
			)
		}
	}

	return c.JSON(catalog)
}

// --- 4. CREATE CATALOG ---
func CreateCatalog(c *fiber.Ctx) error {
	var markupInput struct {
		MarkupPercent json.RawMessage `json:"markup_percent"`
	}
	if err := json.Unmarshal(c.Body(), &markupInput); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Input katalog tidak valid"})
	}
	markupPercent, markupPresent, err := parseNullableMarkupPercent(markupInput.MarkupPercent)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	var input models.Catalog
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}
	if markupPresent {
		input.MarkupPercent = markupPercent
	}

	// Auto Generate Slug kalo kosong (Simple version)
	if input.Slug == "" {
		input.Slug = strings.ToLower(strings.ReplaceAll(input.Name, " ", "-"))
	}

	// Validasi TargetType.
	input.TargetType = strings.TrimSpace(input.TargetType)
	switch input.TargetType {
	case "SINGLE_UID", "UID_ZONE", "UID_SERVER", "STRING_UID":
		// ok
	default:
		if input.TargetType == "" {
			input.TargetType = "SINGLE_UID"
		} else {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "TargetType tidak dikenal: " + input.TargetType +
					". Gunakan SINGLE_UID, UID_ZONE, UID_SERVER, atau STRING_UID.",
			})
		}
	}

	// Validasi hubungan TargetType <-> TargetSecondaryLabel / TargetServerOptions.
	switch input.TargetType {
	case "UID_ZONE":
		if strings.TrimSpace(input.TargetSecondaryLabel) == "" {
			input.TargetSecondaryLabel = "Zone ID"
		}
	case "UID_SERVER":
		if strings.TrimSpace(input.TargetSecondaryLabel) == "" {
			input.TargetSecondaryLabel = "Server"
		}
		if strings.TrimSpace(input.TargetServerOptions) == "" {
			input.TargetServerOptions = "Asia, America, Europe, TW_HK_MO"
		}
	case "SINGLE_UID", "STRING_UID":
		// tidak perlu secondary label
	}

	// Create
	if err := database.DB.Create(&input).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal membuat katalog. Pastikan Kode/Slug unik."})
	}

	return c.JSON(input)
}

// --- 5. UPDATE CATALOG (FIX: CHECK ID & STATUS) ---
func UpdateCatalog(c *fiber.Ctx) error {
	id := c.Params("id")
	var catalog models.Catalog

	// Cari dulu datanya
	if err := database.DB.First(&catalog, "card_code = ?", id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Catalog not found"})
	}

	var markupInput struct {
		MarkupPercent json.RawMessage `json:"markup_percent"`
	}
	if err := json.Unmarshal(c.Body(), &markupInput); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Input katalog tidak valid"})
	}
	markupPercent, markupPresent, err := parseNullableMarkupPercent(markupInput.MarkupPercent)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	// Parsing Input
	var input models.Catalog
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid input"})
	}

	// Validasi TargetType.
	input.TargetType = strings.TrimSpace(input.TargetType)
	switch input.TargetType {
	case "SINGLE_UID", "UID_ZONE", "UID_SERVER", "STRING_UID":
		// ok
	default:
		if input.TargetType == "" {
			input.TargetType = catalog.TargetType
		} else {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "TargetType tidak dikenal: " + input.TargetType +
					". Gunakan SINGLE_UID, UID_ZONE, UID_SERVER, atau STRING_UID.",
			})
		}
	}

	// Validasi hubungan TargetType <-> TargetSecondaryLabel / TargetServerOptions.
	switch input.TargetType {
	case "UID_ZONE":
		if strings.TrimSpace(input.TargetSecondaryLabel) == "" {
			input.TargetSecondaryLabel = catalog.TargetSecondaryLabel
		}
		if strings.TrimSpace(input.TargetSecondaryLabel) == "" {
			input.TargetSecondaryLabel = "Zone ID"
		}
	case "UID_SERVER":
		if strings.TrimSpace(input.TargetSecondaryLabel) == "" {
			input.TargetSecondaryLabel = catalog.TargetSecondaryLabel
		}
		if strings.TrimSpace(input.TargetSecondaryLabel) == "" {
			input.TargetSecondaryLabel = "Server"
		}
		if strings.TrimSpace(input.TargetServerOptions) == "" {
			input.TargetServerOptions = catalog.TargetServerOptions
		}
		if strings.TrimSpace(input.TargetServerOptions) == "" {
			input.TargetServerOptions = "Asia, America, Europe, TW_HK_MO"
		}
	case "SINGLE_UID", "STRING_UID":
		// tidak perlu secondary label
	}

	// Update Field
	catalog.Name = input.Name
	catalog.Slug = input.Slug
	catalog.RequiresZone = input.RequiresZone
	catalog.TargetType = input.TargetType
	catalog.TargetLabel = input.TargetLabel
	catalog.TargetSecondaryLabel = input.TargetSecondaryLabel
	catalog.TargetServerOptions = input.TargetServerOptions
	catalog.ShortName = input.ShortName
	catalog.Category = input.Category
	catalog.Publisher = input.Publisher
	catalog.Region = input.Region
	catalog.Description = input.Description
	catalog.ImageURL = input.ImageURL
	catalog.BannerURL = input.BannerURL
	catalog.CheckIDCode = input.CheckIDCode
	catalog.IsActive = input.IsActive
	catalog.IsPublic = input.IsPublic
	catalog.IsPopular = input.IsPopular
	catalog.SortOrder = input.SortOrder
	if markupPresent {
		catalog.MarkupPercent = markupPercent
	}

	// Save changes
	if err := database.DB.Save(&catalog).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(catalog)
}

// --- 6. DELETE CATALOG ---
func deleteCatalogByCardCodeFromDB(cardCode string) error {
	return database.DB.Transaction(func(tx *gorm.DB) error {
		var catalog models.Catalog
		if err := tx.
			Clauses(clause.Locking{Strength: "UPDATE"}).
			First(&catalog, "card_code = ?", cardCode).Error; err != nil {
			return err
		}

		var productCount int64
		if err := tx.Unscoped().
			Model(&models.Product{}).
			Where("catalog_cardcode = ?", cardCode).
			Count(&productCount).Error; err != nil {
			return err
		}

		var productGroupCount int64
		if err := tx.Unscoped().
			Model(&models.ProductGroup{}).
			Where("catalog_cardcode = ?", cardCode).
			Count(&productGroupCount).Error; err != nil {
			return err
		}

		if productCount > 0 || productGroupCount > 0 {
			return errCatalogStillReferenced
		}

		result := tx.Delete(&catalog)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}

		return nil
	})
}

func isCatalogReferenceConflict(err error) bool {
	if errors.Is(err, errCatalogStillReferenced) {
		return true
	}

	var postgresError *pgconn.PgError
	return errors.As(err, &postgresError) && postgresError.Code == "23503"
}

// --- 6. DELETE CATALOG ---
func DeleteCatalog(c *fiber.Ctx) error {
	err := deleteCatalogByCardCode(c.Params("id"))
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Catalog not found"})
	}
	if isCatalogReferenceConflict(err) {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": "Catalog masih memiliki produk atau kelompok produk.",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal menghapus catalog",
		})
	}

	return c.JSON(fiber.Map{"message": "Catalog deleted"})
}
