package controllers

import (
	"bytes"
	"crypto/hmac"
	"crypto/md5"
	"crypto/sha256" // TAMBAHIN INI BUAT GENERATE SIGNATURE TRIPAY
	"encoding/hex"  // TAMBAHIN INI BUAT ENCODE SIGNATURE TRIPAY
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/derry/anggijajan-v2-backend/database"
	"github.com/derry/anggijajan-v2-backend/models"

	"github.com/gofiber/fiber/v2"
)

func GetTransactions(c *fiber.Ctx) error {
	var trxs []models.Transaction
	database.DB.Preload("Product").Order("created_at desc").Find(&trxs)
	return c.JSON(trxs)
}

func ManualOrder(c *fiber.Ctx) error {
	// 1. Ambil Input
	var req models.ManualOrderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Input tidak valid"})
	}

	// 2. Cari Produk
	var p models.Product
	if err := database.DB.Where("code = ?", req.SKU).First(&p).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Produk tidak ditemukan"})
	}

	// 3. Generate Invoice
	invoiceID := fmt.Sprintf("INV-MANUAL-%d", time.Now().UnixNano()/1000000)

	// 4. EKSEKUSI KE PROVIDER
	statusProvider, snProvider, err := ProcessTopup(invoiceID, p, req.TargetID)
	if err != nil {
		fmt.Println("Gagal Proses ke Provider:", err)
	}

	// 5. Analisa Hasil (Pake Switch Case biar Linter Seneng)
	status := "PENDING"
	digiStatus := "Pending"
	message := "Proses..."
	sn := snProvider
	capital := p.Price / 1.05

	// 🔥 INI PERUBAHANNYA (IF -> SWITCH)
	switch statusProvider {
	case "SUCCESS":
		status = "PAID"
		digiStatus = "Sukses"
		message = "Topup Berhasil"
	case "FAILED":
		status = "FAILED"
		digiStatus = "Gagal"
		message = snProvider // Isi pesan error
	}

	// 6. Simpan Transaksi
	trx := models.Transaction{
		InvoiceID:     invoiceID,
		ProductID:     p.ID,
		CustomerPhone: req.TargetID,
		Amount:        p.Price,
		Capital:       capital,
		Profit:        p.Price - capital,
		Status:        status,
		DigiStatus:    digiStatus,
		PaymentMethod: "MANUAL/CASH",
		Reference:     "ADMIN-" + req.TargetID,
		SN:            sn,
	}

	if err := database.DB.Create(&trx).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal simpan transaksi ke DB"})
	}

	return c.JSON(fiber.Map{
		"message": message,
		"data":    trx,
	})
}

func Checkout(c *fiber.Ctx) error {
	var req models.CheckoutRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid"})
	}

	var p models.Product
	if err := database.DB.First(&p, req.ProductID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Produk ga ada"})
	}

	// ❌ HAPUS BAGIAN INI (INI BIANG KEROKNYA)
	// if p.Stock != -1 && p.Stock <= 0 {
	//    return c.Status(400).JSON(fiber.Map{"error": "Stok Habis"})
	// }

	// ✅ GANTI JADI INI (LOGIC BADAK 🦏)
	// Kita cuma nolak kalau statusnya emang dimatiin dari pusat
	if !p.IsActive {
		return c.Status(400).JSON(fiber.Map{"error": "Maaf, produk ini sedang GANGGUAN dari pusat."})
	}

	rand.Seed(time.Now().UnixNano())
	invoiceID := fmt.Sprintf("INV-%d", rand.Intn(1000000))

	// Request ke Tripay
	tripay, err := requestTripay(invoiceID, int(p.Price), req.PaymentMethod, p.Name, req.CustomerPhone)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Koneksi ke Tripay Gagal"})
	}

	if !tripay.Success {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal Request Tripay", "reason": tripay.Message})
	}

	// Simpan ke Database
	trx := models.Transaction{
		InvoiceID: invoiceID, ProductID: p.ID, CustomerPhone: req.CustomerPhone,
		Amount: p.Price, Status: "UNPAID", PaymentMethod: req.PaymentMethod,
		PaymentURL: tripay.Data.CheckoutURL, Reference: tripay.Data.Reference, SN: "",
	}
	database.DB.Create(&trx)

	return c.JSON(fiber.Map{
		"message": "Success",
		"data":    tripay.Data,
	})
}

