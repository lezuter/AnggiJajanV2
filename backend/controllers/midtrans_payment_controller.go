package controllers

import (
	"bytes"
	"context"
	"crypto/hmac"
	cryptorand "crypto/rand"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/derry/anggijajan-v2-backend/database"
	"github.com/derry/anggijajan-v2-backend/models"
	"github.com/derry/anggijajan-v2-backend/payments"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	midtransMaximumResponseBody         = 1 << 20
	midtransPreferenceCacheTTL          = 5 * time.Minute
	midtransPreferenceFailureCacheTTL   = 15 * time.Second
	midtransPreferenceUnavailableReason = "Status metode belum dapat diverifikasi dari Midtrans"
)

type midtransSnapTransactionDetails struct {
	OrderID     string `json:"order_id"`
	GrossAmount int64  `json:"gross_amount"`
}

type midtransSnapItem struct {
	ID           string `json:"id"`
	Price        int64  `json:"price"`
	Quantity     int    `json:"quantity"`
	Name         string `json:"name"`
	Brand        string `json:"brand,omitempty"`
	Category     string `json:"category,omitempty"`
	MerchantName string `json:"merchant_name,omitempty"`
}

type midtransSnapCustomer struct {
	FirstName string `json:"first_name,omitempty"`
	Email     string `json:"email,omitempty"`
	Phone     string `json:"phone,omitempty"`
}

type midtransSnapCallbacks struct {
	Finish string `json:"finish,omitempty"`
	Error  string `json:"error,omitempty"`
}

type midtransSnapCreditCard struct {
	Secure bool `json:"secure"`
}

type midtransSnapRequest struct {
	TransactionDetails midtransSnapTransactionDetails `json:"transaction_details"`
	ItemDetails        []midtransSnapItem             `json:"item_details"`
	CustomerDetails    midtransSnapCustomer           `json:"customer_details"`
	CreditCard         *midtransSnapCreditCard        `json:"credit_card,omitempty"`
	EnabledPayments    []string                       `json:"enabled_payments"`
	Callbacks          midtransSnapCallbacks          `json:"callbacks,omitempty"`
}

type midtransSnapResponse struct {
	Token         string   `json:"token"`
	RedirectURL   string   `json:"redirect_url"`
	ErrorMessages []string `json:"error_messages"`
}

type midtransNotification struct {
	OrderID           string `json:"order_id"`
	StatusCode        string `json:"status_code"`
	GrossAmount       string `json:"gross_amount"`
	SignatureKey      string `json:"signature_key"`
	TransactionID     string `json:"transaction_id"`
	TransactionStatus string `json:"transaction_status"`
	FraudStatus       string `json:"fraud_status"`
	PaymentType       string `json:"payment_type"`
}

type midtransPreferenceChannel struct {
	Name    string `json:"name"`
	Enabled bool   `json:"enabled"`
}

type midtransPreferenceResponse struct {
	MerchantID      string                      `json:"merchant_id"`
	PaymentChannels []midtransPreferenceChannel `json:"payment_channels"`
	ErrorMessages   []string                    `json:"error_messages"`
}

type midtransPaymentActivation struct {
	Verified       bool
	Methods        map[string]bool
	DisabledReason string
}

type midtransPreferenceCacheEntry struct {
	Activation midtransPaymentActivation
	ExpiresAt  time.Time
}

var (
	midtransPreferenceCacheMu sync.Mutex
	midtransPreferenceCache   = make(map[string]midtransPreferenceCacheEntry)
)

type midtransPaymentTransition struct {
	Status            string
	PaymentStatus     string
	FulfillmentStatus string
	ProviderStatus    string
	ShouldExecute     bool
	Changed           bool
}

func midtransSnapBaseURL() string {
	if custom := strings.TrimRight(strings.TrimSpace(os.Getenv("MIDTRANS_SNAP_BASE_URL")), "/"); custom != "" {
		return custom
	}
	config, err := payments.ResolveMidtransRuntimeConfig()
	if err != nil {
		return ""
	}
	return config.SnapAPIBaseURL
}

