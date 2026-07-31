package controllers

import (
	"bytes"
	"crypto/hmac"
	"crypto/md5"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/derry/anggijajan-v2-backend/database"
	"github.com/derry/anggijajan-v2-backend/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ==========================================
// HELPER: AMBIL USER ID DARI JWT CONTEXT
// ==========================================
func getUserIDFromContext(c *fiber.Ctx) (uint, error) {
	userIDClaim := c.Locals("user_id")
	if userIDClaim == nil {
		return 0, fmt.Errorf("user_id tidak ditemukan di token")
	}

	switch v := userIDClaim.(type) {
	case float64:
		return uint(v), nil
	case int:
		return uint(v), nil
	case uint:
		return v, nil
	case string:
		id, err := strconv.Atoi(v)
		if err != nil {
			return 0, err
		}
		return uint(id), nil
	default:
		return 0, fmt.Errorf("format user_id tidak valid")
	}
}

func providerDisplayName(provider string) string {
	provider = strings.TrimSpace(provider)
	if provider == "" {
		return "UNKNOWN"
	}
	return strings.ToUpper(provider)
}

func recordTransactionActivity(activity models.TransactionActivity, logLabel string) {
	if err := database.DB.Create(&activity).Error; err != nil {
		fmt.Printf("Gagal mencatat activity %s: %v\n", logLabel, err)
	}
}

func isAppDebug() bool {
	return strings.EqualFold(strings.TrimSpace(os.Getenv("APP_DEBUG")), "true")
}

func generateProviderRef(invoiceID string, provider string) string {
	provider = strings.ToLower(strings.TrimSpace(provider))

	switch provider {
	case "digiflazz":
		return fmt.Sprintf("%s-%d", invoiceID, time.Now().Unix())
	case "apigames":
		return fmt.Sprintf("%s-APIGAMES-%d", invoiceID, time.Now().Unix())
	default:
		return fmt.Sprintf("%s-%d", invoiceID, time.Now().Unix())
	}
}

func isFinalFulfillmentStatus(status string) bool {
	return status == "SUCCESS" || status == "FAILED"
}

func ensureProviderSnapshot(trx *models.Transaction) {
	provider := strings.ToLower(strings.TrimSpace(trx.Provider))
	if provider == "" {
		provider = strings.ToLower(strings.TrimSpace(trx.Product.Provider))
	}
	if provider == "" {
		provider = "digiflazz"
	}

	trx.Provider = provider
	if strings.TrimSpace(trx.ProviderSKU) == "" {
		trx.ProviderSKU = trx.Product.Code
	}
	trx.ProviderName = providerDisplayName(trx.Provider)
}

func customerSafeProviderStatus(trx models.Transaction) string {
	switch trx.FulfillmentStatus {
	case "SUCCESS":
		return "Sukses"
	case "FAILED":
		return "Gagal"
	case "PROCESSING":
		return "Diproses"
	case "READY":
		return "Siap Diproses"
	case "WAITING_PAYMENT":
		if trx.PaymentStatus == "EXPIRED" {
			return "Pembayaran Kedaluwarsa"
		}
		if trx.PaymentStatus == "FAILED" {
			return "Pembayaran Gagal"
		}
		return "Menunggu Pembayaran"
	default:
		if strings.TrimSpace(trx.ProviderStatus) != "" {
			return trx.ProviderStatus
		}
		return trx.Status
	}
}

func customerSafeTransactionDTO(trx models.Transaction, includeSensitiveResult bool) fiber.Map {
	productName := strings.TrimSpace(trx.Product.Name)
	if productName == "" {
		productName = "Produk"
	}

	sn := ""
	errorMessage := ""
	if includeSensitiveResult {
		if trx.FulfillmentStatus == "SUCCESS" {
			sn = strings.TrimSpace(trx.SerialNumber)
		}
		if trx.FulfillmentStatus == "FAILED" {
			errorMessage = strings.TrimSpace(trx.ErrorMessage)
			if errorMessage == "" {
				errorMessage = strings.TrimSpace(trx.ProviderStatus)
			}
		}
	}

	return fiber.Map{
		"invoice_id":         trx.InvoiceID,
		"product":            fiber.Map{"name": productName},
		"Product":            fiber.Map{"name": productName},
		"product_name":       productName,
		"target":             trx.CustomerPhone,
		"customer_phone":     trx.CustomerPhone,
		"amount":             trx.Amount,
		"status":             trx.Status,
		"payment_status":     trx.PaymentStatus,
		"fulfillment_status": trx.FulfillmentStatus,
		"provider_status":    customerSafeProviderStatus(trx),
		"serial_number":      sn,
		"sn":                 sn,
		"error_message":      errorMessage,
		"created_at":         trx.CreatedAt,
		"updated_at":         trx.UpdatedAt,
	}
}

func applyProviderResult(trx *models.Transaction, statusProvider string, providerLog string, providerRef string, providerErr error) string {
	message := "Transaksi masih diproses"
	trx.PaymentStatus = "PAID"
	if strings.TrimSpace(providerRef) != "" {
		trx.ProviderRef = providerRef
	}

	if providerErr != nil {
		reason := strings.TrimSpace(providerLog)
		if reason == "" {
			reason = providerErr.Error()
		}
		if reason == "" {
			reason = "Gagal menghubungi provider"
		}

		trx.Status = "FAILED"
		trx.FulfillmentStatus = "FAILED"
		trx.ProviderStatus = "Error"
		trx.SerialNumber = ""
		trx.ErrorMessage = reason

		return reason
	}

	switch statusProvider {
	case "SUCCESS":
		trx.Status = "PAID"
		trx.FulfillmentStatus = "SUCCESS"
		trx.ProviderStatus = "Sukses"
		trx.SerialNumber = providerLog
		trx.ErrorMessage = ""
		message = "Topup Berhasil"

	case "FAILED":
		trx.Status = "FAILED"
		trx.FulfillmentStatus = "FAILED"
		trx.ProviderStatus = "Gagal"
		trx.SerialNumber = ""
		trx.ErrorMessage = providerLog
		message = providerLog

	default:
		trx.Status = "PENDING"
		trx.FulfillmentStatus = "PROCESSING"
		trx.ProviderStatus = "Pending"
		trx.SerialNumber = ""
		trx.ErrorMessage = providerLog
		message = "Transaksi masih diproses"
	}

	return message
}

func saveProviderResultUnlessFinal(
	trx *models.Transaction,
	statusProvider string,
	providerLog string,
	providerRef string,
	providerErr error,
) (string, string, error) {
	message := ""
	resultOldStatus := trx.FulfillmentStatus

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		var lockedTrx models.Transaction
		if err := tx.
			Clauses(clause.Locking{Strength: "UPDATE"}).
			Preload("Product").
			First(&lockedTrx, trx.ID).Error; err != nil {
			return err
		}

		resultOldStatus = lockedTrx.FulfillmentStatus
		if isFinalFulfillmentStatus(lockedTrx.FulfillmentStatus) {
			switch lockedTrx.FulfillmentStatus {
			case "SUCCESS":
				message = "Topup Berhasil"
			case "FAILED":
				message = strings.TrimSpace(lockedTrx.ErrorMessage)
				if message == "" {
					message = "Provider sudah mengembalikan status gagal"
				}
			}

			*trx = lockedTrx
			return nil
		}

		message = applyProviderResult(&lockedTrx, statusProvider, providerLog, providerRef, providerErr)
		if err := tx.Save(&lockedTrx).Error; err != nil {
			return err
		}

		*trx = lockedTrx
		return nil
	})

	return message, resultOldStatus, err
}

