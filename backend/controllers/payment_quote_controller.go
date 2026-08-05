package controllers

import (
	"context"
	"fmt"
	"math"
	"os"
	"sort"
	"strconv"
	"strings"
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

func midtransQuoteKey(providerMethod string) string {
	return "v1:midtrans:" + strings.ToLower(strings.TrimSpace(providerMethod))
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
	startingPrice float64,
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
	case startingPrice < method.MinimumAmount:
		return fmt.Sprintf("Minimum transaksi %s", formatRupiahAmount(method.MinimumAmount))
	case method.MaximumAmount > 0 && startingPrice > method.MaximumAmount:
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

func midtransKredivoCheckoutReady() bool {
	value := strings.ToLower(strings.TrimSpace(
		os.Getenv("MIDTRANS_KREDIVO_CHECKOUT_READY"),
	))
	switch value {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

const midtransPaymentLogoSettingPrefix = "payment_logo_midtrans_"

func applyMidtransPaymentLogoOverrides(config *payments.MidtransConfig) {
	if config == nil || database.DB == nil {
		return
	}

	var settings []models.Setting
	if err := database.DB.
		Where("key LIKE ?", midtransPaymentLogoSettingPrefix+"%").
		Find(&settings).Error; err != nil {
		return
	}

	overrides := make(map[string]string, len(settings))
	for _, setting := range settings {
		providerMethod := strings.TrimPrefix(
			strings.TrimSpace(setting.Key),
			midtransPaymentLogoSettingPrefix,
		)
		imageURL := strings.TrimSpace(setting.Value)
		if providerMethod == "" || imageURL == "" {
			continue
		}
		overrides[strings.ToLower(providerMethod)] = imageURL
	}

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
) (midtransPaymentQuote, error) {
	config, err := payments.LoadMidtransConfig()
	if err != nil {
		return midtransPaymentQuote{}, err
	}

	applyMidtransPaymentLogoOverrides(&config)

	capital := math.Round(product.Price)
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

		disabledReason := midtransDisabledReason(
			method,
			activation,
			activation.Methods[providerMethod],
			feeConfigured,
			startingPrice,
			netProfit,
			marginAllowed,
		)

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
		if disabledReason == "" &&
			providerMethod == "kredivo" &&
			!midtransKredivoCheckoutReady() {
			disabledReason =
				"Kredivo membutuhkan data alamat pelanggan lengkap"
		}

		options = append(options, midtransPaymentMethodOption{
			QuoteKey:           midtransQuoteKey(providerMethod),
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
		FeeBearer:       "MERCHANT",
		ProductAmount:   targetNet,
		StartingPrice:   startingPrice,
		Methods:         options,
	}, nil
}

func buildCurrentMidtransPaymentQuote(
	ctx context.Context,
	product models.Product,
) (midtransPaymentQuote, error) {
	activation := getMidtransPaymentActivation(ctx)
	return buildMidtransPaymentQuote(product, activation)
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
	productID, err := strconv.ParseUint(strings.TrimSpace(c.Query("product_id")), 10, 64)
	if err != nil || productID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "product_id tidak valid",
		})
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

	requestContext, cancel := context.WithTimeout(c.UserContext(), 10*time.Second)
	defer cancel()

	quote, err := buildCurrentMidtransPaymentQuote(requestContext, product)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":  "Metode pembayaran belum bisa dimuat",
			"reason": err.Error(),
		})
	}

	return c.JSON(quote)
}
