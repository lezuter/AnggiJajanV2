package payments

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"strconv"
	"strings"
)

const (
	DefaultMidtransFeeVATPercent = 11
	MidtransQRISMethod           = "other_qris"
)

type MidtransRuntimeConfig struct {
	Mode              string
	MerchantID        string
	ServerKey         string
	ClientKey         string
	FeeRulesJSON      string
	MethodLimitsJSON  string
	FinishRedirectURL string
	ErrorRedirectURL  string
	SnapAPIBaseURL    string
	StatusAPIBaseURL  string
	SnapScriptURL     string
}

type MidtransFeeRule struct {
	FlatFee     float64 `json:"flat_fee"`
	PercentFee  float64 `json:"percent_fee"`
	VATIncluded bool    `json:"-"`
	Configured  bool    `json:"-"`
}

type MidtransMethod struct {
	Code           string
	Name           string
	Category       string
	ProviderMethod string
	ImageURL       string
	MinimumAmount  float64
	MaximumAmount  float64
}

type MidtransConfig struct {
	FeeVATPercent float64
	FeeRules      map[string]MidtransFeeRule
	Methods       []MidtransMethod
}

type midtransFeeRuleOverride struct {
	FlatFee     *float64 `json:"flat_fee"`
	Flat        *float64 `json:"flat"`
	PercentFee  *float64 `json:"percent_fee"`
	Percent     *float64 `json:"percent"`
	VATIncluded *bool    `json:"vat_included"`
}

type midtransLimitOverride struct {
	MinimumAmount *float64 `json:"minimum_amount"`
	MinAmount     *float64 `json:"min_amount"`
	MaximumAmount *float64 `json:"maximum_amount"`
	MaxAmount     *float64 `json:"max_amount"`
}

func ResolveMidtransMode() (string, error) {
	mode := strings.ToLower(strings.TrimSpace(os.Getenv("MIDTRANS_MODE")))
	switch mode {
	case "sandbox", "production":
		return mode, nil
	default:
		return "", fmt.Errorf("MIDTRANS_MODE harus sandbox atau production")
	}
}

func ResolveMidtransRuntimeConfig() (MidtransRuntimeConfig, error) {
	mode, err := ResolveMidtransMode()
	if err != nil {
		return MidtransRuntimeConfig{}, err
	}

	suffix := "SANDBOX"
	snapAPIBaseURL := "https://app.sandbox.midtrans.com"
	statusAPIBaseURL := "https://api.sandbox.midtrans.com"
	if mode == "production" {
		suffix = "PRODUCTION"
		snapAPIBaseURL = "https://app.midtrans.com"
		statusAPIBaseURL = "https://api.midtrans.com"
	}

	modeValue := func(name string) string {
		return strings.TrimSpace(os.Getenv(name + "_" + suffix))
	}

	return MidtransRuntimeConfig{
		Mode:              mode,
		MerchantID:        modeValue("MIDTRANS_MERCHANT_ID"),
		ServerKey:         modeValue("MIDTRANS_SERVER_KEY"),
		ClientKey:         modeValue("MIDTRANS_CLIENT_KEY"),
		FeeRulesJSON:      modeValue("MIDTRANS_FEE_RULES_JSON"),
		MethodLimitsJSON:  modeValue("MIDTRANS_METHOD_LIMITS_JSON"),
		FinishRedirectURL: strings.TrimSpace(os.Getenv("MIDTRANS_FINISH_REDIRECT_URL")),
		ErrorRedirectURL:  strings.TrimSpace(os.Getenv("MIDTRANS_ERROR_REDIRECT_URL")),
		SnapAPIBaseURL:    snapAPIBaseURL,
		StatusAPIBaseURL:  statusAPIBaseURL,
		SnapScriptURL:     snapAPIBaseURL + "/snap/snap.js",
	}, nil
}

