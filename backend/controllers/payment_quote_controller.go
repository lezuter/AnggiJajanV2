package controllers

import (
	"context"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/derry/anggijajan-v2-backend/database"
	"github.com/derry/anggijajan-v2-backend/models"
	"github.com/derry/anggijajan-v2-backend/payments"

	"github.com/gofiber/fiber/v2"
)

type midtransPaymentMethodOption struct {
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
	BasePrice          float64 `json:"base_price"`
	ServiceFee         float64 `json:"service_fee"`
	CustomerSurcharge  float64 `json:"customer_surcharge"`
	TotalAmount        float64 `json:"total_amount"`
	EstimatedFee       float64 `json:"estimated_fee"`
	EstimatedNetProfit float64 `json:"estimated_net_profit"`
	Recommended        bool    `json:"recommended"`
	RecommendationRank int     `json:"recommendation_rank"`

	minimumAmount float64
	maximumAmount float64
}

type midtransPaymentQuote struct {
	PaymentProvider string                        `json:"payment_provider"`
	FeeBearer       string                        `json:"fee_bearer"`
	ProductAmount   float64                       `json:"product_amount"`
	StartingPrice   float64                       `json:"starting_price"`
	Methods         []midtransPaymentMethodOption `json:"methods"`
}

const (
	defaultPaymentSurchargeProfitRetentionPercent = 70.0
	paymentSurchargeProfitRetentionSettingKey     = "payment_surcharge_profit_retention_percent"

	defaultPaymentMaximumCustomerSurchargePercent = 30.0
	paymentMaximumCustomerSurchargeSettingKey     = "payment_max_customer_surcharge_percent"
)

func midtransQuoteKey(providerMethod string, quantity int) string {
	return fmt.Sprintf(
		"v2:midtrans:%s:q%d",
		strings.ToLower(strings.TrimSpace(providerMethod)),
		quantity,
	)
}

func paymentSurchargeProfitRetentionPercent() float64 {
	retentionPercent := paymentSettingFloat(
		paymentSurchargeProfitRetentionSettingKey,
		defaultPaymentSurchargeProfitRetentionPercent,
	)
	return math.Min(100, math.Max(0, retentionPercent))
}

func paymentMaximumCustomerSurchargePercent() float64 {
	maximumPercent := paymentSettingFloat(
		paymentMaximumCustomerSurchargeSettingKey,
		defaultPaymentMaximumCustomerSurchargePercent,
	)
	return math.Max(0, maximumPercent)
}

func isCustomerSurchargeWorthwhile(
	basePrice float64,
	customerSurcharge float64,
	maximumPercent float64,
) bool {
	if customerSurcharge <= 0 {
		return true
	}
	if basePrice <= 0 {
		return false
	}

	surchargePercent := customerSurcharge / basePrice * 100
	return surchargePercent <= maximumPercent
}

func calculateMidtransRetentionTarget(
	capital float64,
	targetNet float64,
	retentionPercent float64,
) (requiredMerchantNet float64, minimumRetainedProfit float64) {
	capital = math.Ceil(capital)
	targetNet = math.Ceil(targetNet)
	retentionPercent = math.Min(100, math.Max(0, retentionPercent))

	targetProductProfit := math.Max(0, targetNet-capital)
	minimumRetainedProfit = math.Ceil(
		targetProductProfit * retentionPercent / 100,
	)
	requiredMerchantNet = math.Ceil(capital + minimumRetainedProfit)
	return requiredMerchantNet, minimumRetainedProfit
}

// calculateMidtransProfitProtectedTotal mempertahankan startingPrice sebagai
// baseline publik. Customer hanya membayar tambahan jika hasil bersih metode
// turun di bawah batas profit minimum yang wajib dipertahankan merchant.
func calculateMidtransProfitProtectedTotal(
	config payments.MidtransConfig,
	providerMethod string,
	startingPrice float64,
	requiredMerchantNet float64,
) (totalAmount float64, estimatedFee float64, configured bool) {
	totalAmount = math.Max(
		math.Ceil(startingPrice),
		math.Ceil(requiredMerchantNet),
	)
	requiredMerchantNet = math.Ceil(requiredMerchantNet)

	for iteration := 0; iteration < 64; iteration++ {
		fee, feeConfigured := config.EstimateFee(providerMethod, totalAmount)
		if !feeConfigured {
			return totalAmount, 0, false
		}

		estimatedFee = math.Ceil(math.Max(0, fee))
		if totalAmount-estimatedFee >= requiredMerchantNet {
			return totalAmount, estimatedFee, true
		}

		requiredTotal := math.Ceil(requiredMerchantNet + estimatedFee)
		if requiredTotal <= totalAmount {
			requiredTotal = totalAmount + 1
		}
		totalAmount = requiredTotal
	}

	fee, feeConfigured := config.EstimateFee(providerMethod, totalAmount)
	if !feeConfigured {
		return totalAmount, 0, false
	}

	return totalAmount, math.Ceil(math.Max(0, fee)), true
}

