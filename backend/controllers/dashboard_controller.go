package controllers

import (
	"bytes"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"time"

	"github.com/derry/anggijajan-v2-backend/database"
	"github.com/derry/anggijajan-v2-backend/models"

	"github.com/gofiber/fiber/v2"
)

// Struct buat Payload ke Digiflazz
type DigiBalancePayload struct {
	Cmd      string `json:"cmd"`
	Username string `json:"username"`
	Sign     string `json:"sign"`
}

type DigiBalanceResponse struct {
	Data struct {
		Deposit float64 `json:"deposit"` // Digiflazz balikinnya angka/float
	} `json:"data"`
}

func GetDashboardStats(c *fiber.Ctx) error {
	var totalIncome float64
	var totalTrx int64
	var totalProducts int64
	var expiredBanners int64 // [BARU] Variabel buat nampung jumlah banner basi
	recentTrx := []models.Transaction{}

	// Hitung Statistik
	var totalAmount float64
	database.DB.Model(&models.Transaction{}).Where("status = ?", "PAID").Select("COALESCE(SUM(amount), 0)").Scan(&totalAmount)
	database.DB.Model(&models.Transaction{}).Count(&totalTrx)
	database.DB.Model(&models.Product{}).Count(&totalProducts)

	// [BARU] Hitung Banner yang Expired (Waktu Expires < Waktu Sekarang)
	database.DB.Model(&models.Banner{}).Where("expires_at < ?", time.Now()).Count(&expiredBanners)

	database.DB.Preload("Product").Order("created_at desc").Limit(5).Find(&recentTrx)

	return c.JSON(fiber.Map{
		"income":          totalIncome,
		"transactions":    totalTrx,
		"products":        totalProducts,
		"expired_banners": expiredBanners, // [BARU] Kirim ke frontend
		"recent":          recentTrx,
	})
}

// FUNGSI CEK SALDO DIGIFLAZZ
func GetDigiflazzBalance(c *fiber.Ctx) error {
	username := os.Getenv("DIGIFLAZZ_USERNAME")
	apiKey := os.Getenv("DIGIFLAZZ_API_KEY")

	// 1. Bikin Signature (MD5: username + key + "depo")
	// Logic sama persis kayak V1 admin.js baris 112
	signStr := username + apiKey + "depo"
	hash := md5.Sum([]byte(signStr))
	signature := hex.EncodeToString(hash[:])

	// 2. Siapin Payload
	payload := DigiBalancePayload{
		Cmd:      "deposit",
		Username: username,
		Sign:     signature,
	}

	jsonPayload, _ := json.Marshal(payload)

	// 3. Tembak ke Digiflazz
	resp, err := http.Post("https://api.digiflazz.com/v1/cek-saldo", "application/json", bytes.NewBuffer(jsonPayload))
	if err != nil {
		return c.JSON(fiber.Map{"balance": 0, "error": "Gagal konek Digiflazz"})
	}
	defer resp.Body.Close()

	// 4. Baca Response
	var result DigiBalanceResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return c.JSON(fiber.Map{"balance": 0, "error": "Response aneh"})
	}

	// 5. Kirim ke Frontend
	return c.JSON(fiber.Map{
		"balance": result.Data.Deposit,
	})
}
