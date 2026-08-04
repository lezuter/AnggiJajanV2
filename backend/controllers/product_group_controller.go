package controllers

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/derry/anggijajan-v2-backend/database"
	"github.com/derry/anggijajan-v2-backend/models"
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	maxProductGroupNameLength = 100
	maxProductGroupSortOrder  = 1_000_000
)

var (
	errProductGroupNotFound      = errors.New("kelompok produk tidak ditemukan")
	errProductNotFound           = errors.New("produk tidak ditemukan")
	errProductCatalogMismatch    = errors.New("produk dan kelompok harus berasal dari katalog yang sama")
	errProductNotInGroup         = errors.New("produk tidak berada di kelompok tersebut")
	errProductGroupNameDuplicate = errors.New("nama kelompok sudah digunakan pada katalog ini")
)

type createProductGroupInput struct {
	Name          string          `json:"name"`
	SortOrder     *int            `json:"sort_order"`
	IsActive      *bool           `json:"is_active"`
	MarkupPercent json.RawMessage `json:"markup_percent"`
}

type updateProductGroupInput struct {
	Name          *string         `json:"name"`
	SortOrder     *int            `json:"sort_order"`
	IsActive      *bool           `json:"is_active"`
	MarkupPercent json.RawMessage `json:"markup_percent"`
}

type productGroupProductsInput struct {
	ProductIDs []uint `json:"product_ids"`
}

func normalizeProductGroupName(rawName string) (string, error) {
	name := strings.TrimSpace(rawName)
	if name == "" {
		return "", fmt.Errorf("nama kelompok wajib diisi")
	}
	if utf8.RuneCountInString(name) > maxProductGroupNameLength {
		return "", fmt.Errorf("nama kelompok maksimal %d karakter", maxProductGroupNameLength)
	}
	for _, character := range name {
		if unicode.IsControl(character) {
			return "", fmt.Errorf("nama kelompok tidak boleh mengandung karakter kontrol")
		}
	}

	return name, nil
}

func validateProductGroupSortOrder(sortOrder int) error {
	if sortOrder < 0 {
		return fmt.Errorf("sort_order tidak boleh negatif")
	}
	if sortOrder > maxProductGroupSortOrder {
		return fmt.Errorf("sort_order maksimal %d", maxProductGroupSortOrder)
	}
	return nil
}

func parsePositiveUintParam(rawValue, fieldName string) (uint, error) {
	value, err := strconv.ParseUint(rawValue, 10, 64)
	if err != nil || value == 0 {
		return 0, fmt.Errorf("%s tidak valid", fieldName)
	}
	return uint(value), nil
}

func normalizedCatalogCardCode(rawCardCode string) (string, error) {
	cardCode := strings.TrimSpace(rawCardCode)
	if cardCode == "" {
		return "", fmt.Errorf("catalog_cardcode wajib diisi")
	}
	if utf8.RuneCountInString(cardCode) > 20 {
		return "", fmt.Errorf("catalog_cardcode maksimal 20 karakter")
	}
	return cardCode, nil
}

func productGroupNameExists(tx *gorm.DB, catalogCardCode, name string, excludedID uint) (bool, error) {
	query := tx.Model(&models.ProductGroup{}).
		Where("catalog_cardcode = ?", catalogCardCode).
		Where("LOWER(BTRIM(name)) = LOWER(BTRIM(?))", name)
	if excludedID != 0 {
		query = query.Where("id <> ?", excludedID)
	}

	var count int64
	if err := query.Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func isProductGroupUniqueViolation(err error) bool {
	var postgresError *pgconn.PgError
	return errors.As(err, &postgresError) && postgresError.Code == "23505"
}

func GetProductGroups(c *fiber.Ctx) error {
	catalogCardCode, err := normalizedCatalogCardCode(c.Params("cardcode"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	var catalogCount int64
	if err := database.DB.Model(&models.Catalog{}).
		Where("card_code = ?", catalogCardCode).
		Count(&catalogCount).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal memeriksa katalog",
		})
	}
	if catalogCount == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Katalog tidak ditemukan",
		})
	}

	productGroups := make([]models.ProductGroup, 0)
	if err := database.DB.
		Preload("Products", func(db *gorm.DB) *gorm.DB {
			return db.Order("sort_order ASC, price ASC, name ASC, id ASC")
		}).
		Where("catalog_cardcode = ?", catalogCardCode).
		Order("sort_order ASC, name ASC, id ASC").
		Find(&productGroups).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal mengambil kelompok produk",
		})
	}

	return c.JSON(productGroups)
}

