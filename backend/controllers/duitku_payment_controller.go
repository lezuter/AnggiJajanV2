package controllers

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/derry/anggijajan-v2-backend/database"
	"github.com/derry/anggijajan-v2-backend/models"

	"github.com/gofiber/fiber/v2"
)

const (
	duitkuSandboxBaseURL    = "https://sandbox.duitku.com"
	duitkuProductionBaseURL = "https://passport.duitku.com"
)

type duitkuPaymentMethodRequest struct {
	MerchantCode string `json:"merchantcode"`
	Amount       int64  `json:"amount"`
	DateTime     string `json:"datetime"`
	Signature    string `json:"signature"`
}

type duitkuPaymentMethodItem struct {
	PaymentMethod string `json:"paymentMethod"`
	PaymentName   string `json:"paymentName"`
	PaymentImage  string `json:"paymentImage"`
	TotalFee      string `json:"totalFee"`
}

type duitkuPaymentMethodResponse struct {
	PaymentFee      []duitkuPaymentMethodItem `json:"paymentFee"`
	ResponseCode    string                    `json:"responseCode"`
	ResponseMessage string                    `json:"responseMessage"`
	Message         string                    `json:"Message"`
}

type paymentMethodOption struct {
	Code           string  `json:"code"`
	Name           string  `json:"name"`
	Category       string  `json:"category"`
	ImageURL       string  `json:"image_url"`
	ServiceFee     float64 `json:"service_fee"`
	TotalAmount    float64 `json:"total_amount"`
	Enabled        bool    `json:"enabled"`
	Recommended    bool    `json:"recommended"`
	DisabledReason string  `json:"disabled_reason"`

	merchantFee float64
}

type duitkuFeeRule struct {
	Category   string
	PercentFee float64
	FlatFee    float64
	MinAmount  float64
}

// Estimasi ini dipakai untuk menjaga margin sebelum transaksi dibuat.
// Fee aktual tetap direkonsiliasi dari status transaksi Duitku.
var duitkuFeeRules = map[string]duitkuFeeRule{
	// QRIS
	"SP": {Category: "QRIS", PercentFee: 0.7, MinAmount: 1},
	"NQ": {Category: "QRIS", PercentFee: 0.7, MinAmount: 1},
	"GQ": {Category: "QRIS", PercentFee: 0.7, MinAmount: 1},
	"SQ": {Category: "QRIS", PercentFee: 0.7, MinAmount: 1},

	// Virtual Account
	"AG": {Category: "VIRTUAL_ACCOUNT", FlatFee: 1500, MinAmount: 10000},
	"S1": {Category: "VIRTUAL_ACCOUNT", FlatFee: 1500, MinAmount: 10000},
	"M2": {Category: "VIRTUAL_ACCOUNT", FlatFee: 4000, MinAmount: 10000},
	"BC": {Category: "VIRTUAL_ACCOUNT", FlatFee: 5000, MinAmount: 10000},
	"VA": {Category: "VIRTUAL_ACCOUNT", FlatFee: 3000, MinAmount: 10000},
	"I1": {Category: "VIRTUAL_ACCOUNT", FlatFee: 3000, MinAmount: 10000},
	"B1": {Category: "VIRTUAL_ACCOUNT", FlatFee: 3000, MinAmount: 10000},
	"BT": {Category: "VIRTUAL_ACCOUNT", FlatFee: 3000, MinAmount: 10000},
	"A1": {Category: "VIRTUAL_ACCOUNT", FlatFee: 3000, MinAmount: 10000},
	"NC": {Category: "VIRTUAL_ACCOUNT", FlatFee: 3000, MinAmount: 10000},
	"BR": {Category: "VIRTUAL_ACCOUNT", FlatFee: 3000, MinAmount: 10000},
	"DM": {Category: "VIRTUAL_ACCOUNT", FlatFee: 3000, MinAmount: 10000},
	"BV": {Category: "VIRTUAL_ACCOUNT", FlatFee: 3000, MinAmount: 10000},

	// E-wallet
	"OV": {Category: "E_WALLET", PercentFee: 1.67, MinAmount: 1},
	"DA": {Category: "E_WALLET", PercentFee: 1.67, MinAmount: 1},
	"LA": {Category: "E_WALLET", PercentFee: 1.67, MinAmount: 1},
	"SA": {Category: "E_WALLET", PercentFee: 2, MinAmount: 1},
	"OL": {Category: "E_WALLET", PercentFee: 3.03, MinAmount: 1},
	"SL": {Category: "E_WALLET", PercentFee: 4, MinAmount: 1},
	"LF": {Category: "E_WALLET", FlatFee: 3330, MinAmount: 1},

	// Lainnya
	"VC": {Category: "CREDIT_CARD", PercentFee: 2.9, FlatFee: 2500, MinAmount: 50000},
	"FT": {Category: "RETAIL", FlatFee: 2500, MinAmount: 10000},
	"DN": {Category: "PAYLATER", PercentFee: 2.3, MinAmount: 10000},
	"AT": {Category: "PAYLATER", PercentFee: 5.5, MinAmount: 10000},
	"JP": {Category: "E_BANKING", PercentFee: 2, MinAmount: 1},
}

