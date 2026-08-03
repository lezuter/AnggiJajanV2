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
	duitkuSandboxBaseURL           = "https://sandbox.duitku.com"
	duitkuProductionBaseURL        = "https://passport.duitku.com"
	duitkuMinimumTransactionAmount = 10000
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
	QuoteKey           string  `json:"quote_key"`
	Code               string  `json:"code"`
	Name               string  `json:"name"`
	Category           string  `json:"category"`
	ImageURL           string  `json:"image_url"`
	Enabled            bool    `json:"enabled"`
	DisabledReason     string  `json:"disabled_reason"`
	Provider           string  `json:"provider"`
	ProviderMethod     string  `json:"provider_method"`
	ProductAmount      float64 `json:"product_amount"`
	ServiceFee         float64 `json:"service_fee"`
	CustomerSurcharge  float64 `json:"customer_surcharge"`
	TotalAmount        float64 `json:"total_amount"`
	Recommended        bool    `json:"recommended"`
	RecommendationRank int     `json:"recommendation_rank"`

	merchantFee      float64
	paymentFeeBearer string
	providerActive   bool
	minimumAmount    float64
}

type duitkuFeeRule struct {
	Category                 string
	PercentFee               float64
	FlatFee                  float64
	MinAmount                float64
	RequiresFeeConfiguration bool
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
	// Indomaret mengenakan Rp1.000 + MDR yang nilainya ditentukan oleh Indomaret.
	// Channel dikenali, tetapi tetap disabled sampai komponen MDR dikonfigurasi.
	"IR": {
		Category:                 "RETAIL",
		FlatFee:                  1000,
		MinAmount:                10000,
		RequiresFeeConfiguration: true,
	},
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

type duitkuInquiryItem struct {
	Name     string `json:"name"`
	Price    int64  `json:"price"`
	Quantity int    `json:"quantity"`
}

type duitkuInquiryRequest struct {
	MerchantCode     string              `json:"merchantCode"`
	PaymentAmount    int64               `json:"paymentAmount"`
	PaymentMethod    string              `json:"paymentMethod"`
	MerchantOrderID  string              `json:"merchantOrderId"`
	ProductDetails   string              `json:"productDetails"`
	AdditionalParam  string              `json:"additionalParam"`
	MerchantUserInfo string              `json:"merchantUserInfo"`
	CustomerVAName   string              `json:"customerVaName"`
	Email            string              `json:"email"`
	PhoneNumber      string              `json:"phoneNumber"`
	ItemDetails      []duitkuInquiryItem `json:"itemDetails"`
	CallbackURL      string              `json:"callbackUrl"`
	ReturnURL        string              `json:"returnUrl"`
	Signature        string              `json:"signature"`
	ExpiryPeriod     int                 `json:"expiryPeriod"`
}

type duitkuInquiryResponse struct {
	MerchantCode  string `json:"merchantCode"`
	Reference     string `json:"reference"`
	PaymentURL    string `json:"paymentUrl"`
	VANumber      string `json:"vaNumber"`
	QRString      string `json:"qrString"`
	AppURL        string `json:"AppUrl"`
	AppURLLower   string `json:"appUrl"`
	Amount        string `json:"amount"`
	StatusCode    string `json:"statusCode"`
	StatusMessage string `json:"statusMessage"`
	Message       string `json:"Message"`
}

type duitkuCheckoutMethod struct {
	Code        string
	Name        string
	Category    string
	MerchantFee float64
	FeeBearer   string
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func truncateRunes(value string, limit int) string {
	value = strings.TrimSpace(value)
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit])
}

func resolveDuitkuCustomerEmail(requestEmail string) string {
	return firstNonEmpty(
		requestEmail,
		os.Getenv("DUITKU_DEFAULT_CUSTOMER_EMAIL"),
		"customer@anggijajan.com",
	)
}

func resolveDuitkuCallbackURL() string {
	return firstNonEmpty(
		os.Getenv("DUITKU_CALLBACK_URL"),
		os.Getenv("CALLBACK_URL"),
	)
}

