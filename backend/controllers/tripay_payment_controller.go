package controllers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/derry/anggijajan-v2-backend/models"
)

const (
	tripaySandboxBaseURL    = "https://tripay.co.id/api-sandbox"
	tripayProductionBaseURL = "https://tripay.co.id/api"
)

type tripayNumber float64

func (number *tripayNumber) UnmarshalJSON(data []byte) error {
	value := strings.TrimSpace(string(data))
	if value == "" || value == "null" {
		*number = 0
		return nil
	}

	if strings.HasPrefix(value, "\"") {
		var stringValue string
		if err := json.Unmarshal(data, &stringValue); err != nil {
			return err
		}
		value = strings.TrimSpace(stringValue)
	}

	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return fmt.Errorf("angka Tripay tidak valid: %w", err)
	}
	*number = tripayNumber(parsed)
	return nil
}

type tripayFeeComponent struct {
	Flat    tripayNumber `json:"flat"`
	Percent tripayNumber `json:"percent"`
}

type tripayPaymentChannel struct {
	Group         string             `json:"group"`
	Code          string             `json:"code"`
	Name          string             `json:"name"`
	Type          string             `json:"type"`
	FeeMerchant   tripayFeeComponent `json:"fee_merchant"`
	MinimumFee    tripayNumber       `json:"minimum_fee"`
	MaximumFee    tripayNumber       `json:"maximum_fee"`
	MinimumAmount tripayNumber       `json:"minimum_amount"`
	MaximumAmount tripayNumber       `json:"maximum_amount"`
	IconURL       string             `json:"icon_url"`
	Active        bool               `json:"active"`
}

type tripayPaymentChannelResponse struct {
	Success bool                   `json:"success"`
	Message string                 `json:"message"`
	Data    []tripayPaymentChannel `json:"data"`
}

func tripayBaseURL() string {
	switch strings.ToLower(strings.TrimSpace(os.Getenv("TRIPAY_MODE"))) {
	case "production", "prod", "live":
		return tripayProductionBaseURL
	default:
		return tripaySandboxBaseURL
	}
}

func fetchTripayPaymentChannels(
	ctx context.Context,
) ([]tripayPaymentChannel, error) {
	apiKey := strings.TrimSpace(os.Getenv("TRIPAY_API_KEY"))
	if apiKey == "" {
		return nil, fmt.Errorf("TRIPAY_API_KEY belum dikonfigurasi")
	}

	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		tripayBaseURL()+"/merchant/payment-channel",
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("gagal membuat request channel Tripay: %w", err)
	}
	request.Header.Set("Authorization", "Bearer "+apiKey)
	request.Header.Set("Accept", "application/json")

	response, err := (&http.Client{Timeout: 12 * time.Second}).Do(request)
	if err != nil {
		return nil, fmt.Errorf("gagal menghubungi Tripay: %w", err)
	}
	defer response.Body.Close()

	responseBody, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("gagal membaca channel Tripay: %w", err)
	}

	var result tripayPaymentChannelResponse
	if err := json.Unmarshal(responseBody, &result); err != nil {
		return nil, fmt.Errorf(
			"response channel Tripay tidak valid (HTTP %d): %w",
			response.StatusCode,
			err,
		)
	}

	message := strings.TrimSpace(result.Message)
	if message == "" {
		message = http.StatusText(response.StatusCode)
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, fmt.Errorf("Tripay HTTP %d: %s", response.StatusCode, message)
	}
	if !result.Success {
		return nil, fmt.Errorf("Tripay menolak request channel: %s", message)
	}

	return result.Data, nil
}

func tripayChannelCategory(channel tripayPaymentChannel) string {
	searchValue := strings.ToUpper(strings.Join(
		[]string{channel.Group, channel.Code, channel.Name},
		" ",
	))

	switch {
	case strings.Contains(searchValue, "QRIS"):
		return "QRIS"
	case strings.Contains(searchValue, "VIRTUAL ACCOUNT") ||
		strings.Contains(searchValue, " VA"):
		return "VIRTUAL_ACCOUNT"
	case strings.Contains(searchValue, "E-WALLET") ||
		strings.Contains(searchValue, "E WALLET") ||
		strings.Contains(searchValue, "DOMPET"):
		return "E_WALLET"
	case strings.Contains(searchValue, "CONVENIENCE") ||
		strings.Contains(searchValue, "RETAIL"):
		return "RETAIL"
	case strings.Contains(searchValue, "PAYLATER"):
		return "PAYLATER"
	case strings.Contains(searchValue, "CREDIT CARD") ||
		strings.Contains(searchValue, "KARTU KREDIT"):
		return "CREDIT_CARD"
	case strings.Contains(searchValue, "E-BANKING") ||
		strings.Contains(searchValue, "E BANKING"):
		return "E_BANKING"
	default:
		return "OTHER"
	}
}

