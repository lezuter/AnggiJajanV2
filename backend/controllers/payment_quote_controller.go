package controllers

import (
	"context"
	"fmt"
	"math"
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

func midtransQuoteKey(providerMethod string) string {
	return "v1:midtrans:" + strings.ToLower(strings.TrimSpace(providerMethod))
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

func chooseMidtransRecommendations(options []midtransPaymentMethodOption) []int {
	bestIndex := func(category string, excluded int) int {
		selected := -1
		for index := range options {
			option := options[index]
			if index == excluded || !option.Enabled {
				continue
			}
			if category != "" && option.Category != category {
				continue
			}
			if selected == -1 ||
				option.EstimatedFee < options[selected].EstimatedFee ||
				(option.EstimatedFee == options[selected].EstimatedFee && option.Name < options[selected].Name) {
				selected = index
			}
		}
		return selected
	}

	first := bestIndex("QRIS", -1)
	if first == -1 {
		first = bestIndex("", -1)
	}
	if first == -1 {
		return nil
	}

	second := bestIndex("E_WALLET", first)
	if second == -1 {
		second = bestIndex("", first)
	}
	if second == -1 {
		return []int{first}
	}
	return []int{first, second}
}

func buildMidtransPaymentQuote(
	product models.Product,
	activation midtransPaymentActivation,
) (midtransPaymentQuote, error) {
	config, err := payments.LoadMidtransConfig()
	if err != nil {
		return midtransPaymentQuote{}, err
	}

	capital := math.Round(product.Price)
	targetNet := models.CalculateSellingPrice(capital)
	startingPrice, err := config.StartingPrice(targetNet)
	if err != nil {
		return midtransPaymentQuote{}, err
	}

	minimumNetProfit := paymentSettingFloat("minimum_net_profit", 1500)
	minimumRetention := paymentSettingFloat(
		"minimum_profit_retention_percent",
		50,
	)
	grossProfit := startingPrice - capital
	options := make([]midtransPaymentMethodOption, 0, len(config.Methods))

	for _, method := range config.Methods {
		providerMethod := strings.ToLower(strings.TrimSpace(method.ProviderMethod))
		estimatedFee, feeConfigured := config.EstimateFee(providerMethod, startingPrice)
		netProfit := startingPrice - capital - estimatedFee
		marginAllowed := isPaymentMethodAllowed(
			grossProfit,
			estimatedFee,
			minimumNetProfit,
			minimumRetention,
		)
		disabledReason := midtransDisabledReason(
			method,
			activation,
			activation.Methods[providerMethod],
			feeConfigured,
			startingPrice,
			netProfit,
			marginAllowed,
		)

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
			ServiceFee:         0,
			CustomerSurcharge:  0,
			TotalAmount:        startingPrice,
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