func duitkuBaseURL() string {
	if customURL := strings.TrimSpace(os.Getenv("DUITKU_BASE_URL")); customURL != "" {
		return strings.TrimRight(customURL, "/")
	}

	switch strings.ToLower(strings.TrimSpace(os.Getenv("DUITKU_MODE"))) {
	case "production", "prod", "live":
		return duitkuProductionBaseURL
	default:
		return duitkuSandboxBaseURL
	}
}

func jakartaNow() time.Time {
	location, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		location = time.FixedZone("Asia/Jakarta", 7*60*60)
	}
	return time.Now().In(location)
}

func duitkuHMACSHA256(message, apiKey string) string {
	mac := hmac.New(sha256.New, []byte(apiKey))
	_, _ = mac.Write([]byte(message))
	return hex.EncodeToString(mac.Sum(nil))
}

func fetchDuitkuPaymentMethods(
	ctx context.Context,
	amount int64,
) ([]duitkuPaymentMethodItem, error) {
	merchantCode := strings.TrimSpace(os.Getenv("DUITKU_MERCHANT_CODE"))
	apiKey := strings.TrimSpace(os.Getenv("DUITKU_API_KEY"))

	if merchantCode == "" || apiKey == "" {
		return nil, fmt.Errorf(
			"DUITKU_MERCHANT_CODE atau DUITKU_API_KEY belum dikonfigurasi",
		)
	}

	dateTime := jakartaNow().Format("2006-01-02 15:04:05")
	stringToSign := merchantCode + strconv.FormatInt(amount, 10) + dateTime

	payload := duitkuPaymentMethodRequest{
		MerchantCode: merchantCode,
		Amount:       amount,
		DateTime:     dateTime,
		Signature:    duitkuHMACSHA256(stringToSign, apiKey),
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("gagal membentuk request Duitku: %w", err)
	}

	endpoint := duitkuBaseURL() +
		"/webapi/api/merchant/paymentmethod/getpaymentmethod"
	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		endpoint,
		bytes.NewReader(body),
	)
	if err != nil {
		return nil, fmt.Errorf("gagal membuat request Duitku: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 12 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("gagal menghubungi Duitku: %w", err)
	}
	defer response.Body.Close()

	responseBody, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("gagal membaca response Duitku: %w", err)
	}

	var result duitkuPaymentMethodResponse
	if err := json.Unmarshal(responseBody, &result); err != nil {
		return nil, fmt.Errorf(
			"response Duitku tidak valid (HTTP %d): %w",
			response.StatusCode,
			err,
		)
	}

	message := strings.TrimSpace(result.ResponseMessage)
	if message == "" {
		message = strings.TrimSpace(result.Message)
	}

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, fmt.Errorf("Duitku HTTP %d: %s", response.StatusCode, message)
	}

	if strings.TrimSpace(result.ResponseCode) != "00" {
		return nil, fmt.Errorf("Duitku menolak request: %s", message)
	}

	return result.PaymentFee, nil
}

func paymentSettingValue(key, fallback string) string {
	var setting models.Setting
	if err := database.DB.Where("key = ?", key).First(&setting).Error; err != nil {
		return fallback
	}

	value := strings.TrimSpace(setting.Value)
	if value == "" {
		return fallback
	}
	return value
}

func paymentSettingFloat(key string, fallback float64) float64 {
	value := paymentSettingValue(key, "")
	if value == "" {
		return fallback
	}

	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil || parsed < 0 {
		return fallback
	}
	return parsed
}

func estimateDuitkuMerchantFee(
	code string,
	amount float64,
) (fee float64, category string, minimumAmount float64, configured bool) {
	rule, exists := duitkuFeeRules[strings.ToUpper(strings.TrimSpace(code))]
	if !exists {
		return 0, "OTHER", 0, false
	}

	fee = rule.FlatFee + (amount * rule.PercentFee / 100)
	return math.Ceil(fee), rule.Category, rule.MinAmount, true
}

// Net profit minimum bersifat adaptif: channel lolos jika memenuhi batas
// nominal minimum ATAU mempertahankan persentase profit yang ditentukan.
// Dengan begitu, produk kecil tidak otomatis kehilangan QRIS.
func isPaymentMethodAllowed(
	grossProfit float64,
	merchantFee float64,
	minimumNetProfit float64,
	minimumRetentionPercent float64,
) bool {
	if grossProfit <= 0 {
		return false
	}

	netProfit := grossProfit - merchantFee
	if netProfit <= 0 {
		return false
	}

	retentionPercent := netProfit / grossProfit * 100
	return netProfit >= minimumNetProfit ||
		retentionPercent >= minimumRetentionPercent
}