func midtransStatusBaseURL() string {
	if custom := strings.TrimRight(strings.TrimSpace(os.Getenv("MIDTRANS_STATUS_BASE_URL")), "/"); custom != "" {
		return custom
	}
	config, err := payments.ResolveMidtransRuntimeConfig()
	if err != nil {
		return ""
	}
	return config.StatusAPIBaseURL
}

func midtransServerKey() string {
	config, err := payments.ResolveMidtransRuntimeConfig()
	if err != nil {
		return ""
	}
	return config.ServerKey
}

func midtransMerchantID() string {
	config, err := payments.ResolveMidtransRuntimeConfig()
	if err != nil {
		return ""
	}
	return config.MerchantID
}

func GetMidtransPaymentConfig(c *fiber.Ctx) error {
	c.Set(fiber.HeaderCacheControl, "no-store")
	config, err := payments.ResolveMidtransRuntimeConfig()
	if err != nil ||
		config.ClientKey == "" ||
		config.ServerKey == "" ||
		config.MerchantID == "" {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error": "Konfigurasi pembayaran belum tersedia",
		})
	}

	return c.JSON(fiber.Map{
		"provider":        "midtrans",
		"mode":            config.Mode,
		"client_key":      config.ClientKey,
		"snap_script_url": config.SnapScriptURL,
	})
}

func midtransAuthorization(serverKey string) string {
	return "Basic " + base64.StdEncoding.EncodeToString([]byte(serverKey+":"))
}

func cloneMidtransActivation(activation midtransPaymentActivation) midtransPaymentActivation {
	clone := activation
	clone.Methods = make(map[string]bool, len(activation.Methods))
	for method, enabled := range activation.Methods {
		clone.Methods[method] = enabled
	}
	return clone
}

func midtransPreferenceCacheKey(serverKey string) string {
	credentialDigest := sha256.Sum256([]byte(serverKey))
	return fmt.Sprintf(
		"%s|%s|%x",
		midtransSnapBaseURL(),
		midtransMerchantID(),
		credentialDigest,
	)
}

func fetchMidtransPaymentActivation(
	ctx context.Context,
	serverKey string,
) (midtransPaymentActivation, error) {
	endpoint := midtransSnapBaseURL() + "/snap/v3/merchant-preferences"
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return midtransPaymentActivation{}, err
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", midtransAuthorization(serverKey))

	client := &http.Client{Timeout: 8 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return midtransPaymentActivation{}, err
	}
	defer response.Body.Close()

	body, err := io.ReadAll(io.LimitReader(response.Body, midtransMaximumResponseBody))
	if err != nil {
		return midtransPaymentActivation{}, err
	}
	var preference midtransPreferenceResponse
	if err := json.Unmarshal(body, &preference); err != nil {
		return midtransPaymentActivation{}, fmt.Errorf("response preference Midtrans tidak valid")
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return midtransPaymentActivation{}, fmt.Errorf("preference Midtrans HTTP %d", response.StatusCode)
	}

	configuredMerchantID := midtransMerchantID()
	responseMerchantID := strings.TrimSpace(preference.MerchantID)
	if configuredMerchantID != "" &&
		responseMerchantID != "" &&
		!strings.EqualFold(configuredMerchantID, responseMerchantID) {
		return midtransPaymentActivation{}, fmt.Errorf("merchant preference Midtrans tidak sesuai konfigurasi")
	}

	activation := midtransPaymentActivation{
		Verified: true,
		Methods:  make(map[string]bool, len(preference.PaymentChannels)),
	}
	for _, channel := range preference.PaymentChannels {
		method := strings.ToLower(strings.TrimSpace(channel.Name))
		if method != "" {
			activation.Methods[method] = channel.Enabled
		}
	}
	return activation, nil
}