// defaultMidtransLogoURL adalah fallback visual milik Anggijajan.
func defaultMidtransLogoURL(providerMethod string) string {
	switch strings.ToLower(strings.TrimSpace(providerMethod)) {
	case MidtransQRISMethod:
		return "/payment-logos/qris.svg"
	case "gopay":
		return "/payment-logos/gopay.svg"
	case "dana":
		return "/payment-logos/dana.svg"
	case "ovo":
		return "/payment-logos/ovo.svg"
	case "shopeepay":
		return "/payment-logos/shopeepay.svg"
	case "google_pay":
		return "/payment-logos/google-pay.svg"
	case "akulaku":
		return "/payment-logos/akulaku.svg"
	case "kredivo":
		return "/payment-logos/kredivo.svg"
	case "bca_va":
		return "/payment-logos/bca.svg"
	case "bni_va":
		return "/payment-logos/bni.svg"
	case "bri_va":
		return "/payment-logos/bri.svg"
	case "cimb_va":
		return "/payment-logos/cimb.svg"
	case "permata_va":
		return "/payment-logos/permata.svg"
	case "echannel":
		return "/payment-logos/mandiri.svg"
	case "bsi_va":
		return "/payment-logos/bsi.svg"
	case "seabank_va":
		return "/payment-logos/seabank.svg"
	case "credit_card":
		return "/payment-logos/credit-card.svg"
	case "alfamart":
		return "/payment-logos/alfamart.svg"
	case "indomaret":
		return "/payment-logos/indomaret.svg"
	default:
		return ""
	}
}

func defaultMidtransMethods() []MidtransMethod {
	methods := []MidtransMethod{
		{Code: "QRIS", Name: "QRIS", Category: "QRIS", ProviderMethod: MidtransQRISMethod, MinimumAmount: 1, MaximumAmount: 10_000_000},
		{Code: "GOPAY", Name: "GoPay", Category: "E_WALLET", ProviderMethod: "gopay", MinimumAmount: 1},
		{Code: "DANA", Name: "DANA", Category: "E_WALLET", ProviderMethod: "dana", MinimumAmount: 1},
		{Code: "OVO", Name: "OVO", Category: "E_WALLET", ProviderMethod: "ovo", MinimumAmount: 1},
		{Code: "SHOPEEPAY", Name: "ShopeePay", Category: "E_WALLET", ProviderMethod: "shopeepay", MinimumAmount: 1},
		{Code: "GOOGLE_PAY", Name: "Google Pay", Category: "E_WALLET", ProviderMethod: "google_pay", MinimumAmount: 10_000, MaximumAmount: 999_999_999},
		{Code: "AKULAKU", Name: "Akulaku PayLater", Category: "PAYLATER", ProviderMethod: "akulaku", MinimumAmount: 5_000},
		{Code: "KREDIVO", Name: "Kredivo", Category: "PAYLATER", ProviderMethod: "kredivo", MinimumAmount: 1},
		{Code: "BCA_VA", Name: "BCA Virtual Account", Category: "VIRTUAL_ACCOUNT", ProviderMethod: "bca_va", MinimumAmount: 10_000},
		{Code: "BNI_VA", Name: "BNI Virtual Account", Category: "VIRTUAL_ACCOUNT", ProviderMethod: "bni_va", MinimumAmount: 1},
		{Code: "BRI_VA", Name: "BRI Virtual Account", Category: "VIRTUAL_ACCOUNT", ProviderMethod: "bri_va", MinimumAmount: 1},
		{Code: "CIMB_VA", Name: "CIMB Virtual Account", Category: "VIRTUAL_ACCOUNT", ProviderMethod: "cimb_va", MinimumAmount: 1},
		{Code: "PERMATA_VA", Name: "Permata Virtual Account", Category: "VIRTUAL_ACCOUNT", ProviderMethod: "permata_va", MinimumAmount: 1},
		{Code: "ECHANNEL", Name: "Mandiri Bill Payment", Category: "VIRTUAL_ACCOUNT", ProviderMethod: "echannel", MinimumAmount: 1},
		{Code: "BSI_VA", Name: "BSI Virtual Account", Category: "VIRTUAL_ACCOUNT", ProviderMethod: "bsi_va", MinimumAmount: 1_000},
		{Code: "SEABANK_VA", Name: "SeaBank Virtual Account", Category: "VIRTUAL_ACCOUNT", ProviderMethod: "seabank_va", MinimumAmount: 10_000},
		{Code: "CREDIT_CARD", Name: "Kartu Kredit", Category: "CREDIT_CARD", ProviderMethod: "credit_card", MinimumAmount: 10_000},
		{Code: "ALFAMART", Name: "Alfamart", Category: "RETAIL", ProviderMethod: "alfamart", MinimumAmount: 1},
		{Code: "INDOMARET", Name: "Indomaret", Category: "RETAIL", ProviderMethod: "indomaret", MinimumAmount: 10_000},
	}

	for index := range methods {
		methods[index].ImageURL = defaultMidtransLogoURL(
			methods[index].ProviderMethod,
		)
	}

	return methods
}