func executeProviderForTransaction(c *fiber.Ctx, trx *models.Transaction, userID *uint, requestOldStatus string) (string, error) {
	claimedForProvider := false
	claimOldStatus := strings.TrimSpace(requestOldStatus)

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		var lockedTrx models.Transaction
		if err := tx.
			Clauses(clause.Locking{Strength: "UPDATE"}).
			Preload("Product").
			First(&lockedTrx, trx.ID).Error; err != nil {
			return err
		}

		lockedFulfillment := strings.TrimSpace(lockedTrx.FulfillmentStatus)
		if claimOldStatus == "" {
			claimOldStatus = lockedFulfillment
		}
		if claimOldStatus == "" {
			claimOldStatus = strings.TrimSpace(lockedTrx.Status)
		}

		if isFinalFulfillmentStatus(lockedFulfillment) {
			*trx = lockedTrx
			return nil
		}

		if lockedFulfillment == "PROCESSING" || strings.TrimSpace(lockedTrx.ProviderRef) != "" {
			*trx = lockedTrx
			return nil
		}

		if lockedTrx.PaymentStatus != "PAID" {
			return fmt.Errorf("topup hanya bisa dieksekusi setelah pembayaran PAID")
		}

		if lockedFulfillment != "" && lockedFulfillment != "READY" && lockedFulfillment != "WAITING_PAYMENT" {
			return fmt.Errorf("order belum siap diproses atau sudah dieksekusi")
		}

		ensureProviderSnapshot(&lockedTrx)
		if strings.TrimSpace(lockedTrx.ProviderRef) == "" {
			lockedTrx.ProviderRef = generateProviderRef(lockedTrx.InvoiceID, lockedTrx.Provider)
		}

		lockedTrx.PaymentStatus = "PAID"
		lockedTrx.Status = "PENDING"
		lockedTrx.FulfillmentStatus = "PROCESSING"
		lockedTrx.ProviderStatus = "Processing"

		if err := tx.Save(&lockedTrx).Error; err != nil {
			return err
		}

		*trx = lockedTrx
		claimedForProvider = true
		return nil
	})
	if err != nil {
		return "", err
	}

	if !claimedForProvider {
		if isFinalFulfillmentStatus(trx.FulfillmentStatus) {
			if trx.FulfillmentStatus == "SUCCESS" {
				return "Topup Berhasil", nil
			}

			message := strings.TrimSpace(trx.ErrorMessage)
			if message == "" {
				message = "Provider sudah mengembalikan status gagal"
			}
			return message, nil
		}

		return "Transaksi sedang diproses", nil
	}

	requestActivity := models.TransactionActivity{
		TransactionID: trx.ID,
		UserID:        userID,
		Action:        "PROVIDER_REQUESTED",
		Description:   fmt.Sprintf("Request dikirim ke provider %s dengan SKU %s", trx.ProviderName, trx.ProviderSKU),
		OldStatus:     claimOldStatus,
		NewStatus:     "PROCESSING",
		IPAddress:     c.IP(),
		UserAgent:     string(c.Request().Header.UserAgent()),
	}

	recordTransactionActivity(requestActivity, "provider requested")

	statusProvider, providerLog, err := ProcessTopupWithRef(trx.ProviderRef, trx.Product, trx.CustomerPhone)
	message, resultOldStatus, err := saveProviderResultUnlessFinal(trx, statusProvider, providerLog, trx.ProviderRef, err)
	if err != nil {
		return "", err
	}

	resultActivity := models.TransactionActivity{
		TransactionID: trx.ID,
		UserID:        userID,
		Action:        "PROVIDER_RESULT",
		Description:   fmt.Sprintf("Provider %s mengembalikan status %s", trx.ProviderName, trx.ProviderStatus),
		OldStatus:     resultOldStatus,
		NewStatus:     trx.FulfillmentStatus,
		IPAddress:     c.IP(),
		UserAgent:     string(c.Request().Header.UserAgent()),
	}

	recordTransactionActivity(resultActivity, "provider result")

	return message, nil
}

// ==========================================
// 1. GET TRANSACTIONS
// Server-Side Pagination + Filter + Preload
// ==========================================
func GetTransactions(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "10"))
	search := c.Query("search", "")
	statusFilter := c.Query("status", "")
	providerFilter := strings.TrimSpace(c.Query("provider", ""))
	sourceFilter := strings.ToUpper(strings.TrimSpace(c.Query("source", "")))

	startDate := c.Query("start_date", "")
	endDate := c.Query("end_date", "")

	if page < 1 {
		page = 1
	}

	if limit < 1 || limit > 100 {
		limit = 10
	}

	offset := (page - 1) * limit

	buildTransactionQuery := func() *gorm.DB {
		query := database.DB.
			Model(&models.Transaction{}).
			Joins("LEFT JOIN products ON products.id = transactions.product_id").
			Joins("LEFT JOIN users ON users.id = transactions.created_by_id")

		if startDate != "" && endDate != "" {
			query = query.Where(
				"transactions.created_at >= ? AND transactions.created_at <= ?",
				startDate+" 00:00:00",
				endDate+" 23:59:59",
			)
		}

		if strings.TrimSpace(search) != "" {
			keyword := "%" + strings.TrimSpace(search) + "%"
			query = query.Where(
				`transactions.invoice_id ILIKE ? OR
					transactions.customer_phone ILIKE ? OR
					transactions.reference ILIKE ? OR
					transactions.provider ILIKE ? OR
					transactions.provider_sku ILIKE ? OR
					transactions.provider_ref ILIKE ? OR
					transactions.provider_name ILIKE ? OR
					transactions.error_message ILIKE ? OR
					transactions.serial_number ILIKE ? OR
					products.name ILIKE ? OR
					products.code ILIKE ? OR
					users.name ILIKE ?`,
				keyword,
				keyword,
				keyword,
				keyword,
				keyword,
				keyword,
				keyword,
				keyword,
				keyword,
				keyword,
				keyword,
				keyword,
			)
		}

		switch statusFilter {
		case "ALL", "":
			// no filter
		case "PAID":
			query = query.Where("transactions.status IN ?", []string{"PAID", "SUCCESS"})
		case "PENDING":
			query = query.Where("transactions.status IN ?", []string{"PENDING", "UNPAID"})
		default:
			query = query.Where("transactions.status = ?", statusFilter)
		}

		if providerFilter != "" && strings.ToUpper(providerFilter) != "ALL" {
			query = query.Where("LOWER(transactions.provider) = ?", strings.ToLower(providerFilter))
		}

		switch sourceFilter {
		case "ALL", "":
			// no filter
		case "WEB", "CUSTOMER":
			query = query.Where("transactions.created_via IN ?", []string{"WEB", "CUSTOMER"})
		case "ADMIN":
			query = query.Where("transactions.created_via = ? AND LOWER(users.role) = ?", "ADMIN", "admin")
		case "DEVELOPER":
			query = query.Where("transactions.created_via = ? AND LOWER(users.role) = ?", "ADMIN", "developer")
		case "SYSTEM":
			query = query.Where("transactions.created_via = ?", "SYSTEM")
		}

		return query
	}

	var totalData int64
	if err := buildTransactionQuery().Count(&totalData).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":  "Gagal menghitung data transaksi",
			"detail": err.Error(),
		})
	}

	var summary struct {
		TotalRevenue float64 `json:"total_revenue" gorm:"column:total_revenue"`
		TotalProfit  float64 `json:"total_profit" gorm:"column:total_profit"`
		SuccessCount int64   `json:"success_count" gorm:"column:success_count"`
		FailedCount  int64   `json:"failed_count" gorm:"column:failed_count"`
		PendingCount int64   `json:"pending_count" gorm:"column:pending_count"`
		TotalCount   int64   `json:"total_count" gorm:"column:total_count"`
	}

	if err := buildTransactionQuery().
		Select(`
			COALESCE(SUM(CASE WHEN transactions.status IN ('PAID', 'SUCCESS') THEN transactions.amount ELSE 0 END), 0) AS total_revenue,
			COALESCE(SUM(CASE WHEN transactions.status IN ('PAID', 'SUCCESS') THEN transactions.profit ELSE 0 END), 0) AS total_profit,
			COUNT(CASE WHEN transactions.status IN ('PAID', 'SUCCESS') THEN 1 END) AS success_count,
			COUNT(CASE WHEN transactions.status = 'FAILED' THEN 1 END) AS failed_count,
			COUNT(CASE WHEN transactions.status IN ('PENDING', 'UNPAID') THEN 1 END) AS pending_count,
			COUNT(transactions.id) AS total_count
		`).
		Scan(&summary).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":  "Gagal menghitung summary transaksi",
			"detail": err.Error(),
		})
	}

	var trxs []models.Transaction

	if err := buildTransactionQuery().
		Preload("Product").
		Preload("CreatedBy").
		Preload("LastRetryBy").
		Preload("Activities", func(db *gorm.DB) *gorm.DB {
			return db.Order("created_at ASC")
		}).
		Preload("Activities.User").
		Order("transactions.created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&trxs).Error; err != nil {
		fmt.Println("❌ ERROR GET TRANSACTIONS:", err)

		return c.Status(500).JSON(fiber.Map{
			"error":  "Gagal mengambil data transaksi",
			"detail": err.Error(),
		})
	}

	responseDTO := make([]models.TransactionListDTO, 0, len(trxs))

	for _, trx := range trxs {
		displaySN := trx.SerialNumber
		if displaySN == "" && trx.ErrorMessage != "" {
			displaySN = trx.ErrorMessage
		}

		createdByName := ""
		createdByRole := ""

		if trx.CreatedBy != nil {
			createdByName = trx.CreatedBy.Name
			createdByRole = trx.CreatedBy.Role
		}

		dto := models.TransactionListDTO{
			ID:            trx.ID,
			CreatedAt:     trx.CreatedAt,
			UpdatedAt:     trx.UpdatedAt,
			InvoiceID:     trx.InvoiceID,
			CustomerPhone: trx.CustomerPhone,
			Product: models.MinimalProductDTO{
				ID:   trx.Product.ID,
				Name: trx.Product.Name,
				Code: trx.Product.Code,
			},
			Amount:            trx.Amount,
			Capital:           trx.Capital,
			Profit:            trx.Profit,
			PaymentMethod:     trx.PaymentMethod,
			PaymentURL:        trx.PaymentURL,
			Reference:         trx.Reference,
			Status:            trx.Status,
			PaymentStatus:     trx.PaymentStatus,
			FulfillmentStatus: trx.FulfillmentStatus,
			DigiStatus:        trx.ProviderStatus,
			SN:                displaySN,

			Provider:     trx.Provider,
			ProviderSKU:  trx.ProviderSKU,
			ProviderRef:  trx.ProviderRef,
			ProviderName: trx.ProviderName,

			CreatedVia:      trx.CreatedVia,
			CreatedByName:   createdByName,
			CreatedByRole:   createdByRole,
			RetryCount:      trx.RetryCount,
			ManualOrderType: trx.ManualOrderType,
			Activities:      trx.Activities,
		}

		responseDTO = append(responseDTO, dto)
	}

	totalPages := int(math.Ceil(float64(totalData) / float64(limit)))

	return c.JSON(fiber.Map{
		"data": responseDTO,
		"meta": fiber.Map{
			"total":       totalData,
			"page":        page,
			"limit":       limit,
			"total_pages": totalPages,
		},
		"summary": summary,
	})
}