func categoryRank(category string) int {
	switch category {
	case "QRIS":
		return 0
	case "VIRTUAL_ACCOUNT":
		return 1
	case "E_WALLET":
		return 2
	case "RETAIL":
		return 3
	case "E_BANKING":
		return 4
	case "CREDIT_CARD":
		return 5
	case "PAYLATER":
		return 6
	default:
		return 7
	}
}

func chooseRecommendedPaymentMethod(options []paymentMethodOption) int {
	bestIndex := -1

	for index := range options {
		if !options[index].Enabled {
			continue
		}

		if bestIndex == -1 {
			bestIndex = index
			continue
		}

		currentCost := options[index].merchantFee + options[index].ServiceFee
		bestCost := options[bestIndex].merchantFee + options[bestIndex].ServiceFee

		if currentCost < bestCost ||
			(currentCost == bestCost &&
				options[index].Category == "QRIS" &&
				options[bestIndex].Category != "QRIS") {
			bestIndex = index
		}
	}

	return bestIndex
}

// GetPaymentMethods hanya mengembalikan informasi yang aman untuk customer.
// Modal, gross profit, net profit, dan fee merchant tidak dikirim ke frontend.
func GetPaymentMethods(c *fiber.Ctx) error {
	productID, err := strconv.ParseUint(
		strings.TrimSpace(c.Query("product_id")),
		10,
		64,
	)
	if err != nil || productID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "product_id tidak valid",
		})
	}

	var product models.Product
	if err := database.DB.
		Preload("ProductGroup").
		First(&product, uint(productID)).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Produk tidak ditemukan",
		})
	}

	if availabilityError := storefrontProductAvailabilityError(product); availabilityError != "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": availabilityError,
		})
	}

	capital := math.Round(product.Price)
	productAmount := models.CalculateSellingPrice(capital)
	grossProfit := productAmount - capital
	feeBearer := strings.ToUpper(
		paymentSettingValue("payment_fee_bearer", "MERCHANT"),
	)
	minimumNetProfit := paymentSettingFloat("minimum_net_profit", 1500)
	minimumRetention := paymentSettingFloat(
		"minimum_profit_retention_percent",
		50,
	)

	requestContext, cancel := context.WithTimeout(c.UserContext(), 15*time.Second)
	defer cancel()

	methods, err := fetchDuitkuPaymentMethods(
		requestContext,
		int64(math.Round(productAmount)),
	)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"error":  "Metode pembayaran belum bisa dimuat",
			"reason": err.Error(),
		})
	}

	options := make([]paymentMethodOption, 0, len(methods))
	for _, method := range methods {
		code := strings.ToUpper(strings.TrimSpace(method.PaymentMethod))
		merchantFee, category, minimumAmount, configured :=
			estimateDuitkuMerchantFee(code, productAmount)

		enabled := configured &&
			productAmount >= minimumAmount &&
			isPaymentMethodAllowed(
				grossProfit,
				merchantFee,
				minimumNetProfit,
				minimumRetention,
			)

		disabledReason := ""
		switch {
		case !configured:
			disabledReason = "Metode ini belum tersedia."
		case productAmount < minimumAmount:
			disabledReason = "Nominal belum memenuhi batas minimum."
		case !enabled:
			disabledReason = "Tidak tersedia untuk nominal ini."
		}

		options = append(options, paymentMethodOption{
			Code:           code,
			Name:           strings.TrimSpace(method.PaymentName),
			Category:       category,
			ImageURL:       strings.TrimSpace(method.PaymentImage),
			ServiceFee:     0,
			TotalAmount:    productAmount,
			Enabled:        enabled,
			DisabledReason: disabledReason,
			merchantFee:    merchantFee,
		})
	}

	if recommendedIndex := chooseRecommendedPaymentMethod(options); recommendedIndex >= 0 {
		options[recommendedIndex].Recommended = true
	}

	sort.SliceStable(options, func(first, second int) bool {
		if options[first].Recommended != options[second].Recommended {
			return options[first].Recommended
		}
		if options[first].Enabled != options[second].Enabled {
			return options[first].Enabled
		}

		firstRank := categoryRank(options[first].Category)
		secondRank := categoryRank(options[second].Category)
		if firstRank != secondRank {
			return firstRank < secondRank
		}
		return options[first].Name < options[second].Name
	})

	return c.JSON(fiber.Map{
		"payment_provider": "duitku",
		"fee_bearer":       feeBearer,
		"product_amount":   productAmount,
		"methods":          options,
	})
}
