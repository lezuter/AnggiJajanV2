package controllers

import (
	"fmt"
	"net/url"
	"strings"
	"unicode"

	"github.com/derry/anggijajan-v2-backend/database"
	"github.com/derry/anggijajan-v2-backend/models"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func isValidPaymentLogoURL(value string) bool {
	value = strings.TrimSpace(value)
	if value == "" {
		return true
	}
	if len(value) > 2048 ||
		strings.IndexFunc(value, unicode.IsControl) >= 0 {
		return false
	}

	if strings.HasPrefix(value, "/") {
		return !strings.HasPrefix(value, "//") &&
			!strings.Contains(value, `\`) &&
			!strings.Contains(value, "..")
	}

	parsed, err := url.Parse(value)
	return err == nil &&
		strings.EqualFold(parsed.Scheme, "https") &&
		parsed.Host != "" &&
		parsed.User == nil
}

func validateSettingValue(key, value string) error {
	if strings.HasPrefix(key, midtransPaymentLogoSettingPrefix) &&
		!isValidPaymentLogoURL(value) {
		return fmt.Errorf(
			"%s hanya menerima path lokal /... atau URL https://",
			key,
		)
	}
	return nil
}

// GET: Ambil Semua Setting
func GetSettings(c *fiber.Ctx) error {
	var settings []models.Setting
	if err := database.DB.Order("key ASC").Find(&settings).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal mengambil settings",
		})
	}
	return c.JSON(settings)
}

// PUT: Update Setting
func UpdateSettings(c *fiber.Ctx) error {
	var input map[string]string
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid Input",
		})
	}
	if len(input) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Tidak ada setting yang dikirim",
		})
	}

	validated := make(map[string]string, len(input))
	for rawKey, rawValue := range input {
		key := strings.TrimSpace(rawKey)
		value := strings.TrimSpace(rawValue)
		if key == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Key setting tidak boleh kosong",
			})
		}
		if err := validateSettingValue(key, value); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": err.Error(),
			})
		}
		validated[key] = value
	}

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		for key, value := range validated {
			var setting models.Setting
			if err := tx.
				Where("key = ?", key).
				Assign(models.Setting{Value: value}).
				FirstOrCreate(&setting, models.Setting{Key: key}).
				Error; err != nil {
				return fmt.Errorf("gagal menyimpan %s: %w", key, err)
			}
		}
		return nil
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Settings gagal disimpan",
		})
	}

	invalidateMidtransPaymentLogoCache()
	return c.JSON(fiber.Map{"message": "Settings updated!"})
}
