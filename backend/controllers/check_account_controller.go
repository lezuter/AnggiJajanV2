package controllers

import (
	"crypto/md5"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/derry/anggijajan-v2-backend/database" // Import Database
	"github.com/derry/anggijajan-v2-backend/models"   // Import Models

	"github.com/gofiber/fiber/v2"
)

// Request dari Frontend
type CheckAccountRequest struct {
	Slug   string `json:"slug"` // mobile-legends
	UserID string `json:"user_id"`
	ZoneID string `json:"zone_id"`
}

// Response ke Frontend
type CheckAccountResponse struct {
	Valid    bool   `json:"valid"`
	Nickname string `json:"nickname"`
	Message  string `json:"message"`
}

type DigiflazzRequest struct {
	Username string `json:"username"`
	BuyerSku string `json:"buyer_sku_code"`
	Customer string `json:"customer_no"`
	RefID    string `json:"ref_id"`
	Sign     string `json:"sign"`
	Testing  bool   `json:"testing"`
}

type DigiflazzResponse struct {
	Data struct {
		SN      string `json:"sn"`
		Message string `json:"message"`
		Status  string `json:"status"`
		Rc      string `json:"rc"`
	} `json:"data"`
}

func CheckAccount(c *fiber.Ctx) error {
	req := new(CheckAccountRequest)
	if err := c.BodyParser(req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	// 1. CARI KATALOG DI DATABASE BERDASARKAN SLUG
	var catalog models.Catalog
	if err := database.DB.Where("slug = ?", req.Slug).First(&catalog).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Game tidak ditemukan"})
	}

	// 2. CEK APAKAH GAME INI PUNYA KODE CEK ID?
	if catalog.CheckIDCode == "" {
		return c.Status(400).JSON(CheckAccountResponse{
			Valid:   false,
			Message: "Game ini tidak mendukung Cek ID",
		})
	}

	// Gabungin ID + Zone
	customerNo := req.UserID
	if req.ZoneID != "" {
		customerNo = req.UserID + req.ZoneID
	}

	// 3. PERSIAPAN DATA DIGIFLAZZ
	username := os.Getenv("DIGIFLAZZ_USERNAME")
	apiKey := os.Getenv("DIGIFLAZZ_API_KEY")
	refID := fmt.Sprintf("CEK-%d", time.Now().UnixNano())

	// Signature MD5
	signStr := username + apiKey + refID
	hash := md5.Sum([]byte(signStr))
	signature := fmt.Sprintf("%x", hash)

	digiPayload := DigiflazzRequest{
		Username: username,
		BuyerSku: catalog.CheckIDCode, // 👈 PAKE KODE DARI DATABASE
		Customer: customerNo,
		RefID:    refID,
		Sign:     signature,
		Testing:  false,
	}

	// 4. TEMBAK API DIGIFLAZZ
	jsonValue, _ := json.Marshal(digiPayload)
	resp, err := http.Post("https://api.digiflazz.com/v1/transaction", "application/json", strings.NewReader(string(jsonValue)))

	if err != nil {
		return c.Status(500).JSON(CheckAccountResponse{Valid: false, Message: "Koneksi ke Digiflazz Gagal"})
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var digiResp DigiflazzResponse
	json.Unmarshal(body, &digiResp)

	// 5. PARSING HASIL
	if digiResp.Data.Rc == "00" || digiResp.Data.Status == "Sukses" {
		rawNick := digiResp.Data.SN
		nickname := rawNick

		if strings.Contains(rawNick, "/") {
			parts := strings.Split(rawNick, "/")
			nickname = parts[0]
		}

		return c.JSON(CheckAccountResponse{
			Valid:    true,
			Nickname: nickname,
			Message:  "Success",
		})
	}

	return c.JSON(CheckAccountResponse{
		Valid:   false,
		Message: "ID Tidak Ditemukan / Salah",
	})
}