func getMidtransPaymentActivation(ctx context.Context) midtransPaymentActivation {
	serverKey := midtransServerKey()
	if serverKey == "" {
		return midtransPaymentActivation{
			Methods:        map[string]bool{},
			DisabledReason: midtransPreferenceUnavailableReason,
		}
	}

	cacheKey := midtransPreferenceCacheKey(serverKey)
	now := time.Now()
	midtransPreferenceCacheMu.Lock()
	defer midtransPreferenceCacheMu.Unlock()

	if cached, found := midtransPreferenceCache[cacheKey]; found && now.Before(cached.ExpiresAt) {
		return cloneMidtransActivation(cached.Activation)
	}

	activation, err := fetchMidtransPaymentActivation(ctx, serverKey)
	cacheTTL := midtransPreferenceCacheTTL
	if err != nil {
		activation = midtransPaymentActivation{
			Methods:        map[string]bool{},
			DisabledReason: midtransPreferenceUnavailableReason,
		}
		cacheTTL = midtransPreferenceFailureCacheTTL
	}
	midtransPreferenceCache[cacheKey] = midtransPreferenceCacheEntry{
		Activation: cloneMidtransActivation(activation),
		ExpiresAt:  now.Add(cacheTTL),
	}
	return cloneMidtransActivation(activation)
}

func generateSecureReference(byteCount int) (string, error) {
	buffer := make([]byte, byteCount)
	if _, err := cryptorand.Read(buffer); err != nil {
		return "", err
	}
	return hex.EncodeToString(buffer), nil
}

func generateMidtransInvoiceID() (string, error) {
	suffix, err := generateSecureReference(4)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("INV-%d-%s", time.Now().UnixMilli(), suffix), nil
}

func midtransExpectedTotalMatches(expected, actual float64) bool {
	if expected <= 0 || actual <= 0 {
		return false
	}
	return int64(math.Round(expected)) == int64(math.Round(actual))
}

func midtransDefaultCustomerPhone() string {
	if configured := strings.TrimSpace(
		os.Getenv("MIDTRANS_DEFAULT_CUSTOMER_PHONE"),
	); configured != "" {
		return configured
	}

	config, err := payments.ResolveMidtransRuntimeConfig()
	if err == nil && config.Mode == "sandbox" {
		return "08123456789"
	}
	return ""
}

func buildMidtransSnapPayload(
	invoiceID string,
	product models.Product,
	selected midtransPaymentMethodOption,
	req models.CheckoutRequest,
) midtransSnapRequest {
	grossAmount := int64(math.Round(selected.TotalAmount))
	productName := strings.TrimSpace(product.Name)
	if productName == "" {
		productName = "Produk Anggijajan"
	}
	productCode := strings.TrimSpace(product.Code)
	if productCode == "" {
		productCode = fmt.Sprintf("PRODUCT-%d", product.ID)
	}

	payload := midtransSnapRequest{
		TransactionDetails: midtransSnapTransactionDetails{
			OrderID:     invoiceID,
			GrossAmount: grossAmount,
		},
		ItemDetails: []midtransSnapItem{
			{
				ID:           productCode,
				Price:        grossAmount,
				Quantity:     1,
				Name:         productName,
				Brand:        "Anggijajan",
				Category:     "Digital Product",
				MerchantName: "Anggijajan",
			},
		},
		CustomerDetails: midtransSnapCustomer{
			FirstName: firstNonEmpty(req.CustomerName, "Pelanggan Anggijajan"),
			Email: firstNonEmpty(
				req.Email,
				os.Getenv("MIDTRANS_DEFAULT_CUSTOMER_EMAIL"),
				"customer@anggijajan.com",
			),
			Phone: firstNonEmpty(
				req.PayerPhone,
				midtransDefaultCustomerPhone(),
			),
		},
		EnabledPayments: []string{selected.ProviderMethod},
	}
	if selected.ProviderMethod == "google_pay" ||
		selected.ProviderMethod == "credit_card" {
		payload.CreditCard = &midtransSnapCreditCard{Secure: true}
	}
	if config, err := payments.ResolveMidtransRuntimeConfig(); err == nil {
		payload.Callbacks = midtransSnapCallbacks{
			Finish: config.FinishRedirectURL,
			Error:  config.ErrorRedirectURL,
		}
	}
	return payload
}

