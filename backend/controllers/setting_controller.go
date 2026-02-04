package controllers

import (
	"github.com/derry/anggijajan-v2-backend/database"
	"github.com/derry/anggijajan-v2-backend/models"
	"github.com/gofiber/fiber/v2"
)

// GET: Ambil Semua Setting
func GetSettings(c *fiber.Ctx) error {
	var settings []models.Setting
	database.DB.Find(&settings)
	return c.JSON(settings)
}

// PUT: Update Setting
func UpdateSettings(c *fiber.Ctx) error {
	var input map[string]string
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}

	for key, value := range input {
		// Update atau Create jika belum ada
		var setting models.Setting
		if err := database.DB.Where("key = ?", key).First(&setting).Error; err != nil {
			// Kalau belum ada, create baru
			database.DB.Create(&models.Setting{Key: key, Value: value})
		} else {
			// Kalau ada, update
			setting.Value = value
			database.DB.Save(&setting)
		}
	}

	return c.JSON(fiber.Map{"message": "Settings updated!"})
}
