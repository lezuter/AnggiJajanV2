package controllers

import (
	"strings"

	"github.com/derry/anggijajan-v2-backend/database"
	"github.com/derry/anggijajan-v2-backend/models"
	"github.com/gofiber/fiber/v2"
)

// --- 1. GET ALL CATALOGS (ADMIN) ---
func GetAdminCatalogs(c *fiber.Ctx) error {
	var catalogs []models.Catalog
	database.DB.Order("created_at desc").Find(&catalogs) //
	return c.JSON(catalogs)
}

// --- 2. GET PUBLIC CATALOGS (Yg Aktif Aja) ---
func GetCatalogs(c *fiber.Ctx) error {
	var catalogs []models.Catalog
	// Cuma ambil yang IsActive = true
	database.DB.Where("is_active = ?", true).Order("name asc").Find(&catalogs)
	return c.JSON(catalogs)
}

// --- 3. GET CATALOG BY SLUG (Detail) ---
func GetCatalogBySlug(c *fiber.Ctx) error {
	slug := c.Params("slug")
	var catalog models.Catalog

	// Preload Products biar sekalian dapet list produknya
	if err := database.DB.Preload("Products", "is_active = ?", true).Where("slug = ? AND is_active = ?", slug, true).First(&catalog).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Catalog not found"})
	}

	return c.JSON(catalog)
}

// --- 4. CREATE CATALOG ---
func CreateCatalog(c *fiber.Ctx) error {
	var input models.Catalog
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}

	// Auto Generate Slug kalo kosong (Simple version)
	if input.Slug == "" {
		input.Slug = strings.ToLower(strings.ReplaceAll(input.Name, " ", "-"))
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

	// Parsing Input
	var input models.Catalog
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid input"})
	}

	// Update Field
	catalog.Name = input.Name
	catalog.ImageURL = input.ImageURL

	// 👇 INI YANG PENTING BOS! (Biar kesimpen)
	catalog.CheckIDCode = input.CheckIDCode
	catalog.IsActive = input.IsActive // Biar statusnya ngikut input

	// Save changes
	database.DB.Save(&catalog)

	return c.JSON(catalog)
}

// --- 6. DELETE CATALOG ---
func DeleteCatalog(c *fiber.Ctx) error {
	id := c.Params("id")
	var catalog models.Catalog

	if err := database.DB.First(&catalog, "card_code = ?", id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Catalog not found"})
	}

	database.DB.Delete(&catalog)
	return c.JSON(fiber.Map{"message": "Catalog deleted"})
}