func TripayCallbackHandler(c *fiber.Ctx) error {
	var cb models.TripayCallback
	if err := c.BodyParser(&cb); err != nil {
		return c.JSON(fiber.Map{"success": false})
	}

	switch cb.Status {
	case "PAID":
		var trx models.Transaction
		if err := database.DB.Preload("Product").Where("invoice_id = ?", cb.MerchantRef).First(&trx).Error; err == nil && trx.Status != "PAID" {

			// 1. Update Status Database Jadi PAID dulu
			trx.Status = "PAID"
			database.DB.Save(&trx)

			// 2. TEMBAK DIGIFLAZZ
			digiResp, err := topupDigiflazz(trx.InvoiceID, trx.Product.Code, trx.CustomerPhone)

			if err != nil {
				trx.SN = "PENDING-DIGI-ERROR"
				fmt.Println("Error Digiflazz Connection:", err)
			} else if digiResp.Data.Rc != "00" && digiResp.Data.Rc != "03" {
				// Kalau Digiflazz nolak (Saldo habis / Signature salah)
				trx.SN = "GAGAL: " + digiResp.Data.Message

				// ❌ JANGAN DIMATIIN DULU BIAR USER SENENG
				// trx.Status = "FAILED"  <-- Hapus atau komen baris ini

				fmt.Println("❌ Digiflazz Gagal tapi Transaksi tetap PAID:", digiResp.Data.Message)
			} else {
				// SUKSES
				trx.SN = digiResp.Data.Sn
				if trx.SN == "" {
					trx.SN = "PROSES-" + digiResp.Data.RefID
				}
			}

			// Simpan update SN terakhir (Status tetap PAID)
			database.DB.Save(&trx)
		}
	case "EXPIRED", "FAILED":
		database.DB.Model(&models.Transaction{}).Where("invoice_id = ?", cb.MerchantRef).Update("status", cb.Status)
	}
	return c.JSON(fiber.Map{"success": true})
}

func SearchOrder(c *fiber.Ctx) error {
	var req models.SearchOrderRequest
	c.BodyParser(&req)
	var trx models.Transaction
	if err := database.DB.Preload("Product").Where("invoice_id = ?", req.InvoiceID).First(&trx).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Not Found"})
	}
	return c.JSON(trx)
}

// --- HELPER TRIPAY ---
// Update Struct ini biar nangkep QR URL dan Amount
type tripayResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    struct {
		Reference   string `json:"reference"`
		MerchantRef string `json:"merchant_ref"`
		CheckoutURL string `json:"checkout_url"`
		QrUrl       string `json:"qr_url"`   // 👈 INI PENTING (Buat Gambar QR)
		PayCode     string `json:"pay_code"` // (Buat Kode Bayar/VA)
		Amount      int    `json:"amount"`   // (Buat Nominal)
	} `json:"data"`
}

func requestTripay(invoiceID string, amount int, method string, productName string, phone string) (tripayResponse, error) {
	apiKey := os.Getenv("TRIPAY_API_KEY")
	privateKey := os.Getenv("TRIPAY_PRIVATE_KEY")
	merchantCode := os.Getenv("TRIPAY_MERCHANT_CODE")
	mode := os.Getenv("TRIPAY_MODE")

	baseURL := "https://tripay.co.id/api-sandbox/transaction/create"
	if mode == "production" {
		baseURL = "https://tripay.co.id/api/transaction/create"
	}

	signatureStr := fmt.Sprintf("%s%s%d", merchantCode, invoiceID, amount)
	h := hmac.New(sha256.New, []byte(privateKey))
	h.Write([]byte(signatureStr))
	signature := hex.EncodeToString(h.Sum(nil))

	payload := map[string]interface{}{
		"method": method, "merchant_ref": invoiceID, "amount": amount,
		"customer_name": "Pelanggan AnggiJajan", "customer_email": "customer@anggijajan.com", "customer_phone": phone,
		"order_items":  []map[string]interface{}{{"sku": "PROD-01", "name": productName, "price": amount, "quantity": 1}},
		"callback_url": "http://domain-lu.com/api/callback",
		"expired_time": (time.Now().Add(24 * time.Hour)).Unix(), "signature": signature,
	}

	jsonPayload, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", baseURL, bytes.NewBuffer(jsonPayload))
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return tripayResponse{}, err
	}
	defer resp.Body.Close()

	var tripayResp tripayResponse
	json.NewDecoder(resp.Body).Decode(&tripayResp)
	return tripayResp, nil
}

