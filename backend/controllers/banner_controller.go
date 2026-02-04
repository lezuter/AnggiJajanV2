package controllers

import (
	"time"

	"github.com/derry/anggijajan-v2-backend/database"
	"github.com/derry/anggijajan-v2-backend/models"

	"github.com/gofiber/fiber/v2"
)

// --- 1. PUBLIC: Cuma yang Aktif & Belum Basi ---
func GetPublicBanners(c *fiber.Ctx) error {
	var b []models.Banner
	now := time.Now()

	// Logic: (Aktif = TRUE) DAN (ExpiresAt NULL atau ExpiresAt > SEKARANG)
	database.DB.Where("is_active = ?", true).
		Where("expires_at IS NULL OR expires_at > ?", now).
		Order("created_at desc").
		Find(&b)

	return c.JSON(b)
}

// --- 2. ADMIN: Ambil Semua (Termasuk Expired) ---
func GetAdminBanners(c *fiber.Ctx) error {
	var b []models.Banner
	database.DB.Order("created_at desc").Find(&b)
	return c.JSON(b)
}

// --- 3. CREATE ---
func CreateBanner(c *fiber.Ctx) error {
	banner := new(models.Banner)
	if err := c.BodyParser(banner); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Gagal parsing data"})
	}
	database.DB.Create(&banner)
	return c.JSON(banner)
}

// --- 4. UPDATE (Termasuk Ganti Status & Target URL) ---
func UpdateBanner(c *fiber.Ctx) error {
	id := c.Params("id")
	var banner models.Banner

	if err := database.DB.First(&banner, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Banner gak ketemu"})
	}

	var input models.Banner
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Input error"})
	}

	// Update Field Penting Aja
	banner.ImageURL = input.ImageURL
	banner.TargetURL = input.TargetURL
	banner.ExpiresAt = input.ExpiresAt
	banner.IsActive = input.IsActive

	database.DB.Save(&banner)
	return c.JSON(banner)
}

// --- 5. DELETE ---
func DeleteBanner(c *fiber.Ctx) error {
	id := c.Params("id")
	var banner models.Banner
	if err := database.DB.First(&banner, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Banner gak ketemu"})
	}
	database.DB.Delete(&banner)
	return c.JSON(fiber.Map{"message": "Dihapus"})
}