func formatRupiahAmount(amount float64) string {
	digits := strconv.FormatInt(int64(math.Round(amount)), 10)
	for index := len(digits) - 3; index > 0; index -= 3 {
		digits = digits[:index] + "." + digits[index:]
	}
	return "Rp" + digits
}

func midtransDisabledReason(
	method payments.MidtransMethod,
	activation midtransPaymentActivation,
	providerActive bool,
	feeConfigured bool,
	transactionAmount float64,
	netProfit float64,
	marginAllowed bool,
) string {
	switch {
	case !activation.Verified:
		return firstNonEmpty(
			activation.DisabledReason,
			midtransPreferenceUnavailableReason,
		)
	case !providerActive:
		return "Metode belum aktif di akun Midtrans"
	case transactionAmount < method.MinimumAmount:
		return fmt.Sprintf("Minimum transaksi %s", formatRupiahAmount(method.MinimumAmount))
	case method.MaximumAmount > 0 && transactionAmount > method.MaximumAmount:
		return fmt.Sprintf("Maksimum transaksi %s", formatRupiahAmount(method.MaximumAmount))
	case !feeConfigured:
		return "Aturan biaya metode belum dikonfigurasi"
	case netProfit <= 0:
		return "Biaya metode melebihi margin produk"
	case !marginAllowed:
		return "Margin bersih metode belum memenuhi kebijakan"
	default:
		return ""
	}
}

func isBetterMidtransRecommendation(
	candidate midtransPaymentMethodOption,
	current midtransPaymentMethodOption,
) bool {
	if candidate.TotalAmount != current.TotalAmount {
		return candidate.TotalAmount < current.TotalAmount
	}
	if candidate.CustomerSurcharge != current.CustomerSurcharge {
		return candidate.CustomerSurcharge < current.CustomerSurcharge
	}
	if candidate.EstimatedFee != current.EstimatedFee {
		return candidate.EstimatedFee < current.EstimatedFee
	}
	if candidate.Category == "QRIS" && current.Category != "QRIS" {
		return true
	}
	if candidate.Category != "QRIS" && current.Category == "QRIS" {
		return false
	}
	if candidate.Name != current.Name {
		return candidate.Name < current.Name
	}
	return candidate.ProviderMethod < current.ProviderMethod
}

func chooseMidtransRecommendations(options []midtransPaymentMethodOption) []int {
	rankedIndexes := make([]int, 0, len(options))
	for index := range options {
		if options[index].Enabled {
			rankedIndexes = append(rankedIndexes, index)
		}
	}

	sort.SliceStable(rankedIndexes, func(first, second int) bool {
		return isBetterMidtransRecommendation(
			options[rankedIndexes[first]],
			options[rankedIndexes[second]],
		)
	})

	if len(rankedIndexes) > 2 {
		rankedIndexes = rankedIndexes[:2]
	}
	return rankedIndexes
}

func midtransPaylaterDisabledReason(providerMethod string) string {
	providerMethod = strings.ToLower(strings.TrimSpace(providerMethod))
	switch providerMethod {
	case "kredivo":
		return "Kredivo belum tersedia sampai data alamat pelanggan lengkap dan pengujian provider selesai"
	case "akulaku":
		mode, err := payments.ResolveMidtransMode()
		if err != nil || mode == "production" {
			return "Akulaku membutuhkan nama, email, dan nomor telepon pembayar asli"
		}
	}
	return ""
}

const (
	midtransPaymentLogoSettingPrefix = "payment_logo_midtrans_"
	midtransPaymentLogoCacheTTL      = 30 * time.Second
)

var (
	midtransPaymentLogoCacheMu        sync.RWMutex
	midtransPaymentLogoCacheExpiresAt time.Time
	midtransPaymentLogoCache          map[string]string
)

func cloneStringMap(values map[string]string) map[string]string {
	clone := make(map[string]string, len(values))
	for key, value := range values {
		clone[key] = value
	}
	return clone
}