func createMidtransSnap(
	ctx context.Context,
	payload midtransSnapRequest,
) (midtransSnapResponse, error) {
	serverKey := midtransServerKey()
	if serverKey == "" {
		return midtransSnapResponse{}, fmt.Errorf("MIDTRANS_SERVER_KEY belum dikonfigurasi")
	}

	requestBody, err := json.Marshal(payload)
	if err != nil {
		return midtransSnapResponse{}, fmt.Errorf("gagal membuat payload Snap: %w", err)
	}

	endpoint := midtransSnapBaseURL() + "/snap/v1/transactions"
	httpRequest, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(requestBody))
	if err != nil {
		return midtransSnapResponse{}, fmt.Errorf("gagal membuat request Snap: %w", err)
	}
	httpRequest.Header.Set("Accept", "application/json")
	httpRequest.Header.Set("Content-Type", "application/json")
	httpRequest.Header.Set("Authorization", midtransAuthorization(serverKey))

	httpClient := &http.Client{Timeout: 15 * time.Second}
	httpResponse, err := httpClient.Do(httpRequest)
	if err != nil {
		return midtransSnapResponse{}, fmt.Errorf("request Snap gagal: %w", err)
	}
	defer httpResponse.Body.Close()

	responseBody, err := io.ReadAll(io.LimitReader(httpResponse.Body, midtransMaximumResponseBody))
	if err != nil {
		return midtransSnapResponse{}, fmt.Errorf("gagal membaca response Snap: %w", err)
	}

	var response midtransSnapResponse
	if err := json.Unmarshal(responseBody, &response); err != nil {
		return midtransSnapResponse{}, fmt.Errorf("response Snap tidak valid (HTTP %d)", httpResponse.StatusCode)
	}
	if httpResponse.StatusCode < 200 || httpResponse.StatusCode >= 300 {
		reason := strings.Join(response.ErrorMessages, "; ")
		if reason == "" {
			reason = fmt.Sprintf("HTTP %d", httpResponse.StatusCode)
		}
		return midtransSnapResponse{}, fmt.Errorf("Midtrans menolak transaksi: %s", reason)
	}
	if strings.TrimSpace(response.Token) == "" || strings.TrimSpace(response.RedirectURL) == "" {
		return midtransSnapResponse{}, fmt.Errorf("response Snap tidak memiliki token atau redirect_url")
	}

	return response, nil
}