func GetManualOrderStatus(c *fiber.Ctx) error {
	id := strings.TrimSpace(c.Params("id"))
	if id == "" {
		return c.Status(400).JSON(fiber.Map{"error": "ID transaksi wajib diisi"})
	}

	var trx models.Transaction
	if err := database.DB.
		Preload("Product").
		Where("id = ? AND created_via = ?", id, "ADMIN").
		First(&trx).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Manual order tidak ditemukan"})
		}

		return c.Status(500).JSON(fiber.Map{
			"error":  "Gagal mengambil status manual order",
			"detail": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Status manual order fetched",
		"data":    trx,
	})
}

func GetRunningManualOrders(c *fiber.Ctx) error {
	var trxs []models.Transaction

	if err := database.DB.
		Preload("Product").
		Where("created_via = ?", "ADMIN").
		Where(`
			(
				(payment_status = ? AND fulfillment_status = ?) OR
				(payment_status = ? AND fulfillment_status IN ?)
			)
		`,
			"UNPAID",
			"WAITING_PAYMENT",
			"PAID",
			[]string{"READY", "PROCESSING"},
		).
		Order("created_at DESC").
		Limit(50).
		Find(&trxs).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":  "Gagal mengambil transaksi berjalan",
			"detail": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Running manual orders fetched",
		"data":    trxs,
	})
}

// ==========================================
// 2. MANUAL ORDER
// Flow: Admin membuat QRIS order, konfirmasi bayar, baru eksekusi provider
// Aman: create order tidak menembak provider sebelum payment PAID
// ==========================================
func ManualOrder(c *fiber.Ctx) error {
	var req models.ManualOrderRequest

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Input tidak valid"})
	}

	adminID, err := getUserIDFromContext(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Sesi tidak valid, harap login ulang"})
	}

	if strings.TrimSpace(req.SKU) == "" {
		return c.Status(400).JSON(fiber.Map{"error": "SKU produk wajib diisi"})
	}

	if strings.TrimSpace(req.TargetID) == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Target ID wajib diisi"})
	}

	manualOrderType := strings.TrimSpace(req.ManualOrderType)
	if manualOrderType == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Tipe order wajib dipilih"})
	}

	var p models.Product
	if err := database.DB.Where("code = ?", req.SKU).First(&p).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Produk tidak ditemukan"})
	}

	if !p.IsActive {
		return c.Status(400).JSON(fiber.Map{"error": "Produk sedang tidak aktif"})
	}

	if p.Stock != -1 && p.Stock <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Stok produk sedang kosong"})
	}

	// Hitung modal, harga web, dan validasi harga jual
	capital := math.Round(p.Price)
	webPrice := models.CalculateSellingPrice(capital)

	sellingPrice := math.Round(req.SellingPrice)
	if sellingPrice <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Harga jual wajib diisi"})
	}

	if sellingPrice < capital {
		return c.Status(400).JSON(fiber.Map{
			"error": fmt.Sprintf(
				"Harga jual tidak boleh di bawah modal. Minimal Rp %.0f",
				capital,
			),
		})
	}

	if sellingPrice > webPrice {
		return c.Status(400).JSON(fiber.Map{
			"error": fmt.Sprintf(
				"Harga jual tidak boleh lebih dari harga web. Maksimal Rp %.0f",
				webPrice,
			),
		})
	}

	tripayMaxAmount := 5000000.0
	if sellingPrice > tripayMaxAmount {
		return c.Status(400).JSON(fiber.Map{
			"error": fmt.Sprintf(
				"Nominal QRIS Tripay maksimal Rp %.0f",
				tripayMaxAmount,
			),
		})
	}

	profit := sellingPrice - capital

	invoiceID := fmt.Sprintf("INV-MANUAL-%d", time.Now().UnixNano()/1000000)

	// Simpan sales order dulu. Provider baru dieksekusi dari endpoint terpisah.
	injectReason := strings.TrimSpace(req.InjectReason)
	if injectReason == "" {
		injectReason = manualOrderType
	}

	provider := strings.ToLower(strings.TrimSpace(p.Provider))
	if provider == "" {
		provider = "digiflazz"
	}
	providerName := providerDisplayName(provider)

	tripayMethod := strings.TrimSpace(os.Getenv("TRIPAY_METHOD"))
	if tripayMethod == "" {
		tripayMethod = "QRIS2"
	}

	tripay, err := requestTripay(
		invoiceID,
		int(sellingPrice),
		tripayMethod,
		p.Name,
		req.TargetID,
	)

	if err != nil {
		return c.Status(502).JSON(fiber.Map{
			"error":  "Gagal menghubungi Tripay",
			"reason": err.Error(),
		})
	}

	if !tripay.Success {
		reason := strings.TrimSpace(tripay.Message)
		if reason == "" {
			reason = "Tripay menolak request QRIS"
		}

		return c.Status(400).JSON(fiber.Map{
			"error":  "Gagal membuat QRIS Tripay",
			"reason": reason,
		})
	}

	paymentURL := strings.TrimSpace(tripay.Data.QrUrl)
	if paymentURL == "" {
		paymentURL = strings.TrimSpace(tripay.Data.CheckoutURL)
	}

	if paymentURL == "" {
		return c.Status(500).JSON(fiber.Map{
			"error":  "Tripay berhasil dibuat tapi payment_url kosong",
			"reason": "qr_url dan checkout_url kosong dari response Tripay",
		})
	}

	trx := models.Transaction{
		InvoiceID:         invoiceID,
		ProductID:         p.ID,
		CustomerPhone:     req.TargetID,
		Amount:            sellingPrice,
		Capital:           capital,
		Profit:            profit,
		Status:            "UNPAID",
		PaymentStatus:     "UNPAID",
		FulfillmentStatus: "WAITING_PAYMENT",
		ProviderStatus:    "Waiting Payment",
		PaymentMethod:     tripayMethod,
		PaymentURL:        paymentURL,
		Reference:         tripay.Data.Reference,

		Provider:     provider,
		ProviderSKU:  p.Code,
		ProviderRef:  "",
		ProviderName: providerName,

		CreatedVia:      "ADMIN",
		CreatedByID:     &adminID,
		InjectReason:    injectReason,
		ManualOrderType: manualOrderType,
	}

	if err := database.DB.Create(&trx).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal simpan transaksi ke DB"})
	}

	actorName := fmt.Sprintf("Admin #%d", adminID)
	var admin models.User
	if err := database.DB.First(&admin, adminID).Error; err == nil && strings.TrimSpace(admin.Name) != "" {
		actorName = admin.Name
	}

	createActivity := models.TransactionActivity{
		TransactionID: trx.ID,
		UserID:        &adminID,
		Action:        "MANUAL_ORDER_CREATED",
		Description: fmt.Sprintf(
			"%s membuat transaksi manual untuk produk %s. Modal: Rp %.0f, Harga web: Rp %.0f, Harga jual: Rp %.0f, Profit: Rp %.0f. Tipe: %s. Catatan: %s",
			actorName,
			p.Name,
			capital,
			webPrice,
			sellingPrice,
			profit,
			manualOrderType,
			injectReason,
		),
		OldStatus: "",
		NewStatus: "WAITING_PAYMENT",
		IPAddress: c.IP(),
		UserAgent: string(c.Request().Header.UserAgent()),
	}

	if err := database.DB.Create(&createActivity).Error; err != nil {
		fmt.Println("❌ Gagal mencatat activity manual inject:", err)
	}

	qrisActivity := models.TransactionActivity{
		TransactionID: trx.ID,
		UserID:        &adminID,
		Action:        "QRIS_PAYMENT_CREATED",
		Description:   fmt.Sprintf("QRIS payment dibuat untuk invoice %s senilai Rp %.0f", invoiceID, sellingPrice),
		OldStatus:     "",
		NewStatus:     "UNPAID",
		IPAddress:     c.IP(),
		UserAgent:     string(c.Request().Header.UserAgent()),
	}

	recordTransactionActivity(qrisActivity, "qris payment created")

	return c.JSON(fiber.Map{
		"message": "QRIS order berhasil dibuat",
		"data":    trx,
	})
}