func invalidateMidtransPaymentLogoCache() {
	midtransPaymentLogoCacheMu.Lock()
	defer midtransPaymentLogoCacheMu.Unlock()
	midtransPaymentLogoCache = nil
	midtransPaymentLogoCacheExpiresAt = time.Time{}
}

func loadMidtransPaymentLogoOverrides() map[string]string {
	if database.DB == nil {
		return map[string]string{}
	}

	now := time.Now()
	midtransPaymentLogoCacheMu.RLock()
	if midtransPaymentLogoCache != nil &&
		now.Before(midtransPaymentLogoCacheExpiresAt) {
		cached := cloneStringMap(midtransPaymentLogoCache)
		midtransPaymentLogoCacheMu.RUnlock()
		return cached
	}
	midtransPaymentLogoCacheMu.RUnlock()

	var settings []models.Setting
	if err := database.DB.
		Where("key LIKE ?", midtransPaymentLogoSettingPrefix+"%").
		Find(&settings).Error; err != nil {
		return map[string]string{}
	}

	overrides := make(map[string]string, len(settings))
	for _, setting := range settings {
		providerMethod := strings.TrimPrefix(
			strings.TrimSpace(setting.Key),
			midtransPaymentLogoSettingPrefix,
		)
		imageURL := strings.TrimSpace(setting.Value)
		if providerMethod == "" ||
			imageURL == "" ||
			!isValidPaymentLogoURL(imageURL) {
			continue
		}
		overrides[strings.ToLower(providerMethod)] = imageURL
	}

	midtransPaymentLogoCacheMu.Lock()
	midtransPaymentLogoCache = cloneStringMap(overrides)
	midtransPaymentLogoCacheExpiresAt = now.Add(midtransPaymentLogoCacheTTL)
	midtransPaymentLogoCacheMu.Unlock()
	return overrides
}

func applyMidtransPaymentLogoOverrides(config *payments.MidtransConfig) {
	if config == nil {
		return
	}

	overrides := loadMidtransPaymentLogoOverrides()
	for index := range config.Methods {
		providerMethod := strings.ToLower(
			strings.TrimSpace(config.Methods[index].ProviderMethod),
		)
		if imageURL := overrides[providerMethod]; imageURL != "" {
			config.Methods[index].ImageURL = imageURL
		}
	}
}