func checkoutWithMidtrans(
	c *fiber.Ctx,
	req models.CheckoutRequest,
	product models.Product,
) error {
	preferenceContext, cancelPreference := context.WithTimeout(c.UserContext(), 10*time.Second)
	quote, err := buildCurrentMidtransPaymentQuote(preferenceContext, product)
	cancelPreference()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":  "Quote pembayaran belum bisa dibangun ulang",
			"reason": err.Error(),
		})
	}
	selected, found := findMidtransPaymentQuote(quote, req.QuoteKey)
	if !found || !selected.Enabled {
		reason := selected.DisabledReason
		if reason == "" {
			reason = "Quote sudah berubah atau tidak tersedia untuk produk ini"
		}
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":  "Metode pembayaran tidak tersedia",
			"reason": reason,
		})
	}
	if !midtransExpectedTotalMatches(
		req.ExpectedTotalAmount,
		selected.TotalAmount,
	) {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error":      "Quote pembayaran berubah",
			"error_code": "QUOTE_CHANGED",
			"reason":     "Harga atau biaya pembayaran berubah. Periksa total terbaru sebelum melanjutkan.",
			"current_quote": fiber.Map{
				"quote_key":          selected.QuoteKey,
				"total_amount":       selected.TotalAmount,
				"base_price":         selected.BasePrice,
				"customer_surcharge": selected.CustomerSurcharge,
			},
		})
	}

	invoiceID, err := generateMidtransInvoiceID()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal membuat invoice pembayaran",
		})
	}
	statusReference, err := generateSecureReference(16)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal membuat referensi pembayaran",
		})
	}

	capital := math.Round(product.Price)
	provider := strings.ToLower(strings.TrimSpace(product.Provider))
	if provider == "" {
		provider = "digiflazz"
	}
	paymentFeeBearer := "MERCHANT"
	if selected.CustomerSurcharge > 0 {
		paymentFeeBearer = "SHARED"
	}

	trx := models.Transaction{
		InvoiceID:           invoiceID,
		ProductID:           product.ID,
		CustomerPhone:       strings.TrimSpace(req.CustomerPhone),
		Amount:              selected.TotalAmount,
		Capital:             capital,
		Profit:              selected.TotalAmount - capital,
		ProductAmount:       selected.ProductAmount,
		StartingPrice:       selected.BasePrice,
		CustomerSurcharge:   selected.CustomerSurcharge,
		Status:              "UNPAID",
		PaymentStatus:       "UNPAID",
		FulfillmentStatus:   "WAITING_PAYMENT",
		ProviderStatus:      "Waiting Payment",
		PaymentProvider:     "midtrans",
		PaymentQuoteKey:     selected.QuoteKey,
		PaymentMethod:       selected.ProviderMethod,
		PaymentFeeBearer:    paymentFeeBearer,
		PaymentFeeEstimated: selected.EstimatedFee,
		NetProfitEstimated:  selected.EstimatedNetProfit,
		Reference:           statusReference,
		Provider:            provider,
		ProviderSKU:         product.Code,
		ProviderName:        providerDisplayName(provider),
		CreatedVia:          "CUSTOMER",
	}

	if err := database.DB.Create(&trx).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal menyimpan transaksi",
		})
	}

	payload := buildMidtransSnapPayload(invoiceID, product, selected, req)
	requestContext, cancel := context.WithTimeout(c.UserContext(), 20*time.Second)
	defer cancel()

	snap, err := createMidtransSnap(requestContext, payload)
	if err != nil {
		_ = database.DB.Model(&trx).Updates(map[string]interface{}{
			"status":          "FAILED",
			"payment_status":  "FAILED",
			"provider_status": "Payment Request Failed",
			"error_message":   err.Error(),
		}).Error
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"error":      "Gagal membuat pembayaran Midtrans",
			"reason":     err.Error(),
			"invoice_id": invoiceID,
		})
	}

	trx.SnapToken = strings.TrimSpace(snap.Token)
	trx.PaymentURL = strings.TrimSpace(snap.RedirectURL)
	if err := database.DB.Model(&trx).Updates(map[string]interface{}{
		"snap_token":      trx.SnapToken,
		"payment_url":     trx.PaymentURL,
		"error_message":   "",
		"provider_status": "Waiting Payment",
	}).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":      "Pembayaran dibuat tetapi gagal menyimpan detailnya",
			"invoice_id": invoiceID,
		})
	}

	return c.JSON(fiber.Map{
		"message": "Success",
		"data": fiber.Map{
			"snap_token":         trx.SnapToken,
			"redirect_url":       trx.PaymentURL,
			"amount":             selected.TotalAmount,
			"base_price":         selected.BasePrice,
			"customer_surcharge": selected.CustomerSurcharge,
			"estimated_fee":      selected.EstimatedFee,
			"payment_method":     selected.ProviderMethod,
			"payment_name":       selected.Name,
			"payment_provider":   "midtrans",
			"quote_key":          selected.QuoteKey,
			"invoice_id":         invoiceID,
			"merchant_ref":       invoiceID,
			"reference":          statusReference,
		},
	})
}

func calculateMidtransSignature(
	orderID string,
	statusCode string,
	grossAmount string,
	serverKey string,
) string {
	input := orderID + statusCode + grossAmount + serverKey
	digest := sha512.Sum512([]byte(input))
	return hex.EncodeToString(digest[:])
}

func isValidMidtransSignature(notification midtransNotification, serverKey string) bool {
	expected := calculateMidtransSignature(
		notification.OrderID,
		notification.StatusCode,
		notification.GrossAmount,
		serverKey,
	)
	provided := strings.ToLower(strings.TrimSpace(notification.SignatureKey))
	return provided != "" && hmac.Equal([]byte(expected), []byte(provided))
}