func resolveDuitkuReturnURL() string {
	if configured := strings.TrimSpace(os.Getenv("DUITKU_RETURN_URL")); configured != "" {
		return configured
	}

	frontendURL := strings.TrimRight(strings.TrimSpace(os.Getenv("FRONTEND_URL")), "/")
	if frontendURL != "" {
		return frontendURL + "/cek-pesanan"
	}

	return ""
}

func resolveDuitkuCheckoutMethod(
	ctx context.Context,
	product models.Product,
	requestedCode string,
) (duitkuCheckoutMethod, error) {
	amount := models.CalculateSellingPrice(math.Round(product.Price))
	if amount < duitkuMinimumTransactionAmount {
		return duitkuCheckoutMethod{}, fmt.Errorf(
			"minimum transaksi Duitku Rp%.0f",
			float64(duitkuMinimumTransactionAmount),
		)
	}

	methods, err := fetchDuitkuPaymentMethods(ctx, int64(math.Round(amount)))
	if err != nil {
		return duitkuCheckoutMethod{}, err
	}

	requestedCode = strings.ToUpper(strings.TrimSpace(requestedCode))
	useQRISAlias := requestedCode == "" || requestedCode == "QRIS"

	grossProfit := amount - math.Round(product.Price)
	feeBearer := strings.ToUpper(
		paymentSettingValue("payment_fee_bearer", "MERCHANT"),
	)
	minimumNetProfit := paymentSettingFloat("minimum_net_profit", 1500)
	minimumRetention := paymentSettingFloat(
		"minimum_profit_retention_percent",
		50,
	)

	var selected *duitkuCheckoutMethod

	for _, method := range methods {
		code := strings.ToUpper(strings.TrimSpace(method.PaymentMethod))
		merchantFee, category, minimumAmount, configured :=
			estimateDuitkuMerchantFee(code, amount)

		enabled := configured &&
			amount >= minimumAmount &&
			isPaymentMethodAllowed(
				grossProfit,
				merchantFee,
				minimumNetProfit,
				minimumRetention,
			)
		if !enabled {
			continue
		}

		if useQRISAlias {
			if category != "QRIS" {
				continue
			}
		} else if code != requestedCode {
			continue
		}

		candidate := duitkuCheckoutMethod{
			Code:        code,
			Name:        strings.TrimSpace(method.PaymentName),
			Category:    category,
			MerchantFee: merchantFee,
			FeeBearer:   feeBearer,
		}

		if selected == nil || candidate.MerchantFee < selected.MerchantFee {
			selected = &candidate
		}
	}

	if selected == nil {
		if useQRISAlias {
			return duitkuCheckoutMethod{}, fmt.Errorf(
				"QRIS tidak tersedia untuk produk atau nominal ini",
			)
		}
		return duitkuCheckoutMethod{}, fmt.Errorf(
			"metode pembayaran %s tidak tersedia untuk produk atau nominal ini",
			requestedCode,
		)
	}

	return *selected, nil
}