func ExecuteManualOrderProvider(c *fiber.Ctx) error {
	id := c.Params("id")

	adminID, err := getUserIDFromContext(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Sesi tidak valid, harap login ulang"})
	}

	var trx models.Transaction
	if err := database.DB.Preload("Product").First(&trx, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Transaksi manual tidak ditemukan"})
	}

	if trx.CreatedVia != "ADMIN" {
		return c.Status(400).JSON(fiber.Map{"error": "Hanya manual order admin yang bisa dieksekusi di endpoint ini"})
	}

	if trx.PaymentStatus != "PAID" {
		return c.Status(400).JSON(fiber.Map{"error": "Topup hanya bisa dieksekusi setelah pembayaran PAID"})
	}

	if trx.FulfillmentStatus != "READY" {
		return c.Status(400).JSON(fiber.Map{"error": "Order belum siap diproses atau sudah dieksekusi"})
	}

	oldFulfillmentStatus := trx.FulfillmentStatus
	message, err := executeProviderForTransaction(c, &trx, &adminID, oldFulfillmentStatus)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal update hasil provider"})
	}

	return c.JSON(fiber.Map{
		"message": message,
		"data":    trx,
	})
}

func CheckManualOrderProviderStatus(c *fiber.Ctx) error {
	id := c.Params("id")

	adminID, err := getUserIDFromContext(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Sesi tidak valid, harap login ulang"})
	}

	var trx models.Transaction
	if err := database.DB.Preload("Product").First(&trx, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Transaksi manual tidak ditemukan"})
	}

	if trx.CreatedVia != "ADMIN" {
		return c.Status(400).JSON(fiber.Map{"error": "Hanya manual order admin yang bisa dicek di endpoint ini"})
	}

	if trx.PaymentStatus != "PAID" {
		return c.Status(400).JSON(fiber.Map{"error": "Status provider hanya bisa dicek setelah pembayaran PAID"})
	}

	if trx.FulfillmentStatus != "PROCESSING" {
		return c.Status(400).JSON(fiber.Map{"error": "Status provider hanya bisa dicek saat fulfillment PROCESSING"})
	}

	provider := strings.ToLower(strings.TrimSpace(trx.Provider))
	if provider == "" {
		provider = strings.ToLower(strings.TrimSpace(trx.Product.Provider))
	}

	if provider != "digiflazz" {
		return c.Status(400).JSON(fiber.Map{"error": "Resolver status saat ini hanya untuk provider Digiflazz"})
	}

	ensureProviderSnapshot(&trx)

	if strings.TrimSpace(trx.ProviderRef) == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Provider ref kosong, status Digiflazz tidak bisa dicek ulang"})
	}

	if strings.TrimSpace(trx.ProviderSKU) == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Provider SKU kosong, status Digiflazz tidak bisa dicek ulang"})
	}

	resp, err := topupDigiflazz(trx.ProviderRef, trx.ProviderSKU, trx.CustomerPhone)
	if err != nil {
		activity := models.TransactionActivity{
			TransactionID: trx.ID,
			UserID:        &adminID,
			Action:        "PROVIDER_STATUS_CHECKED",
			Description:   "Gagal cek ulang status provider Digiflazz: " + err.Error(),
			OldStatus:     trx.FulfillmentStatus,
			NewStatus:     trx.FulfillmentStatus,
			IPAddress:     c.IP(),
			UserAgent:     string(c.Request().Header.UserAgent()),
		}
		recordTransactionActivity(activity, "provider status checked failed")

		return c.Status(502).JSON(fiber.Map{
			"error":  "Gagal cek status Digiflazz",
			"reason": err.Error(),
		})
	}

	statusProvider, providerLog := mapDigiflazzProviderResult(resp)
	message, resultOldStatus, err := saveProviderResultUnlessFinal(&trx, statusProvider, providerLog, trx.ProviderRef, nil)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal update status provider"})
	}

	checkedActivity := models.TransactionActivity{
		TransactionID: trx.ID,
		UserID:        &adminID,
		Action:        "PROVIDER_STATUS_CHECKED",
		Description:   "Status provider Digiflazz dicek ulang: " + providerLog,
		OldStatus:     resultOldStatus,
		NewStatus:     trx.FulfillmentStatus,
		IPAddress:     c.IP(),
		UserAgent:     string(c.Request().Header.UserAgent()),
	}
	recordTransactionActivity(checkedActivity, "provider status checked")

	if (trx.FulfillmentStatus == "SUCCESS" || trx.FulfillmentStatus == "FAILED") &&
		resultOldStatus != trx.FulfillmentStatus {
		resultActivity := models.TransactionActivity{
			TransactionID: trx.ID,
			UserID:        &adminID,
			Action:        "PROVIDER_RESULT_UPDATED",
			Description:   fmt.Sprintf("Status provider Digiflazz berubah menjadi %s: %s", trx.FulfillmentStatus, providerLog),
			OldStatus:     resultOldStatus,
			NewStatus:     trx.FulfillmentStatus,
			IPAddress:     c.IP(),
			UserAgent:     string(c.Request().Header.UserAgent()),
		}
		recordTransactionActivity(resultActivity, "provider result updated")
	}

	return c.JSON(fiber.Map{
		"message": message,
		"data":    trx,
	})
}