func defaultMidtransFeeRules() map[string]MidtransFeeRule {
	return map[string]MidtransFeeRule{
		MidtransQRISMethod: {PercentFee: 0.7, Configured: true},
		"gopay":            {PercentFee: 2, Configured: true},
		"dana":             {PercentFee: 1.5, Configured: true},
		"ovo":              {PercentFee: 1.5, Configured: true},
		"shopeepay":        {PercentFee: 2, Configured: true},
		"bca_va":           {FlatFee: 4_000, Configured: true},
		"bni_va":           {FlatFee: 4_000, Configured: true},
		"bri_va":           {FlatFee: 4_000, Configured: true},
		"cimb_va":          {FlatFee: 4_000, Configured: true},
		"permata_va":       {FlatFee: 4_000, Configured: true},
		"echannel":         {FlatFee: 4_000, Configured: true},
		"bsi_va":           {FlatFee: 4_000, Configured: true},
		"seabank_va":       {FlatFee: 4_000, Configured: true},
		"credit_card":      {FlatFee: 2_000, PercentFee: 2.9, Configured: true},
		"google_pay":       {FlatFee: 2_000, PercentFee: 2.9, Configured: true},
		"akulaku":          {PercentFee: 1.7, Configured: true},
		"kredivo":          {PercentFee: 2, Configured: true},
		"alfamart":         {FlatFee: 5_000, VATIncluded: true, Configured: true},
		"indomaret":        {FlatFee: 5_000, VATIncluded: true, Configured: true},
	}
}

func parseNonNegativeFloat(value string, fallback float64) float64 {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}

	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil || parsed < 0 {
		return fallback
	}
	return parsed
}