func requestDuitkuTransaction(
	ctx context.Context,
	invoiceID string,
	amount int64,
	paymentMethod string,
	productName string,
	customerPhone string,
	customerName string,
	customerEmail string,
) (duitkuInquiryResponse, error) {
	merchantCode := strings.TrimSpace(os.Getenv("DUITKU_MERCHANT_CODE"))
	apiKey := strings.TrimSpace(os.Getenv("DUITKU_API_KEY"))
	callbackURL := resolveDuitkuCallbackURL()
	returnURL := resolveDuitkuReturnURL()

	if merchantCode == "" || apiKey == "" {
		return duitkuInquiryResponse{}, fmt.Errorf(
			"DUITKU_MERCHANT_CODE atau DUITKU_API_KEY belum dikonfigurasi",
		)
	}
	if callbackURL == "" {
		return duitkuInquiryResponse{}, fmt.Errorf(
			"DUITKU_CALLBACK_URL belum dikonfigurasi",
		)
	}
	if returnURL == "" {
		return duitkuInquiryResponse{}, fmt.Errorf(
			"DUITKU_RETURN_URL atau FRONTEND_URL belum dikonfigurasi",
		)
	}

	customerName = truncateRunes(
		firstNonEmpty(customerName, "Pelanggan Anggi"),
		20,
	)
	customerEmail = resolveDuitkuCustomerEmail(customerEmail)
	productName = truncateRunes(productName, 255)

	stringToSign := merchantCode + invoiceID + strconv.FormatInt(amount, 10)
	payload := duitkuInquiryRequest{
		MerchantCode:     merchantCode,
		PaymentAmount:    amount,
		PaymentMethod:    strings.ToUpper(strings.TrimSpace(paymentMethod)),
		MerchantOrderID:  invoiceID,
		ProductDetails:   productName,
		AdditionalParam:  "",
		MerchantUserInfo: customerEmail,
		CustomerVAName:   customerName,
		Email:            customerEmail,
		PhoneNumber:      strings.TrimSpace(customerPhone),
		ItemDetails: []duitkuInquiryItem{
			{
				Name:     productName,
				Price:    amount,
				Quantity: 1,
			},
		},
		CallbackURL:  callbackURL,
		ReturnURL:    returnURL,
		Signature:    duitkuHMACSHA256(stringToSign, apiKey),
		ExpiryPeriod: 10,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return duitkuInquiryResponse{}, fmt.Errorf(
			"gagal membentuk inquiry Duitku: %w",
			err,
		)
	}

	endpoint := duitkuBaseURL() + "/webapi/api/merchant/v2/inquiry"
	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		endpoint,
		bytes.NewReader(body),
	)
	if err != nil {
		return duitkuInquiryResponse{}, fmt.Errorf(
			"gagal membuat inquiry Duitku: %w",
			err,
		)
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return duitkuInquiryResponse{}, fmt.Errorf(
			"gagal menghubungi Duitku: %w",
			err,
		)
	}
	defer response.Body.Close()

	responseBody, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if err != nil {
		return duitkuInquiryResponse{}, fmt.Errorf(
			"gagal membaca inquiry Duitku: %w",
			err,
		)
	}

	var result duitkuInquiryResponse
	if err := json.Unmarshal(responseBody, &result); err != nil {
		return duitkuInquiryResponse{}, fmt.Errorf(
			"response inquiry Duitku tidak valid (HTTP %d): %w",
			response.StatusCode,
			err,
		)
	}

	message := firstNonEmpty(
		result.StatusMessage,
		result.Message,
		http.StatusText(response.StatusCode),
	)
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return duitkuInquiryResponse{}, fmt.Errorf(
			"Duitku HTTP %d: %s",
			response.StatusCode,
			message,
		)
	}
	if strings.TrimSpace(result.StatusCode) != "00" {
		return duitkuInquiryResponse{}, fmt.Errorf(
			"Duitku menolak transaksi: %s",
			message,
		)
	}
	if strings.TrimSpace(result.Reference) == "" ||
		strings.TrimSpace(result.PaymentURL) == "" {
		return duitkuInquiryResponse{}, fmt.Errorf(
			"response Duitku tidak memiliki reference atau paymentUrl",
		)
	}

	if result.AppURL == "" {
		result.AppURL = result.AppURLLower
	}

	return result, nil
}
func paymentSettingValue(key, fallback string) string {
	if database.DB == nil {
		return fallback
	}

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
	minimumAmount = math.Max(duitkuMinimumTransactionAmount, rule.MinAmount)

	return math.Ceil(fee),
		rule.Category,
		minimumAmount,
		!rule.RequiresFeeConfiguration
}

func paymentQuoteKey(provider, providerMethod string) string {
	return fmt.Sprintf(
		"v1:%s:%s",
		strings.ToLower(strings.TrimSpace(provider)),
		strings.ToUpper(strings.TrimSpace(providerMethod)),
	)
}