// ==========================================
// 3. CHECKOUT CUSTOMER
// Flow: customer checkout via website + Tripay
// ==========================================
func storefrontProductAvailabilityError(product models.Product) string {
	if !product.AdminEnabled {
		return "Produk sedang dinonaktifkan oleh admin."
	}
	if !product.IsActive {
		return "Produk sedang tidak tersedia dari provider."
	}
	if product.Stock != -1 && product.Stock <= 0 {
		return "Stok produk sedang kosong."
	}
	return ""
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

	if availabilityError := storefrontProductAvailabilityError(p); availabilityError != "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": availabilityError,
		})
	}

	rand.Seed(time.Now().UnixNano())
	invoiceID := fmt.Sprintf("INV-%d-%d", time.Now().UnixNano()/1000000, rand.Intn(1000))

	capital := math.Round(p.Price)
	sellingPrice := models.CalculateSellingPrice(capital)

	tripay, err := requestTripay(invoiceID, int(sellingPrice), req.PaymentMethod, p.Name, req.CustomerPhone)
	if err != nil || !tripay.Success {
		reason := "Gagal Request Tripay"
		if tripay.Message != "" {
			reason = tripay.Message
		}

		return c.Status(500).JSON(fiber.Map{
			"error":  "Gagal Request Tripay",
			"reason": reason,
		})
	}

	provider := strings.ToLower(strings.TrimSpace(p.Provider))
	if provider == "" {
		provider = "digiflazz"
	}

	trx := models.Transaction{
		InvoiceID:      invoiceID,
		ProductID:      p.ID,
		CustomerPhone:  req.CustomerPhone,
		Amount:         sellingPrice,
		Capital:        capital,
		Profit:         sellingPrice - capital,
		Status:         "UNPAID",
		ProviderStatus: "Waiting Payment",
		PaymentMethod:  req.PaymentMethod,
		PaymentURL:     tripay.Data.CheckoutURL,
		Reference:      tripay.Data.Reference,

		Provider:     provider,
		ProviderSKU:  p.Code,
		ProviderRef:  "",
		ProviderName: providerDisplayName(provider),

		CreatedVia: "CUSTOMER",
	}

	if err := database.DB.Create(&trx).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal menyimpan transaksi"})
	}

	return c.JSON(fiber.Map{
		"message": "Success",
		"data":    tripay.Data,
	})
}

// ==========================================
// 4. TRIPAY CALLBACK
// Payment callback -> update transaction -> topup provider
// ==========================================
func TripayCallbackHandler(c *fiber.Ctx) error {
	var cb models.TripayCallback

	rawBody := c.Body()

	callbackSignature := c.Get("X-Callback-Signature")
	isDebug := isAppDebug()

	if isDebug {
		fmt.Println("===== TRIPAY CALLBACK HIT =====")
		fmt.Println("METHOD:", c.Method())
		fmt.Println("PATH:", c.Path())
		fmt.Println("CONTENT-TYPE:", c.Get("Content-Type"))
		fmt.Println("X-CALLBACK-EVENT:", c.Get("X-Callback-Event"))
		fmt.Println("SIGNATURE PRESENT:", strings.TrimSpace(callbackSignature) != "")
		fmt.Println("===============================")
	}

	if !isValidTripayCallbackSignature(rawBody, callbackSignature) {
		if isDebug {
			fmt.Println("TRIPAY CALLBACK SIGNATURE INVALID")
		}

		return c.Status(401).JSON(fiber.Map{
			"success": false,
			"reason":  "invalid callback signature",
		})
	}

	if err := json.Unmarshal(rawBody, &cb); err != nil {
		if isDebug {
			fmt.Println("TRIPAY CALLBACK JSON PARSE ERROR:", err)
		}

		return c.JSON(fiber.Map{
			"success": false,
			"reason":  "invalid callback body",
		})
	}

	cb.MerchantRef = strings.TrimSpace(cb.MerchantRef)
	cb.Status = strings.ToUpper(strings.TrimSpace(cb.Status))

	if isDebug {
		fmt.Println("TRIPAY CALLBACK INVOICE:", cb.MerchantRef)
		fmt.Println("TRIPAY CALLBACK STATUS:", cb.Status)
	}

	if cb.MerchantRef == "" || cb.Status == "" {
		if isDebug {
			fmt.Println("TRIPAY CALLBACK FIELD KOSONG")
		}

		return c.JSON(fiber.Map{
			"success": false,
			"reason":  "merchant_ref/status kosong",
		})
	}

	switch cb.Status {
	case "PAID":
		var trx models.Transaction

		if err := database.DB.Preload("Product").Where("invoice_id = ?", cb.MerchantRef).First(&trx).Error; err != nil {
			return c.JSON(fiber.Map{"success": true})
		}

		if trx.CreatedVia == "ADMIN" {
			claimedForProvider := false
			paymentChanged := false
			oldPaymentStatus := ""
			oldFulfillmentStatus := ""

			err := database.DB.Transaction(func(tx *gorm.DB) error {
				var lockedTrx models.Transaction
				if err := tx.
					Clauses(clause.Locking{Strength: "UPDATE"}).
					Preload("Product").
					First(&lockedTrx, trx.ID).Error; err != nil {
					return err
				}

				if lockedTrx.PaymentStatus == "PAID" &&
					(lockedTrx.FulfillmentStatus == "PROCESSING" ||
						lockedTrx.FulfillmentStatus == "SUCCESS" ||
						lockedTrx.FulfillmentStatus == "FAILED" ||
						strings.TrimSpace(lockedTrx.ProviderRef) != "") {
					trx = lockedTrx
					return nil
				}

				if lockedTrx.PaymentStatus == "PAID" && lockedTrx.FulfillmentStatus == "READY" {
					trx = lockedTrx
					claimedForProvider = true
					return nil
				}

				if lockedTrx.FulfillmentStatus != "" &&
					lockedTrx.FulfillmentStatus != "WAITING_PAYMENT" &&
					lockedTrx.FulfillmentStatus != "READY" {
					trx = lockedTrx
					return nil
				}

				oldPaymentStatus = lockedTrx.PaymentStatus
				if oldPaymentStatus == "" {
					oldPaymentStatus = lockedTrx.Status
				}

				oldFulfillmentStatus = lockedTrx.FulfillmentStatus
				if oldFulfillmentStatus == "" {
					oldFulfillmentStatus = lockedTrx.Status
				}

				ensureProviderSnapshot(&lockedTrx)
				lockedTrx.Status = "PAID"
				lockedTrx.PaymentStatus = "PAID"
				lockedTrx.FulfillmentStatus = "READY"
				lockedTrx.ProviderStatus = "Payment Paid"

				if err := tx.Save(&lockedTrx).Error; err != nil {
					return err
				}

				trx = lockedTrx
				claimedForProvider = true
				paymentChanged = true
				return nil
			})

			if err != nil {
				fmt.Println("❌ Gagal claim manual order callback:", err)
				return c.JSON(fiber.Map{"success": false})
			}

			if !claimedForProvider {
				return c.JSON(fiber.Map{"success": true})
			}

			if paymentChanged {
				paymentActivity := models.TransactionActivity{
					TransactionID: trx.ID,
					UserID:        nil,
					Action:        "PAYMENT_PAID",
					Description:   "Pembayaran manual order diterima dari Tripay dan otomatis diproses ke provider",
					OldStatus:     oldPaymentStatus,
					NewStatus:     "PAID",
					IPAddress:     c.IP(),
					UserAgent:     string(c.Request().Header.UserAgent()),
				}

				recordTransactionActivity(paymentActivity, "manual order payment paid")
			}

			if _, err := executeProviderForTransaction(c, &trx, nil, oldFulfillmentStatus); err != nil {
				fmt.Println("❌ Gagal auto execute manual order dari callback:", err)
				return c.JSON(fiber.Map{"success": false})
			}

			return c.JSON(fiber.Map{"success": true})
		}

		claimedForProvider := false
		paymentChanged := false
		oldStatus := ""

		err := database.DB.Transaction(func(tx *gorm.DB) error {
			var lockedTrx models.Transaction
			if err := tx.
				Clauses(clause.Locking{Strength: "UPDATE"}).
				Preload("Product").
				First(&lockedTrx, trx.ID).Error; err != nil {
				return err
			}

			if lockedTrx.Status == "SUCCESS" ||
				(lockedTrx.PaymentStatus == "PAID" &&
					(lockedTrx.FulfillmentStatus == "PROCESSING" ||
						lockedTrx.FulfillmentStatus == "SUCCESS" ||
						lockedTrx.FulfillmentStatus == "FAILED" ||
						strings.TrimSpace(lockedTrx.ProviderRef) != "")) {
				trx = lockedTrx
				return nil
			}

			if lockedTrx.PaymentStatus == "PAID" && lockedTrx.FulfillmentStatus == "READY" {
				trx = lockedTrx
				claimedForProvider = true
				return nil
			}

			oldStatus = lockedTrx.Status
			if oldStatus == "" {
				oldStatus = lockedTrx.PaymentStatus
			}

			ensureProviderSnapshot(&lockedTrx)
			lockedTrx.Status = "PAID"
			lockedTrx.PaymentStatus = "PAID"
			lockedTrx.FulfillmentStatus = "READY"
			lockedTrx.ProviderStatus = "Payment Paid"

			if err := tx.Save(&lockedTrx).Error; err != nil {
				return err
			}

			trx = lockedTrx
			claimedForProvider = true
			paymentChanged = true
			return nil
		})

		if err != nil {
			fmt.Println("❌ Gagal claim payment callback:", err)
			return c.JSON(fiber.Map{"success": false})
		}

		if !claimedForProvider {
			return c.JSON(fiber.Map{"success": true})
		}

		if paymentChanged {
			paymentActivity := models.TransactionActivity{
				TransactionID: trx.ID,
				UserID:        nil,
				Action:        "PAYMENT_PAID",
				Description:   "Pembayaran diterima dari Tripay",
				OldStatus:     oldStatus,
				NewStatus:     "PAID",
				IPAddress:     c.IP(),
				UserAgent:     string(c.Request().Header.UserAgent()),
			}

			recordTransactionActivity(paymentActivity, "payment paid")
		}

		if _, err := executeProviderForTransaction(c, &trx, nil, oldStatus); err != nil {
			fmt.Println("❌ Gagal update hasil provider:", err)
			return c.JSON(fiber.Map{"success": false})
		}

	case "EXPIRED", "FAILED":
		var trx models.Transaction
		oldStatus := ""
		statusChanged := false

		err := database.DB.Transaction(func(tx *gorm.DB) error {
			var lockedTrx models.Transaction
			if err := tx.
				Clauses(clause.Locking{Strength: "UPDATE"}).
				Where("invoice_id = ?", cb.MerchantRef).
				First(&lockedTrx).Error; err != nil {
				if err == gorm.ErrRecordNotFound {
					return nil
				}
				return err
			}

			if lockedTrx.PaymentStatus == "PAID" ||
				lockedTrx.FulfillmentStatus == "PROCESSING" ||
				lockedTrx.FulfillmentStatus == "SUCCESS" ||
				lockedTrx.FulfillmentStatus == "FAILED" ||
				strings.TrimSpace(lockedTrx.ProviderRef) != "" {
				trx = lockedTrx
				return nil
			}

			oldStatus = strings.TrimSpace(lockedTrx.PaymentStatus)
			if oldStatus == "" {
				oldStatus = strings.TrimSpace(lockedTrx.Status)
			}

			if lockedTrx.Status == cb.Status &&
				lockedTrx.PaymentStatus == cb.Status &&
				lockedTrx.FulfillmentStatus == "WAITING_PAYMENT" &&
				lockedTrx.ProviderStatus == "Payment "+cb.Status {
				trx = lockedTrx
				return nil
			}

			lockedTrx.Status = cb.Status
			lockedTrx.PaymentStatus = cb.Status
			lockedTrx.FulfillmentStatus = "WAITING_PAYMENT"
			lockedTrx.ProviderStatus = "Payment " + cb.Status

			if err := tx.Save(&lockedTrx).Error; err != nil {
				return err
			}

			trx = lockedTrx
			statusChanged = true
			return nil
		})
		if err != nil {
			fmt.Println("❌ Gagal update payment expired/failed:", err)
			return c.JSON(fiber.Map{"success": false})
		}

		if statusChanged {
			activity := models.TransactionActivity{
				TransactionID: trx.ID,
				UserID:        nil,
				Action:        "PAYMENT_" + cb.Status,
				Description:   "Pembayaran " + cb.Status + " dari Tripay",
				OldStatus:     oldStatus,
				NewStatus:     trx.Status,
				IPAddress:     c.IP(),
				UserAgent:     string(c.Request().Header.UserAgent()),
			}

			recordTransactionActivity(activity, "payment failed/expired")
		}
	}

	return c.JSON(fiber.Map{"success": true})
}