func resolveMidtransPaymentTransition(
	trx models.Transaction,
	notification midtransNotification,
) midtransPaymentTransition {
	transition := midtransPaymentTransition{
		Status:            trx.Status,
		PaymentStatus:     trx.PaymentStatus,
		FulfillmentStatus: trx.FulfillmentStatus,
		ProviderStatus:    trx.ProviderStatus,
	}
	transactionStatus := strings.ToLower(strings.TrimSpace(notification.TransactionStatus))
	fraudStatus := strings.ToLower(strings.TrimSpace(notification.FraudStatus))
	isPaid := strings.TrimSpace(notification.StatusCode) == "200" &&
		(transactionStatus == "settlement" || transactionStatus == "capture") &&
		(fraudStatus == "" || fraudStatus == "accept")

	if isPaid {
		if trx.FulfillmentStatus == "PROCESSING" ||
			isFinalFulfillmentStatus(trx.FulfillmentStatus) {
			return transition
		}
		transition.Status = "PAID"
		transition.PaymentStatus = "PAID"
		if trx.FulfillmentStatus == "" || trx.FulfillmentStatus == "WAITING_PAYMENT" {
			transition.FulfillmentStatus = "READY"
			transition.ProviderStatus = "Ready"
		}
		transition.ShouldExecute = transition.FulfillmentStatus == "READY"
		transition.Changed = transition.Status != trx.Status ||
			transition.PaymentStatus != trx.PaymentStatus ||
			transition.FulfillmentStatus != trx.FulfillmentStatus ||
			transition.ProviderStatus != trx.ProviderStatus
		return transition
	}

	if trx.PaymentStatus == "PAID" ||
		trx.FulfillmentStatus == "PROCESSING" ||
		isFinalFulfillmentStatus(trx.FulfillmentStatus) {
		return transition
	}

	switch transactionStatus {
	case "pending":
		transition.Status = "UNPAID"
		transition.PaymentStatus = "UNPAID"
		transition.FulfillmentStatus = "WAITING_PAYMENT"
		transition.ProviderStatus = "Waiting Payment"
	case "expire":
		transition.Status = "EXPIRED"
		transition.PaymentStatus = "EXPIRED"
		transition.FulfillmentStatus = "WAITING_PAYMENT"
		transition.ProviderStatus = "Payment Expired"
	case "cancel", "deny", "failure":
		transition.Status = "FAILED"
		transition.PaymentStatus = "FAILED"
		transition.FulfillmentStatus = "WAITING_PAYMENT"
		transition.ProviderStatus = "Payment Failed"
	default:
		return transition
	}

	transition.Changed = transition.Status != trx.Status ||
		transition.PaymentStatus != trx.PaymentStatus ||
		transition.FulfillmentStatus != trx.FulfillmentStatus ||
		transition.ProviderStatus != trx.ProviderStatus
	return transition
}

func applyMidtransNotification(
	c *fiber.Ctx,
	notification midtransNotification,
) (bool, error) {
	shouldExecute := false
	var trx models.Transaction

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.
			Clauses(clause.Locking{Strength: "UPDATE"}).
			Preload("Product").
			Where("invoice_id = ?", strings.TrimSpace(notification.OrderID)).
			First(&trx).Error; err != nil {
			return err
		}
		if !strings.EqualFold(strings.TrimSpace(trx.PaymentProvider), "midtrans") {
			return fmt.Errorf("transaksi bukan milik Midtrans")
		}

		grossAmount, err := strconvParseMidtransAmount(notification.GrossAmount)
		if err != nil {
			return err
		}
		if math.Abs(grossAmount-trx.Amount) >= 0.01 {
			return fmt.Errorf("gross_amount callback tidak sesuai transaksi")
		}

		transition := resolveMidtransPaymentTransition(trx, notification)
		updates := map[string]interface{}{}
		if transition.Changed {
			updates["status"] = transition.Status
			updates["payment_status"] = transition.PaymentStatus
			updates["fulfillment_status"] = transition.FulfillmentStatus
			updates["provider_status"] = transition.ProviderStatus
		}
		if transactionID := strings.TrimSpace(notification.TransactionID); transactionID != "" {
			updates["midtrans_transaction_id"] = transactionID
			updates["payment_reference"] = transactionID
		}
		if len(updates) > 0 {
			if err := tx.Model(&trx).Updates(updates).Error; err != nil {
				return err
			}
			if err := tx.Preload("Product").First(&trx, trx.ID).Error; err != nil {
				return err
			}
		}
		shouldExecute = transition.ShouldExecute
		return nil
	})
	if err != nil {
		return false, err
	}

	if shouldExecute {
		if _, err := executeProviderForTransaction(c, &trx, nil, "WAITING_PAYMENT"); err != nil {
			return false, err
		}
	}
	return shouldExecute, nil
}