// calculateQuotedTotal mencari nominal rupiah bulat terkecil yang tetap
// menyisakan targetNet setelah merchant fee dihitung dari nominal final itu.
func calculateQuotedTotal(
	targetNet float64,
	estimateMerchantFee func(totalAmount float64) float64,
) (totalAmount float64, merchantFee float64) {
	targetNet = math.Ceil(targetNet)
	totalAmount = targetNet

	for iteration := 0; iteration < 32; iteration++ {
		merchantFee = math.Ceil(estimateMerchantFee(totalAmount))
		if merchantFee < 0 {
			merchantFee = 0
		}

		requiredTotal := math.Ceil(targetNet + merchantFee)
		if totalAmount >= requiredTotal {
			return totalAmount, merchantFee
		}
		totalAmount = requiredTotal
	}

	merchantFee = math.Ceil(estimateMerchantFee(totalAmount))
	if totalAmount-merchantFee < targetNet {
		totalAmount = math.Ceil(targetNet + merchantFee)
		merchantFee = math.Ceil(estimateMerchantFee(totalAmount))
	}

	return totalAmount, merchantFee
}

func isBetterQRISQuote(candidate, current paymentMethodOption) bool {
	if candidate.Enabled != current.Enabled {
		return candidate.Enabled
	}
	if candidate.TotalAmount != current.TotalAmount {
		return candidate.TotalAmount < current.TotalAmount
	}
	if candidate.merchantFee != current.merchantFee {
		return candidate.merchantFee < current.merchantFee
	}
	return candidate.ProviderMethod < current.ProviderMethod
}

// logicalPaymentQuotes menghapus duplikasi response gateway dan merangkum
// seluruh varian QRIS menjadi satu pilihan generik. ProviderMethod tetap
// menyimpan channel aktual yang akan digunakan saat inquiry.
func logicalPaymentQuotes(options []paymentMethodOption) []paymentMethodOption {
	unique := make(map[string]paymentMethodOption, len(options))
	order := make([]string, 0, len(options))
	var qris *paymentMethodOption

	for _, option := range options {
		if option.Category == "QRIS" {
			candidate := option
			if qris == nil || isBetterQRISQuote(candidate, *qris) {
				qris = &candidate
			}
			continue
		}

		key := strings.ToLower(option.Provider) + "|" +
			strings.ToUpper(option.ProviderMethod)
		if current, exists := unique[key]; exists {
			if isBetterQRISQuote(option, current) {
				unique[key] = option
			}
			continue
		}

		unique[key] = option
		order = append(order, key)
	}

	result := make([]paymentMethodOption, 0, len(unique)+1)
	if qris != nil {
		qris.Code = "QRIS"
		qris.Name = "QRIS"
		qris.Category = "QRIS"
		qris.ImageURL = ""
		result = append(result, *qris)
	}

	for _, key := range order {
		result = append(result, unique[key])
	}

	return result
}