func DigiflazzWebhookHandler(c *fiber.Ctx) error {
	rawBody := c.Body()
	event := strings.TrimSpace(c.Get("X-Digiflazz-Event"))
	signature := strings.TrimSpace(c.Get("X-Hub-Signature"))
	userAgent := string(c.Request().Header.UserAgent())
	webhookSecret := strings.TrimSpace(os.Getenv("DIGIFLAZZ_WEBHOOK_SECRET"))
	isDebug := isAppDebug()

	if isDebug {
		fmt.Println("===== DIGIFLAZZ WEBHOOK =====")
		fmt.Println("EVENT:", event)
		fmt.Println("SIGNATURE PRESENT:", signature != "")
		fmt.Println("=============================")
	}

	if webhookSecret == "" {
		if !isDebug {
			return c.Status(401).JSON(fiber.Map{
				"success": false,
				"reason":  "digiflazz webhook secret not configured",
			})
		}

		fmt.Println("WARNING: DIGIFLAZZ_WEBHOOK_SECRET kosong, signature webhook Digiflazz dibypass karena APP_DEBUG=true")
	} else {
		mac := hmac.New(sha1.New, []byte(webhookSecret))
		mac.Write(rawBody)
		expectedSignature := "sha1=" + hex.EncodeToString(mac.Sum(nil))

		if !hmac.Equal([]byte(expectedSignature), []byte(signature)) {
			if isDebug {
				fmt.Println("DIGIFLAZZ WEBHOOK SIGNATURE INVALID")
			}

			return c.Status(401).JSON(fiber.Map{
				"success": false,
				"reason":  "invalid digiflazz signature",
			})
		}
	}

	var payload digiflazzResponse
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		if isDebug {
			fmt.Println("DIGIFLAZZ WEBHOOK JSON PARSE ERROR:", err)
		}

		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"reason":  "invalid digiflazz webhook body",
		})
	}

	providerRef := strings.TrimSpace(payload.Data.RefID)
	if providerRef == "" {
		if isDebug {
			fmt.Println("DIGIFLAZZ WEBHOOK REF_ID KOSONG")
		}

		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"reason":  "ref_id kosong",
		})
	}

	var trx models.Transaction
	if err := database.DB.
		Preload("Product").
		Where("provider_ref = ?", providerRef).
		First(&trx).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			if isDebug {
				fmt.Println("DIGIFLAZZ WEBHOOK TRANSACTION NOT FOUND:", providerRef)
			}
			return c.JSON(fiber.Map{"success": true})
		}

		if isDebug {
			fmt.Println("DIGIFLAZZ WEBHOOK DB ERROR:", err)
		}
		return c.Status(500).JSON(fiber.Map{"success": false})
	}

	statusProvider, providerLog := mapDigiflazzProviderResult(payload)
	oldStatus := trx.Status
	oldFulfillmentStatus := trx.FulfillmentStatus

	if isDebug {
		fmt.Println("DIGIFLAZZ WEBHOOK INVOICE:", trx.InvoiceID)
		fmt.Println("DIGIFLAZZ WEBHOOK PROVIDER_REF:", providerRef)
		fmt.Println("DIGIFLAZZ WEBHOOK RC:", strings.TrimSpace(payload.Data.Rc))
		fmt.Println("DIGIFLAZZ WEBHOOK STATUS:", strings.TrimSpace(payload.Data.Status))
	}

	receivedActivity := models.TransactionActivity{
		TransactionID: trx.ID,
		UserID:        nil,
		Action:        "DIGIFLAZZ_WEBHOOK_RECEIVED",
		Description:   fmt.Sprintf("Webhook Digiflazz diterima untuk ref %s: %s", providerRef, providerLog),
		OldStatus:     oldFulfillmentStatus,
		NewStatus:     oldFulfillmentStatus,
		IPAddress:     c.IP(),
		UserAgent:     userAgent,
	}
	recordTransactionActivity(receivedActivity, "digiflazz webhook received")

	if strings.TrimSpace(trx.ProviderSKU) == "" {
		trx.ProviderSKU = strings.TrimSpace(payload.Data.BuyerSKUCode)
	}
	ensureProviderSnapshot(&trx)

	_, resultOldStatus, err := saveProviderResultUnlessFinal(&trx, statusProvider, providerLog, providerRef, nil)
	if err != nil {
		if isDebug {
			fmt.Println("DIGIFLAZZ WEBHOOK SAVE ERROR:", err)
		}
		return c.Status(500).JSON(fiber.Map{"success": false})
	}

	if resultOldStatus != trx.FulfillmentStatus {
		updatedActivity := models.TransactionActivity{
			TransactionID: trx.ID,
			UserID:        nil,
			Action:        "DIGIFLAZZ_WEBHOOK_RESULT_UPDATED",
			Description:   fmt.Sprintf("Webhook Digiflazz mengubah status provider menjadi %s: %s", trx.ProviderStatus, providerLog),
			OldStatus:     resultOldStatus,
			NewStatus:     trx.FulfillmentStatus,
			IPAddress:     c.IP(),
			UserAgent:     userAgent,
		}
		recordTransactionActivity(updatedActivity, "digiflazz webhook result updated")
	} else if isDebug && isFinalFulfillmentStatus(trx.FulfillmentStatus) {
		fmt.Println("DIGIFLAZZ WEBHOOK SKIPPED FINAL TRANSACTION:", trx.InvoiceID, trx.FulfillmentStatus)
	}

	if isDebug {
		fmt.Println("DIGIFLAZZ WEBHOOK UPDATED:", trx.InvoiceID, oldStatus, "=>", trx.Status, oldFulfillmentStatus, "=>", trx.FulfillmentStatus)
		fmt.Println("DIGIFLAZZ WEBHOOK PROVIDER_STATUS:", trx.ProviderStatus)
	}

	return c.JSON(fiber.Map{"success": true})
}