// --- HELPER DIGIFLAZZ ---

type digiflazzResponse struct {
	Data struct {
		RefID   string `json:"ref_id"`
		Status  string `json:"status"`
		Rc      string `json:"rc"`
		Sn      string `json:"sn"`
		Message string `json:"message"`
	} `json:"data"`
}

func topupDigiflazz(invoiceID string, sku string, customerNo string) (digiflazzResponse, error) {
	username := strings.TrimSpace(os.Getenv("DIGIFLAZZ_USERNAME"))
	apiKey := strings.TrimSpace(os.Getenv("DIGIFLAZZ_API_KEY"))
	url := "https://api.digiflazz.com/v1/transaction"

	// 🔥 TRIK: RefID + Timestamp biar selalu dianggap BARU
	// Contoh: INV-8019-17092833
	uniqueRefID := fmt.Sprintf("%s-%d", invoiceID, time.Now().Unix())

	// 1. Log Debugging (Buat mastiin Key lu udah berubah)
	fmt.Println("================ DEBUG KUNCI ===============")
	fmt.Println("🔑 API Key Terpakai :", apiKey) // Cek 5 huruf awal/akhir, sama gak kayak di dashboard?
	fmt.Println("🆔 RefID Unik       :", uniqueRefID)

	// 2. Bikin Signature
	signStr := username + apiKey + uniqueRefID
	hasher := md5.New()
	hasher.Write([]byte(signStr))
	sign := hex.EncodeToString(hasher.Sum(nil))

	payload := map[string]interface{}{
		"username":       username,
		"buyer_sku_code": sku,
		"customer_no":    customerNo,
		"ref_id":         uniqueRefID, // 👈 Pake yang unik
		"sign":           sign,
		"testing":        false, // Karena lu udah Production, ini WAJIB FALSE
	}

	jsonPayload, _ := json.Marshal(payload)

	// Kirim Request...
	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(jsonPayload))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return digiflazzResponse{}, err
	}
	defer resp.Body.Close()

	var result digiflazzResponse
	json.NewDecoder(resp.Body).Decode(&result)

	return result, nil
}

// Cek Status Transaksi (Buat Polling Frontend)
func CheckTransactionStatus(c *fiber.Ctx) error {
	invoiceID := c.Params("invoice")
	var trx models.Transaction

	// Cari transaksi berdasarkan Merchant Ref (Invoice ID)
	if err := database.DB.Where("invoice_id = ?", invoiceID).First(&trx).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"status": "NOT_FOUND"})
	}

	return c.JSON(fiber.Map{
		"status": trx.Status, // UNPAID, PAID, FAILED, EXPIRED
		"sn":     trx.SN,     // Sekalian kirim SN kalau sukses
	})
}

// Helper Pintar: Router Provider
func ProcessTopup(invoiceID string, product models.Product, target string) (string, string, error) {
	// Cek Provider dari Database Produk
	switch product.Provider {

	case "digiflazz":
		// Panggil Logic Digiflazz yang lama
		resp, err := topupDigiflazz(invoiceID, product.Code, target)
		if err != nil {
			return "", "", err
		}
		// Mapping response Digiflazz ke format standar kita
		status := "PENDING"
		sn := resp.Data.Sn
		if resp.Data.Rc == "00" {
			status = "SUCCESS"
		} else if resp.Data.Rc != "03" { // 03 itu pending
			status = "FAILED"
			sn = resp.Data.Message // Simpan pesan error di SN
		}
		return status, sn, nil

	case "apigames":
		// Nanti lu bikin fungsi topupApiGames() disini
		// return topupApiGames(invoiceID, product.Code, target)
		return "FAILED", "ApiGames Belum Disetting", nil

	case "manual":
		// Kalau manual, admin yang proses sendiri nanti
		return "PENDING", "Menunggu Proses Admin", nil

	default:
		return "FAILED", "Provider Tidak Dikenal", fmt.Errorf("provider unknown: %s", product.Provider)
	}
}