func buildMidtransPaymentQuote(
	product models.Product,
	activation midtransPaymentActivation,
	quantity int,
) (midtransPaymentQuote, error) {

	// Normalisasi quantity
	if quantity <= 0 {
		quantity = 1
	}

	config, err := payments.LoadMidtransConfig()
	if err != nil {
		return midtransPaymentQuote{}, err
	}

	applyMidtransPaymentLogoOverrides(&config)

	unitCapital := math.Round(product.Price)
	capital := unitCapital * float64(quantity)
	var groupMarkup *float64
	if product.ProductGroup != nil {
		groupMarkup = product.ProductGroup.MarkupPercent
	}
	effectiveMarkupRate := models.ResolveStorefrontMarkupRate(
		product.Catalog.MarkupPercent,
		groupMarkup,
	)
	targetNet := models.CalculateSellingPriceWithMarkup(
		capital,
		effectiveMarkupRate,
	)
	startingPrice, err := config.StartingPrice(targetNet)
	if err != nil {
		return midtransPaymentQuote{}, err
	}

	minimumNetProfit := paymentSettingFloat("minimum_net_profit", 1500)
	profitRetentionPercent := paymentSurchargeProfitRetentionPercent()
	maximumCustomerSurchargePercent :=
		paymentMaximumCustomerSurchargePercent()
	requiredMerchantNet, minimumRetainedProfit :=
		calculateMidtransRetentionTarget(
			capital,
			targetNet,
			profitRetentionPercent,
		)
	targetProductProfit := math.Max(0, targetNet-capital)
	options := make([]midtransPaymentMethodOption, 0, len(config.Methods))

	for _, method := range config.Methods {
		providerMethod := strings.ToLower(
			strings.TrimSpace(method.ProviderMethod),
		)
		totalAmount, estimatedFee, feeConfigured :=
			calculateMidtransProfitProtectedTotal(
				config,
				providerMethod,
				startingPrice,
				requiredMerchantNet,
			)
		customerSurcharge := math.Max(0, totalAmount-startingPrice)
		netProfit := totalAmount - capital - estimatedFee
		absorbedProfit := math.Max(0, targetProductProfit-netProfit)
		marginAllowed := isPaymentMethodAllowed(
			targetProductProfit,
			absorbedProfit,
			minimumNetProfit,
			profitRetentionPercent,
		)
		if netProfit < minimumRetainedProfit {
			marginAllowed = false
		}

		providerActive := activation.Methods[providerMethod]
		providerInactiveReason := ""
		if providerMethod == "google_pay" && providerActive {
			cardActive := activation.Methods["credit_card"] ||
				activation.Methods["card"]
			if !cardActive {
				providerActive = false
				providerInactiveReason =
					"Google Pay membutuhkan channel kartu aktif"
			}
		}

		disabledReason := midtransDisabledReason(
			method,
			activation,
			providerActive,
			feeConfigured,
			totalAmount,
			netProfit,
			marginAllowed,
		)
		if disabledReason == "Metode belum aktif di akun Midtrans" &&
			providerInactiveReason != "" {
			disabledReason = providerInactiveReason
		}

		if disabledReason == "" &&
			!isCustomerSurchargeWorthwhile(
				startingPrice,
				customerSurcharge,
				maximumCustomerSurchargePercent,
			) {
			disabledReason = fmt.Sprintf(
				"Biaya metode terlalu besar untuk nominal ini (batas %.0f%%)",
				maximumCustomerSurchargePercent,
			)
		}
		if disabledReason == "" {
			if reason := midtransPaylaterDisabledReason(providerMethod); reason != "" {
				disabledReason = reason
			}
		}

		options = append(options, midtransPaymentMethodOption{
			QuoteKey:           midtransQuoteKey(providerMethod, quantity),
			Code:               method.Code,
			Name:               method.Name,
			Category:           method.Category,
			ImageURL:           method.ImageURL,
			Enabled:            disabledReason == "",
			DisabledReason:     disabledReason,
			Provider:           "midtrans",
			ProviderMethod:     providerMethod,
			ProductAmount:      targetNet,
			BasePrice:          startingPrice,
			ServiceFee:         customerSurcharge,
			CustomerSurcharge:  customerSurcharge,
			TotalAmount:        totalAmount,
			EstimatedFee:       estimatedFee,
			EstimatedNetProfit: netProfit,
			minimumAmount:      method.MinimumAmount,
			maximumAmount:      method.MaximumAmount,
		})
	}

	for rank, optionIndex := range chooseMidtransRecommendations(options) {
		options[optionIndex].Recommended = true
		options[optionIndex].RecommendationRank = rank + 1
	}

	sort.SliceStable(options, func(first, second int) bool {
		firstRank := options[first].RecommendationRank
		secondRank := options[second].RecommendationRank
		if firstRank > 0 || secondRank > 0 {
			if firstRank == 0 {
				return false
			}
			if secondRank == 0 {
				return true
			}
			return firstRank < secondRank
		}
		if options[first].Enabled != options[second].Enabled {
			return options[first].Enabled
		}
		return false
	})

	return midtransPaymentQuote{
		PaymentProvider: "midtrans",
		FeeBearer:       "DYNAMIC",
		ProductAmount:   targetNet,
		StartingPrice:   startingPrice,
		Methods:         options,
	}, nil
}

func buildCurrentMidtransPaymentQuote(
	ctx context.Context,
	product models.Product,
	quantity int,
) (midtransPaymentQuote, error) {
	activation := getMidtransPaymentActivation(ctx)

	return buildMidtransPaymentQuote(
		product,
		activation,
		quantity,
	)
}

func findMidtransPaymentQuote(
	quote midtransPaymentQuote,
	quoteKey string,
) (midtransPaymentMethodOption, bool) {
	quoteKey = strings.TrimSpace(quoteKey)
	for _, method := range quote.Methods {
		if method.QuoteKey == quoteKey {
			return method, true
		}
	}
	return midtransPaymentMethodOption{}, false
}

func GetMidtransPaymentMethods(c *fiber.Ctx) error {
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

	quantity, err := strconv.Atoi(
		strings.TrimSpace(c.Query("quantity")),
	)
	if err != nil || quantity <= 0 {
		quantity = 1
	}

	var product models.Product
	if err := database.DB.
		Preload("Catalog").
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

	requestContext, cancel := context.WithTimeout(
		c.UserContext(),
		10*time.Second,
	)
	defer cancel()

	quote, err := buildCurrentMidtransPaymentQuote(
		requestContext,
		product,
		quantity,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":  "Metode pembayaran belum bisa dimuat",
			"reason": err.Error(),
		})
	}

	return c.JSON(quote)
}