// ==========================================
// 5. SEARCH ORDER
// ==========================================
func SearchOrder(c *fiber.Ctx) error {
	var req models.SearchOrderRequest

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Input tidak valid"})
	}

	var trx models.Transaction

	if err := database.DB.
		Preload("Product").
		Where("invoice_id = ?", req.InvoiceID).
		First(&trx).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Not Found"})
	}

	return c.JSON(customerSafeTransactionDTO(trx, true))
}

// ==========================================
// 6. CHECK TRANSACTION STATUS
// ==========================================
func CheckTransactionStatus(c *fiber.Ctx) error {
	invoiceID := c.Params("invoice")
	reference := strings.TrimSpace(c.Query("reference"))

	var trx models.Transaction

	if err := database.DB.Where("invoice_id = ?", invoiceID).First(&trx).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"status": "NOT_FOUND"})
	}

	canReadSensitiveResult := reference != "" &&
		strings.TrimSpace(trx.Reference) != "" &&
		hmac.Equal([]byte(reference), []byte(strings.TrimSpace(trx.Reference)))

	snToReturn := ""
	if canReadSensitiveResult {
		snToReturn = trx.SerialNumber
		if snToReturn == "" && trx.FulfillmentStatus == "FAILED" {
			snToReturn = trx.ErrorMessage
		}
	}

	return c.JSON(fiber.Map{
		"status":             trx.Status,
		"payment_status":     trx.PaymentStatus,
		"fulfillment_status": trx.FulfillmentStatus,
		"provider_status":    customerSafeProviderStatus(trx),
		"sn":                 snToReturn,
	})
}

// ==========================================
// 7. RETRY TRANSACTION
// ==========================================
func RetryTransaction(c *fiber.Ctx) error {
	id := c.Params("id")

	adminID, err := getUserIDFromContext(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Sesi tidak valid, harap login ulang"})
	}

	var trx models.Transaction

	if err := database.DB.Preload("Product").First(&trx, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Transaksi tidak ditemukan"})
	}

	if trx.Status != "FAILED" {
		return c.Status(400).JSON(fiber.Map{"error": "Hanya transaksi GAGAL yang bisa di-retry"})
	}

	if trx.RetryCount >= 3 {
		return c.Status(400).JSON(fiber.Map{"error": "Batas maksimal retry (3x) sudah tercapai!"})
	}

	oldFulfillmentStatus := trx.FulfillmentStatus
	if oldFulfillmentStatus == "" {
		oldFulfillmentStatus = trx.Status
	}

	ensureProviderSnapshot(&trx)
	newProviderRef := generateProviderRef(trx.InvoiceID, trx.Provider)

	now := time.Now()
	trx.RetryCount += 1
	trx.LastRetryAt = &now
	trx.LastRetryByID = &adminID

	trx.ProviderRef = newProviderRef
	trx.PaymentStatus = "PAID"
	trx.Status = "PENDING"
	trx.FulfillmentStatus = "PROCESSING"
	trx.ProviderStatus = "Processing"

	if err := database.DB.Save(&trx).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal menyiapkan retry provider"})
	}

	statusProvider, providerLog, providerErr := ProcessTopupWithRef(newProviderRef, trx.Product, trx.CustomerPhone)
	message, _, err := saveProviderResultUnlessFinal(&trx, statusProvider, providerLog, newProviderRef, providerErr)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal menyimpan hasil retry"})
	}

	activity := models.TransactionActivity{
		TransactionID: trx.ID,
		UserID:        &adminID,
		Action:        "RETRY",
		Description:   fmt.Sprintf("Retry ke-%d via provider %s", trx.RetryCount, trx.ProviderName),
		OldStatus:     oldFulfillmentStatus,
		NewStatus:     trx.FulfillmentStatus,
		IPAddress:     c.IP(),
		UserAgent:     string(c.Request().Header.UserAgent()),
	}

	if err := database.DB.Create(&activity).Error; err != nil {
		fmt.Println("❌ Gagal mencatat activity retry:", err)
	}

	return c.JSON(fiber.Map{
		"message": message,
		"data":    trx,
	})
}

// ==========================================
// 8. PROCESS TOPUP
// ==========================================
func ProcessTopupWithRef(providerRef string, product models.Product, target string) (status string, message string, err error) {
	provider := strings.ToLower(strings.TrimSpace(product.Provider))
	if provider == "" {
		provider = "digiflazz"
	}

	switch provider {
	case "digiflazz":
		resp, err := topupDigiflazz(providerRef, product.Code, target)
		if err != nil {
			return "FAILED", err.Error(), err
		}

		status, message = mapDigiflazzProviderResult(resp)
		return status, message, nil

	case "apigames":
		// TODO: nanti isi helper ApiGames di sini.
		return "FAILED", "Provider ApiGames belum diimplementasikan", nil

	case "manual":
		return "PENDING", "Menunggu Proses Admin", nil

	default:
		return "FAILED", "Provider Tidak Dikenal", fmt.Errorf("provider unknown: %s", provider)
	}
}

func ProcessTopup(invoiceID string, product models.Product, target string) (status string, message string, providerRef string, err error) {
	provider := strings.ToLower(strings.TrimSpace(product.Provider))
	if provider == "" {
		provider = "digiflazz"
	}

	providerRef = generateProviderRef(invoiceID, provider)
	status, message, err = ProcessTopupWithRef(providerRef, product, target)

	return status, message, providerRef, err
}

// ==========================================
// 9. TRIPAY HELPER
// ==========================================
type tripayResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    struct {
		Reference   string `json:"reference"`
		MerchantRef string `json:"merchant_ref"`
		CheckoutURL string `json:"checkout_url"`
		QrUrl       string `json:"qr_url"`
		PayCode     string `json:"pay_code"`
		Amount      int    `json:"amount"`
	} `json:"data"`
}