func strconvParseMidtransAmount(rawAmount string) (float64, error) {
	amount, err := strconv.ParseFloat(strings.TrimSpace(rawAmount), 64)
	if err != nil || amount < 0 {
		return 0, fmt.Errorf("gross_amount Midtrans tidak valid")
	}
	return amount, nil
}

func MidtransCallbackHandler(c *fiber.Ctx) error {
	serverKey := midtransServerKey()
	if serverKey == "" {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"success": false,
			"reason":  "konfigurasi Midtrans belum lengkap",
		})
	}

	var notification midtransNotification
	if err := json.Unmarshal(c.Body(), &notification); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"reason":  "invalid callback body",
		})
	}
	if !isValidMidtransSignature(notification, serverKey) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"reason":  "invalid callback signature",
		})
	}

	_, err := applyMidtransNotification(c, notification)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) || strings.Contains(err.Error(), "bukan milik Midtrans") {
			return c.JSON(fiber.Map{"success": true})
		}
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"reason":  err.Error(),
		})
	}

	return c.JSON(fiber.Map{"success": true})
}

func fetchMidtransStatus(
	ctx context.Context,
	transactionReference string,
) (midtransNotification, error) {
	serverKey := midtransServerKey()
	if serverKey == "" {
		return midtransNotification{}, fmt.Errorf("MIDTRANS_SERVER_KEY belum dikonfigurasi")
	}
	transactionReference = strings.TrimSpace(transactionReference)
	if transactionReference == "" {
		return midtransNotification{}, fmt.Errorf("referensi transaksi Midtrans kosong")
	}

	endpoint := midtransStatusBaseURL() + "/v2/" + url.PathEscape(transactionReference) + "/status"
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return midtransNotification{}, err
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", midtransAuthorization(serverKey))
	request.Header.Set("transaction-source", "SNAP_API")

	client := &http.Client{Timeout: 8 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return midtransNotification{}, err
	}
	defer response.Body.Close()

	body, err := io.ReadAll(io.LimitReader(response.Body, midtransMaximumResponseBody))
	if err != nil {
		return midtransNotification{}, err
	}
	var notification midtransNotification
	if err := json.Unmarshal(body, &notification); err != nil {
		return midtransNotification{}, fmt.Errorf("response status Midtrans tidak valid")
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return midtransNotification{}, fmt.Errorf("status Midtrans HTTP %d", response.StatusCode)
	}
	if !isValidMidtransSignature(notification, serverKey) {
		return midtransNotification{}, fmt.Errorf("signature status Midtrans tidak valid")
	}
	return notification, nil
}

func reconcileMidtransTransaction(c *fiber.Ctx, trx *models.Transaction) error {
	if !strings.EqualFold(strings.TrimSpace(trx.PaymentProvider), "midtrans") ||
		trx.PaymentStatus == "PAID" ||
		trx.PaymentStatus == "EXPIRED" ||
		trx.PaymentStatus == "FAILED" {
		return nil
	}

	reference := strings.TrimSpace(trx.MidtransTransactionID)
	if reference == "" {
		reference = strings.TrimSpace(trx.InvoiceID)
	}
	ctx, cancel := context.WithTimeout(c.UserContext(), 8*time.Second)
	defer cancel()

	notification, err := fetchMidtransStatus(ctx, reference)
	if err != nil {
		return err
	}
	if strings.TrimSpace(notification.OrderID) != strings.TrimSpace(trx.InvoiceID) {
		return fmt.Errorf("order_id status Midtrans tidak sesuai")
	}
	_, err = applyMidtransNotification(c, notification)
	if err != nil {
		return err
	}
	return database.DB.First(trx, trx.ID).Error
}