func estimateTripayMerchantFee(
	channel tripayPaymentChannel,
	totalAmount float64,
) float64 {
	fee := float64(channel.FeeMerchant.Flat) +
		totalAmount*float64(channel.FeeMerchant.Percent)/100
	fee = math.Ceil(fee)

	minimumFee := float64(channel.MinimumFee)
	maximumFee := float64(channel.MaximumFee)
	if minimumFee > 0 && fee < minimumFee {
		fee = minimumFee
	}
	if maximumFee > 0 && fee > maximumFee {
		fee = maximumFee
	}

	return math.Ceil(fee)
}

func buildTripayPaymentQuotes(
	ctx context.Context,
	product models.Product,
) ([]paymentMethodOption, error) {
	channels, err := fetchTripayPaymentChannels(ctx)
	if err != nil {
		return nil, err
	}

	feeBearer := strings.ToUpper(
		paymentSettingValue("payment_fee_bearer", "MERCHANT"),
	)
	return buildTripayPaymentQuotesFromChannels(product, channels, feeBearer), nil
}

func formatRupiahNumber(amount float64) string {
	digits := strconv.FormatInt(int64(math.Ceil(amount)), 10)
	var formatted strings.Builder
	formatted.Grow(len(digits) + len(digits)/3)

	for index, digit := range digits {
		if index > 0 && (len(digits)-index)%3 == 0 {
			formatted.WriteByte('.')
		}
		formatted.WriteRune(digit)
	}

	return formatted.String()
}

func buildTripayPaymentQuotesFromChannels(
	product models.Product,
	channels []tripayPaymentChannel,
	feeBearer string,
) []paymentMethodOption {
	targetNet := models.CalculateSellingPrice(math.Round(product.Price))
	options := make([]paymentMethodOption, 0, len(channels))

	for _, channel := range channels {
		code := strings.ToUpper(strings.TrimSpace(channel.Code))
		if code == "" {
			continue
		}

		totalAmount, merchantFee := calculateQuotedTotal(
			targetNet,
			func(amount float64) float64 {
				return estimateTripayMerchantFee(channel, amount)
			},
		)
		minimumAmount := float64(channel.MinimumAmount)
		maximumAmount := float64(channel.MaximumAmount)
		netRequirementMet := totalAmount-merchantFee >= targetNet
		enabled := channel.Active &&
			(minimumAmount <= 0 || targetNet >= minimumAmount) &&
			(maximumAmount <= 0 || targetNet <= maximumAmount) &&
			netRequirementMet

		disabledReason := ""
		switch {
		case !channel.Active:
			disabledReason = "Channel ini sedang tidak aktif di merchant Tripay."
		case minimumAmount > 0 && targetNet < minimumAmount:
			disabledReason = fmt.Sprintf(
				"Minimum transaksi Rp%s",
				formatRupiahNumber(minimumAmount),
			)
		case maximumAmount > 0 && targetNet > maximumAmount:
			disabledReason = "Nominal melebihi batas maksimum metode ini."
		case !netRequirementMet:
			disabledReason = "Metode ini belum dapat memenuhi nominal bersih produk."
		}

		customerSurcharge := totalAmount - targetNet
		options = append(options, paymentMethodOption{
			QuoteKey:          paymentQuoteKey("tripay", code),
			Code:              code,
			Name:              strings.TrimSpace(channel.Name),
			Category:          tripayChannelCategory(channel),
			ImageURL:          strings.TrimSpace(channel.IconURL),
			Enabled:           enabled,
			DisabledReason:    disabledReason,
			Provider:          "tripay",
			ProviderMethod:    code,
			ProductAmount:     targetNet,
			ServiceFee:        customerSurcharge,
			CustomerSurcharge: customerSurcharge,
			TotalAmount:       totalAmount,
			merchantFee:       merchantFee,
			paymentFeeBearer:  feeBearer,
			providerActive:    channel.Active,
			minimumAmount:     minimumAmount,
		})
	}

	return finalizePaymentQuotes(options)
}