func requestTripay(invoiceID string, amount int, method string, productName string, phone string) (tripayResponse, error) {
	apiKey := strings.TrimSpace(os.Getenv("TRIPAY_API_KEY"))
	privateKey := strings.TrimSpace(os.Getenv("TRIPAY_PRIVATE_KEY"))
	merchantCode := strings.TrimSpace(os.Getenv("TRIPAY_MERCHANT_CODE"))
	mode := strings.ToLower(strings.TrimSpace(os.Getenv("TRIPAY_MODE")))
	callbackURL := strings.TrimSpace(os.Getenv("TRIPAY_CALLBACK_URL"))

	baseURL := "https://tripay.co.id/api-sandbox/transaction/create"
	if mode == "production" {
		baseURL = "https://tripay.co.id/api/transaction/create"
	}

	if isAppDebug() {
		fmt.Println("===== TRIPAY REQUEST =====")
		fmt.Println("MODE:", mode)
		fmt.Println("BASE URL:", baseURL)
		fmt.Println("CALLBACK URL:", callbackURL)
		fmt.Println("INVOICE:", invoiceID)
		fmt.Println("==========================")
	}

	signatureStr := fmt.Sprintf("%s%s%d", merchantCode, invoiceID, amount)

	h := hmac.New(sha256.New, []byte(privateKey))
	h.Write([]byte(signatureStr))

	signature := hex.EncodeToString(h.Sum(nil))

	payload := map[string]interface{}{
		"method":         method,
		"merchant_ref":   invoiceID,
		"amount":         amount,
		"customer_name":  "Pelanggan AnggiJajan",
		"customer_email": "customer@anggijajan.com",
		"customer_phone": phone,
		"order_items": []map[string]interface{}{
			{
				"sku":      "PROD-01",
				"name":     productName,
				"price":    amount,
				"quantity": 1,
			},
		},
		"callback_url": callbackURL,
		"expired_time": time.Now().Add(24 * time.Hour).Unix(),
		"signature":    signature,
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

	bodyBytes, _ := io.ReadAll(resp.Body)

	if isAppDebug() {
		fmt.Println("===== TRIPAY RESPONSE =====")
		fmt.Println("HTTP STATUS:", resp.StatusCode)
		fmt.Println("INVOICE:", invoiceID)
		fmt.Println("===========================")
	}

	var tripayResp tripayResponse

	if err := json.Unmarshal(bodyBytes, &tripayResp); err != nil {
		return tripayResponse{}, err
	}

	return tripayResp, nil
}

func isValidTripayCallbackSignature(rawBody []byte, receivedSignature string) bool {
	privateKey := strings.TrimSpace(os.Getenv("TRIPAY_PRIVATE_KEY"))
	receivedSignature = strings.TrimSpace(receivedSignature)

	if privateKey == "" || receivedSignature == "" {
		return false
	}

	h := hmac.New(sha256.New, []byte(privateKey))
	h.Write(rawBody)

	expectedSignature := hex.EncodeToString(h.Sum(nil))

	return hmac.Equal(
		[]byte(expectedSignature),
		[]byte(receivedSignature),
	)
}

// ==========================================
// 10. DIGIFLAZZ HELPER
// ==========================================
type digiflazzResponse struct {
	Data struct {
		RefID        string `json:"ref_id"`
		CustomerNo   string `json:"customer_no"`
		BuyerSKUCode string `json:"buyer_sku_code"`
		Status       string `json:"status"`
		Rc           string `json:"rc"`
		Sn           string `json:"sn"`
		Message      string `json:"message"`
	} `json:"data"`
}

func mapDigiflazzProviderResult(resp digiflazzResponse) (string, string) {
	rc := strings.TrimSpace(resp.Data.Rc)
	providerStatus := strings.ToUpper(strings.TrimSpace(resp.Data.Status))
	providerMessage := strings.TrimSpace(resp.Data.Message)
	sn := strings.TrimSpace(resp.Data.Sn)

	switch {
	case rc == "00" || providerStatus == "SUKSES" || providerStatus == "SUCCESS":
		message := sn
		if message == "" {
			message = providerMessage
		}
		if message == "" {
			message = strings.TrimSpace(resp.Data.RefID)
		}
		return "SUCCESS", message

	case rc == "03" ||
		(rc == "" && (providerStatus == "PENDING" ||
			providerStatus == "PROSES" ||
			providerStatus == "PROCESSING")) ||
		(rc == "" && providerStatus == ""):
		return "PENDING", buildDigiflazzPendingMessage(resp)

	case providerStatus == "GAGAL" || providerStatus == "FAILED":
		return "FAILED", buildDigiflazzFailureMessage(resp)

	case rc != "":
		return "FAILED", buildDigiflazzFailureMessage(resp)

	default:
		return "PENDING", buildDigiflazzPendingMessage(resp)
	}
}

func buildDigiflazzFailureMessage(resp digiflazzResponse) string {
	message := strings.TrimSpace(resp.Data.Message)
	if message == "" {
		message = "Digiflazz gagal tanpa detail dari provider"
	}

	parts := []string{"Digiflazz gagal: " + message}

	if rc := strings.TrimSpace(resp.Data.Rc); rc != "" {
		parts = append(parts, "RC: "+rc)
	}

	if status := strings.TrimSpace(resp.Data.Status); status != "" {
		parts = append(parts, "Status: "+status)
	}

	if refID := strings.TrimSpace(resp.Data.RefID); refID != "" {
		parts = append(parts, "Ref: "+refID)
	}

	if sn := strings.TrimSpace(resp.Data.Sn); sn != "" {
		parts = append(parts, "SN: "+sn)
	}

	return strings.Join(parts, " | ")
}

func buildDigiflazzPendingMessage(resp digiflazzResponse) string {
	parts := []string{"Menunggu hasil Digiflazz"}

	if status := strings.TrimSpace(resp.Data.Status); status != "" {
		parts = append(parts, "Status: "+status)
	}

	if refID := strings.TrimSpace(resp.Data.RefID); refID != "" {
		parts = append(parts, "Ref: "+refID)
	}

	return strings.Join(parts, " | ")
}

func topupDigiflazz(providerRef string, sku string, customerNo string) (digiflazzResponse, error) {
	username := strings.TrimSpace(os.Getenv("DIGIFLAZZ_USERNAME"))
	apiKey := strings.TrimSpace(os.Getenv("DIGIFLAZZ_API_KEY"))
	url := "https://api.digiflazz.com/v1/transaction"

	signStr := username + apiKey + providerRef

	hasher := md5.New()
	hasher.Write([]byte(signStr))

	sign := hex.EncodeToString(hasher.Sum(nil))

	payload := map[string]interface{}{
		"username":       username,
		"buyer_sku_code": sku,
		"customer_no":    customerNo,
		"ref_id":         providerRef,
		"sign":           sign,
		"testing":        strings.ToLower(strings.TrimSpace(os.Getenv("DIGIFLAZZ_TESTING"))) == "true",
	}

	jsonPayload, _ := json.Marshal(payload)

	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(jsonPayload))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}

	resp, err := client.Do(req)
	if err != nil {
		return digiflazzResponse{}, fmt.Errorf("gagal request ke Digiflazz: %w", err)
	}

	defer resp.Body.Close()

	bodyBytes, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return digiflazzResponse{}, fmt.Errorf("gagal membaca response Digiflazz: %w", readErr)
	}

	var result digiflazzResponse

	if err := json.Unmarshal(bodyBytes, &result); err != nil {
		return digiflazzResponse{}, fmt.Errorf("gagal decode response Digiflazz HTTP %d: %w", resp.StatusCode, err)
	}

	if isAppDebug() {
		fmt.Println("===== DIGIFLAZZ RESPONSE =====")
		fmt.Println("HTTP STATUS:", resp.StatusCode)
		fmt.Println("PROVIDER REF:", providerRef)
		fmt.Println("RC:", strings.TrimSpace(result.Data.Rc))
		fmt.Println("STATUS:", strings.TrimSpace(result.Data.Status))
		fmt.Println("==============================")
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		detail := buildDigiflazzFailureMessage(result)
		return digiflazzResponse{}, fmt.Errorf("Digiflazz HTTP %d: %s", resp.StatusCode, detail)
	}

	return result, nil
}