func LoadMidtransConfig() (MidtransConfig, error) {
	runtimeConfig, err := ResolveMidtransRuntimeConfig()
	if err != nil {
		return MidtransConfig{}, err
	}

	config := MidtransConfig{
		FeeVATPercent: parseNonNegativeFloat(
			os.Getenv("MIDTRANS_FEE_VAT_PERCENT"),
			DefaultMidtransFeeVATPercent,
		),
		FeeRules: defaultMidtransFeeRules(),
		Methods:  defaultMidtransMethods(),
	}

	if rawRules := runtimeConfig.FeeRulesJSON; rawRules != "" {
		var overrides map[string]midtransFeeRuleOverride
		if err := json.Unmarshal([]byte(rawRules), &overrides); err != nil {
			return MidtransConfig{}, fmt.Errorf("MIDTRANS_FEE_RULES_JSON tidak valid: %w", err)
		}

		for rawMethod, override := range overrides {
			method := strings.ToLower(strings.TrimSpace(rawMethod))
			if method == "" {
				continue
			}

			rule := config.FeeRules[method]
			if override.FlatFee != nil {
				rule.FlatFee = *override.FlatFee
			} else if override.Flat != nil {
				rule.FlatFee = *override.Flat
			}
			if override.PercentFee != nil {
				rule.PercentFee = *override.PercentFee
			} else if override.Percent != nil {
				rule.PercentFee = *override.Percent
			}
			if override.VATIncluded != nil {
				rule.VATIncluded = *override.VATIncluded
			}
			if rule.FlatFee < 0 || rule.PercentFee < 0 {
				return MidtransConfig{}, fmt.Errorf("fee Midtrans %s tidak boleh negatif", method)
			}
			rule.Configured = true
			config.FeeRules[method] = rule
		}
	}

	if rawLimits := runtimeConfig.MethodLimitsJSON; rawLimits != "" {
		var overrides map[string]midtransLimitOverride
		if err := json.Unmarshal([]byte(rawLimits), &overrides); err != nil {
			return MidtransConfig{}, fmt.Errorf("MIDTRANS_METHOD_LIMITS_JSON tidak valid: %w", err)
		}

		for index := range config.Methods {
			method := &config.Methods[index]
			override, found := overrides[method.ProviderMethod]
			if !found {
				continue
			}
			if override.MinimumAmount != nil {
				method.MinimumAmount = *override.MinimumAmount
			} else if override.MinAmount != nil {
				method.MinimumAmount = *override.MinAmount
			}
			if override.MaximumAmount != nil {
				method.MaximumAmount = *override.MaximumAmount
			} else if override.MaxAmount != nil {
				method.MaximumAmount = *override.MaxAmount
			}
			if method.MinimumAmount < 0 || method.MaximumAmount < 0 {
				return MidtransConfig{}, fmt.Errorf("limit Midtrans %s tidak boleh negatif", method.ProviderMethod)
			}
		}
	}

	return config, nil
}

func ceilMidtransFee(value float64) float64 {
	// Hilangkan noise float64 sangat kecil sebelum pembulatan rupiah.
	// Contoh: 1887.0000000000002 harus tetap menjadi Rp1.887,
	// bukan naik menjadi Rp1.888.
	const decimalPrecision = 1_000_000_000
	normalized := math.Round(value*decimalPrecision) / decimalPrecision
	return math.Ceil(normalized)
}

func (config MidtransConfig) EstimateFee(providerMethod string, amount float64) (float64, bool) {
	rule, found := config.FeeRules[strings.ToLower(strings.TrimSpace(providerMethod))]
	if !found || !rule.Configured {
		return 0, false
	}

	feeBeforeVAT := rule.FlatFee + amount*rule.PercentFee/100
	if rule.VATIncluded {
		return ceilMidtransFee(feeBeforeVAT), true
	}
	feeWithVAT := feeBeforeVAT * (1 + config.FeeVATPercent/100)
	return ceilMidtransFee(feeWithVAT), true
}

func (config MidtransConfig) StartingPrice(targetNet float64) (float64, error) {
	target := int64(math.Ceil(targetNet))
	if target < 0 {
		return 0, fmt.Errorf("target net tidak boleh negatif")
	}

	feeAt := func(amount int64) (int64, error) {
		fee, configured := config.EstimateFee(MidtransQRISMethod, float64(amount))
		if !configured {
			return 0, fmt.Errorf("aturan fee QRIS Midtrans belum dikonfigurasi")
		}
		return int64(math.Ceil(fee)), nil
	}

	low := target
	high := target
	for {
		fee, err := feeAt(high)
		if err != nil {
			return 0, err
		}
		if high-fee >= target {
			break
		}
		if high > math.MaxInt64/2 {
			return 0, fmt.Errorf("starting price melampaui batas integer")
		}
		high = high*2 + 1
	}

	for low < high {
		mid := low + (high-low)/2
		fee, err := feeAt(mid)
		if err != nil {
			return 0, err
		}
		if mid-fee >= target {
			high = mid
		} else {
			low = mid + 1
		}
	}

	return float64(low), nil
}