func CreateProductGroup(c *fiber.Ctx) error {
	catalogCardCode, err := normalizedCatalogCardCode(c.Params("cardcode"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	var input createProductGroupInput
	if err := decodeStrictProductJSON(c, &input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Payload kelompok produk tidak valid: " + err.Error(),
		})
	}
	markupPercent, _, err := parseNullableMarkupPercent(input.MarkupPercent)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	name, err := normalizeProductGroupName(input.Name)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	sortOrder := 0
	if input.SortOrder != nil {
		sortOrder = *input.SortOrder
	}
	if err := validateProductGroupSortOrder(sortOrder); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	productGroup := models.ProductGroup{
		Name:            name,
		CatalogCardCode: catalogCardCode,
		SortOrder:       sortOrder,
		IsActive:        isActive,
		MarkupPercent:   markupPercent,
	}

	err = database.DB.Transaction(func(tx *gorm.DB) error {
		var catalog models.Catalog
		if err := tx.Clauses(clause.Locking{Strength: "SHARE"}).
			Select("card_code").
			Where("card_code = ?", catalogCardCode).
			First(&catalog).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errProductGroupNotFound
			}
			return err
		}

		duplicate, err := productGroupNameExists(tx, catalogCardCode, name, 0)
		if err != nil {
			return err
		}
		if duplicate {
			return errProductGroupNameDuplicate
		}

		if err := tx.Create(&productGroup).Error; err != nil {
			if isProductGroupUniqueViolation(err) {
				return errProductGroupNameDuplicate
			}
			return err
		}
		return nil
	})
	if errors.Is(err, errProductGroupNotFound) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Katalog tidak ditemukan"})
	}
	if errors.Is(err, errProductGroupNameDuplicate) {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error()})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal membuat kelompok produk",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(productGroup)
}

func UpdateProductGroup(c *fiber.Ctx) error {
	productGroupID, err := parsePositiveUintParam(c.Params("id"), "ID kelompok")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	var input updateProductGroupInput
	if err := decodeStrictProductJSON(c, &input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Payload kelompok produk tidak valid: " + err.Error(),
		})
	}
	markupPercent, markupPresent, err := parseNullableMarkupPercent(input.MarkupPercent)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if input.Name == nil && input.SortOrder == nil && input.IsActive == nil && !markupPresent {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Tidak ada perubahan yang diizinkan",
		})
	}

	updates := make(map[string]interface{}, 4)
	if input.Name != nil {
		name, err := normalizeProductGroupName(*input.Name)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		}
		updates["name"] = name
	}
	if input.SortOrder != nil {
		if err := validateProductGroupSortOrder(*input.SortOrder); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		}
		updates["sort_order"] = *input.SortOrder
	}
	if input.IsActive != nil {
		updates["is_active"] = *input.IsActive
	}
	if markupPresent {
		updates["markup_percent"] = markupPercent
	}

	var productGroup models.ProductGroup
	err = database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			First(&productGroup, productGroupID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errProductGroupNotFound
			}
			return err
		}

		if name, changesName := updates["name"].(string); changesName {
			duplicate, err := productGroupNameExists(tx, productGroup.CatalogCardCode, name, productGroup.ID)
			if err != nil {
				return err
			}
			if duplicate {
				return errProductGroupNameDuplicate
			}
		}

		if err := tx.Model(&productGroup).Updates(updates).Error; err != nil {
			if isProductGroupUniqueViolation(err) {
				return errProductGroupNameDuplicate
			}
			return err
		}
		return nil
	})
	if errors.Is(err, errProductGroupNotFound) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}
	if errors.Is(err, errProductGroupNameDuplicate) {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error()})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal memperbarui kelompok produk",
		})
	}
	if markupPresent {
		productGroup.MarkupPercent = markupPercent
	}

	return c.JSON(productGroup)
}

func DeleteProductGroup(c *fiber.Ctx) error {
	productGroupID, err := parsePositiveUintParam(c.Params("id"), "ID kelompok")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	var unassigned int64
	err = database.DB.Transaction(func(tx *gorm.DB) error {
		var productGroup models.ProductGroup
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			First(&productGroup, productGroupID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errProductGroupNotFound
			}
			return err
		}

		result := tx.Model(&models.Product{}).
			Where("product_group_id = ?", productGroup.ID).
			Updates(map[string]interface{}{
				"product_group_id": nil,
				"sort_order":       0,
			})
		if result.Error != nil {
			return result.Error
		}
		unassigned = result.RowsAffected

		return tx.Delete(&productGroup).Error
	})
	if errors.Is(err, errProductGroupNotFound) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal menghapus kelompok produk",
		})
	}

	return c.JSON(fiber.Map{
		"message":    "Kelompok produk dihapus",
		"unassigned": unassigned,
	})
}