func finalizePaymentQuotes(options []paymentMethodOption) []paymentMethodOption {
	options = logicalPaymentQuotes(options)

	for index := range options {
		options[index].Recommended = false
		options[index].RecommendationRank = 0
	}

	for rank, optionIndex := range chooseRecommendedPaymentMethods(options) {
		options[optionIndex].RecommendationRank = rank + 1
		options[optionIndex].Recommended = rank == 0
	}

	sort.SliceStable(options, func(first, second int) bool {
		firstRanked := options[first].RecommendationRank > 0
		secondRanked := options[second].RecommendationRank > 0

		if firstRanked != secondRanked {
			return firstRanked
		}
		if firstRanked &&
			options[first].RecommendationRank != options[second].RecommendationRank {
			return options[first].RecommendationRank <
				options[second].RecommendationRank
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

	return options
}

func buildDuitkuPaymentQuotes(
	ctx context.Context,
	product models.Product,
) ([]paymentMethodOption, error) {
	capital := math.Round(product.Price)
	targetNet := models.CalculateSellingPrice(capital)
	methods, err := fetchDuitkuPaymentMethods(
		ctx,
		int64(math.Round(targetNet)),
	)
	if err != nil {
		return nil, err
	}

	feeBearer := strings.ToUpper(
		paymentSettingValue("payment_fee_bearer", "MERCHANT"),
	)
	options := make([]paymentMethodOption, 0, len(methods))

	for _, method := range methods {
		code := strings.ToUpper(strings.TrimSpace(method.PaymentMethod))
		_, category, minimumAmount, configured :=
			estimateDuitkuMerchantFee(code, targetNet)
		totalAmount, merchantFee := calculateQuotedTotal(
			targetNet,
			func(amount float64) float64 {
				fee, _, _, _ := estimateDuitkuMerchantFee(code, amount)
				return fee
			},
		)

		enabled := configured &&
			targetNet >= duitkuMinimumTransactionAmount &&
			totalAmount >= minimumAmount
		disabledReason := ""
		switch {
		case targetNet < duitkuMinimumTransactionAmount:
			disabledReason = "Metode ini tersedia melalui Tripay untuk nominal di bawah Rp10.000."
		case !configured && category != "OTHER":
			disabledReason = "Biaya metode ini belum dikonfigurasi."
		case !configured:
			disabledReason = "Metode ini belum tersedia."
		case totalAmount < minimumAmount:
			disabledReason = "Nominal belum memenuhi batas minimum."
		}

		customerSurcharge := totalAmount - targetNet
		options = append(options, paymentMethodOption{
			QuoteKey:          paymentQuoteKey("duitku", code),
			Code:              code,
			Name:              strings.TrimSpace(method.PaymentName),
			Category:          category,
			ImageURL:          strings.TrimSpace(method.PaymentImage),
			Enabled:           enabled,
			DisabledReason:    disabledReason,
			Provider:          "duitku",
			ProviderMethod:    code,
			ProductAmount:     targetNet,
			ServiceFee:        customerSurcharge,
			CustomerSurcharge: customerSurcharge,
			TotalAmount:       totalAmount,
			merchantFee:       merchantFee,
			paymentFeeBearer:  feeBearer,
		})
	}

	return finalizePaymentQuotes(options), nil
}

// Setelah batas minimum gateway terpenuhi, net profit minimum bersifat
// adaptif: channel lolos jika memenuhi batas nominal minimum ATAU
// mempertahankan persentase profit yang ditentukan.
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

func paymentMethodCost(option paymentMethodOption) float64 {
	return option.TotalAmount
}

func isBetterPaymentMethod(
	candidate paymentMethodOption,
	current paymentMethodOption,
) bool {
	candidateCost := paymentMethodCost(candidate)
	currentCost := paymentMethodCost(current)

	if candidateCost != currentCost {
		return candidateCost < currentCost
	}

	if candidate.Category == "QRIS" && current.Category != "QRIS" {
		return true
	}
	if candidate.Category != "QRIS" && current.Category == "QRIS" {
		return false
	}

	candidateRank := categoryRank(candidate.Category)
	currentRank := categoryRank(current.Category)
	if candidateRank != currentRank {
		return candidateRank < currentRank
	}

	if candidate.Name != current.Name {
		return candidate.Name < current.Name
	}

	return candidate.Code < current.Code
}

// Ranking dibuat sepenuhnya di backend karena hanya backend yang mengetahui
// estimasi merchant fee. Rank kedua wajib berasal dari kategori berbeda agar
// beberapa channel QRIS yang identik tidak memenuhi kedua slot rekomendasi.
func chooseBestPaymentMethodIndex(
	options []paymentMethodOption,
	category string,
	excludedIndex int,
	requireDifferentCategory string,
) int {
	bestIndex := -1

	for index := range options {
		if !options[index].Enabled || index == excludedIndex {
			continue
		}
		if category != "" && options[index].Category != category {
			continue
		}
		if requireDifferentCategory != "" &&
			options[index].Category == requireDifferentCategory {
			continue
		}

		if bestIndex == -1 ||
			isBetterPaymentMethod(options[index], options[bestIndex]) {
			bestIndex = index
		}
	}

	return bestIndex
}

// Kebijakan rekomendasi menggabungkan kemudahan penggunaan dan biaya:
// 1. QRIS selalu menjadi pilihan utama selama aktif dan margin tetap aman.
// 2. Pilihan kedua adalah e-wallet termurah yang aktif dan margin aman.
// 3. Jika e-wallet tidak tersedia, gunakan metode termurah dari kategori lain.
//
// Tidak ada brand e-wallet yang di-hardcode.
func chooseRecommendedPaymentMethods(
	options []paymentMethodOption,
) []int {
	firstIndex := chooseBestPaymentMethodIndex(
		options,
		"QRIS",
		-1,
		"",
	)

	if firstIndex == -1 {
		firstIndex = chooseBestPaymentMethodIndex(
			options,
			"",
			-1,
			"",
		)
	}
	if firstIndex == -1 {
		return nil
	}

	secondIndex := chooseBestPaymentMethodIndex(
		options,
		"E_WALLET",
		firstIndex,
		"",
	)

	if secondIndex == -1 {
		secondIndex = chooseBestPaymentMethodIndex(
			options,
			"",
			firstIndex,
			options[firstIndex].Category,
		)
	}

	if secondIndex == -1 {
		return []int{firstIndex}
	}

	return []int{firstIndex, secondIndex}
}

func buildPaymentQuotes(
	ctx context.Context,
	product models.Product,
) ([]paymentMethodOption, string, error) {
	targetNet := models.CalculateSellingPrice(math.Round(product.Price))
	if targetNet < duitkuMinimumTransactionAmount {
		options, err := buildTripayPaymentQuotes(ctx, product)
		return options, "tripay", err
	}

	options, err := buildDuitkuPaymentQuotes(ctx, product)
	return options, "duitku", err
}

func findPaymentQuote(
	options []paymentMethodOption,
	quoteKey string,
) (paymentMethodOption, bool) {
	quoteKey = strings.TrimSpace(quoteKey)
	for _, option := range options {
		if option.QuoteKey == quoteKey {
			return option, true
		}
	}
	return paymentMethodOption{}, false
}

func minimumLogicalTransactionAmount(
	options []paymentMethodOption,
) (float64, bool) {
	minimumAmount := 0.0
	found := false

	for _, option := range options {
		if !option.providerActive {
			continue
		}
		if !found || option.minimumAmount < minimumAmount {
			minimumAmount = option.minimumAmount
			found = true
		}
	}

	return minimumAmount, found
}

func paymentMethodsResponse(
	paymentProvider string,
	feeBearer string,
	productAmount float64,
	options []paymentMethodOption,
) fiber.Map {
	response := fiber.Map{
		"payment_provider": paymentProvider,
		"fee_bearer":       feeBearer,
		"product_amount":   productAmount,
		"methods":          options,
	}

	if paymentProvider == "duitku" {
		response["minimum_transaction_amount"] = duitkuMinimumTransactionAmount
	} else if minimumAmount, found := minimumLogicalTransactionAmount(options); found {
		response["minimum_transaction_amount"] = minimumAmount
	}

	return response
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

	requestContext, cancel := context.WithTimeout(c.UserContext(), 15*time.Second)
	defer cancel()

	options, paymentProvider, err := buildPaymentQuotes(requestContext, product)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"error":  "Metode pembayaran belum bisa dimuat",
			"reason": err.Error(),
		})
	}

	productAmount := models.CalculateSellingPrice(math.Round(product.Price))
	feeBearer := strings.ToUpper(
		paymentSettingValue("payment_fee_bearer", "MERCHANT"),
	)

	return c.JSON(paymentMethodsResponse(
		paymentProvider,
		feeBearer,
		productAmount,
		options,
	))
}