func AssignProductsToGroup(c *fiber.Ctx) error {
	productGroupID, err := parsePositiveUintParam(c.Params("id"), "ID kelompok")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	productIDs, err := decodeProductGroupProductIDs(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	var matched int64
	var updated int64
	err = database.DB.Transaction(func(tx *gorm.DB) error {
		var productGroup models.ProductGroup
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			First(&productGroup, productGroupID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errProductGroupNotFound
			}
			return err
		}

		products := make([]models.Product, 0, len(productIDs))
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Select("id", "catalog_cardcode").
			Where("id IN ?", productIDs).
			Find(&products).Error; err != nil {
			return err
		}
		matched = int64(len(products))
		if len(products) != len(productIDs) {
			return errProductNotFound
		}
		for _, product := range products {
			if product.CatalogCardCode != productGroup.CatalogCardCode {
				return errProductCatalogMismatch
			}
		}

		result := tx.Model(&models.Product{}).
			Where("id IN ?", productIDs).
			Updates(map[string]interface{}{
				"product_group_id": productGroup.ID,
				"sort_order":       0,
			})
		if result.Error != nil {
			return result.Error
		}
		updated = result.RowsAffected
		return nil
	})
	if errors.Is(err, errProductGroupNotFound) || errors.Is(err, errProductNotFound) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}
	if errors.Is(err, errProductCatalogMismatch) {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{"error": err.Error()})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal memasukkan produk ke kelompok",
		})
	}

	return c.JSON(fiber.Map{
		"message":   "Produk berhasil dimasukkan ke kelompok",
		"requested": len(productIDs),
		"matched":   matched,
		"updated":   updated,
	})
}

func UnassignProductsFromGroups(c *fiber.Ctx) error {
	productIDs, err := decodeProductGroupProductIDs(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	var matched int64
	var updated int64
	err = database.DB.Transaction(func(tx *gorm.DB) error {
		products := make([]models.Product, 0, len(productIDs))
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Select("id").
			Where("id IN ?", productIDs).
			Find(&products).Error; err != nil {
			return err
		}
		matched = int64(len(products))
		if len(products) != len(productIDs) {
			return errProductNotFound
		}

		result := tx.Model(&models.Product{}).
			Where("id IN ?", productIDs).
			Updates(map[string]interface{}{
				"product_group_id": nil,
				"sort_order":       0,
			})
		if result.Error != nil {
			return result.Error
		}
		updated = result.RowsAffected
		return nil
	})
	if errors.Is(err, errProductNotFound) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal mengeluarkan produk dari kelompok",
		})
	}

	return c.JSON(fiber.Map{
		"message":   "Produk berhasil dikeluarkan dari kelompok",
		"requested": len(productIDs),
		"matched":   matched,
		"updated":   updated,
	})
}

func RemoveProductFromGroup(c *fiber.Ctx) error {
	productGroupID, err := parsePositiveUintParam(c.Params("id"), "ID kelompok")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	productID, err := parsePositiveUintParam(c.Params("productId"), "ID produk")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	err = database.DB.Transaction(func(tx *gorm.DB) error {
		var productGroup models.ProductGroup
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Select("id").
			First(&productGroup, productGroupID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errProductGroupNotFound
			}
			return err
		}

		var product models.Product
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Select("id", "product_group_id").
			First(&product, productID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errProductNotFound
			}
			return err
		}
		if product.ProductGroupID == nil || *product.ProductGroupID != productGroup.ID {
			return errProductNotInGroup
		}

		return tx.Model(&product).Updates(map[string]interface{}{
			"product_group_id": nil,
			"sort_order":       0,
		}).Error
	})
	if errors.Is(err, errProductGroupNotFound) || errors.Is(err, errProductNotFound) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}
	if errors.Is(err, errProductNotInGroup) {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error()})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal mengeluarkan produk dari kelompok",
		})
	}

	return c.JSON(fiber.Map{"message": "Produk berhasil dikeluarkan dari kelompok"})
}

func decodeProductGroupProductIDs(c *fiber.Ctx) ([]uint, error) {
	var input productGroupProductsInput
	if err := decodeStrictProductJSON(c, &input); err != nil {
		return nil, fmt.Errorf("payload produk tidak valid: %w", err)
	}

	productIDs, err := normalizeBulkProductIDs(input.ProductIDs)
	if err != nil {
		return nil, err
	}
	return productIDs, nil
}
