package controllers

import (
	"math"
	"testing"

	"github.com/derry/anggijajan-v2-backend/models"
)

func TestEstimateDuitkuMerchantFee(t *testing.T) {
	tests := []struct {
		name         string
		code         string
		amount       float64
		expectedFee  float64
		expectedType string
		expectedMin  float64
		configured   bool
	}{
		{
			name:         "QRIS 0.7 percent",
			code:         "SP",
			amount:       100000,
			expectedFee:  700,
			expectedType: "QRIS",
			expectedMin:  10000,
			configured:   true,
		},
		{
			name:         "BCA fixed fee",
			code:         "BC",
			amount:       100000,
			expectedFee:  5000,
			expectedType: "VIRTUAL_ACCOUNT",
			expectedMin:  10000,
			configured:   true,
		},
		{
			name:         "Indomaret requires MDR configuration",
			code:         "IR",
			amount:       100000,
			expectedFee:  1000,
			expectedType: "RETAIL",
			expectedMin:  10000,
			configured:   false,
		},
		{
			name:         "unknown method",
			code:         "ZZ",
			amount:       100000,
			expectedFee:  0,
			expectedType: "OTHER",
			expectedMin:  0,
			configured:   false,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			fee, category, minimumAmount, configured :=
				estimateDuitkuMerchantFee(test.code, test.amount)

			if fee != test.expectedFee {
				t.Fatalf("fee = %.0f, expected %.0f", fee, test.expectedFee)
			}
			if category != test.expectedType {
				t.Fatalf("category = %s, expected %s", category, test.expectedType)
			}
			if minimumAmount != test.expectedMin {
				t.Fatalf(
					"minimumAmount = %.0f, expected %.0f",
					minimumAmount,
					test.expectedMin,
				)
			}
			if configured != test.configured {
				t.Fatalf(
					"configured = %v, expected %v",
					configured,
					test.configured,
				)
			}
		})
	}
}

func TestIsPaymentMethodAllowed(t *testing.T) {
	tests := []struct {
		name        string
		grossProfit float64
		fee         float64
		expected    bool
	}{
		{
			name:        "small product cheap channel",
			grossProfit: 500,
			fee:         74,
			expected:    true,
		},
		{
			name:        "medium product expensive channel",
			grossProfit: 6000,
			fee:         5000,
			expected:    false,
		},
		{
			name:        "large product expensive channel",
			grossProfit: 10000,
			fee:         5000,
			expected:    true,
		},
		{
			name:        "fee consumes profit",
			grossProfit: 1000,
			fee:         1000,
			expected:    false,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			result := isPaymentMethodAllowed(
				test.grossProfit,
				test.fee,
				1500,
				50,
			)
			if result != test.expected {
				t.Fatalf("allowed = %v, expected %v", result, test.expected)
			}
		})
	}
}

func TestTruncateRunes(t *testing.T) {
	got := truncateRunes("Pelanggan Anggi Jajan Panjang", 20)
	if len([]rune(got)) != 20 {
		t.Fatalf("length = %d, expected 20", len([]rune(got)))
	}
}

func TestFirstNonEmpty(t *testing.T) {
	got := firstNonEmpty(" ", "", "nilai", "cadangan")
	if got != "nilai" {
		t.Fatalf("got = %q, expected %q", got, "nilai")
	}
}

func TestDuitkuCallbackSignature(t *testing.T) {
	const (
		merchantCode    = "DS32830"
		amount          = "10000"
		merchantOrderID = "INV-TEST-001"
		apiKey          = "sandbox-secret"
	)

	signature := duitkuHMACSHA256(
		merchantCode+amount+merchantOrderID,
		apiKey,
	)

	if !isValidDuitkuCallbackSignature(
		merchantCode,
		amount,
		merchantOrderID,
		signature,
		apiKey,
	) {
		t.Fatal("signature yang benar ditolak")
	}

	if isValidDuitkuCallbackSignature(
		merchantCode,
		amount,
		merchantOrderID,
		"invalid",
		apiKey,
	) {
		t.Fatal("signature yang salah diterima")
	}
}

func TestParseDuitkuCallbackAmount(t *testing.T) {
	tests := []struct {
		value    string
		expected int64
		valid    bool
	}{
		{value: "10000", expected: 10000, valid: true},
		{value: "10000.00", expected: 10000, valid: true},
		{value: "10000.50", expected: 0, valid: false},
		{value: "0", expected: 0, valid: false},
	}

	for _, test := range tests {
		got, err := parseDuitkuCallbackAmount(test.value)
		if test.valid && err != nil {
			t.Fatalf("value %q ditolak: %v", test.value, err)
		}
		if !test.valid && err == nil {
			t.Fatalf("value %q seharusnya ditolak", test.value)
		}
		if test.valid && got != test.expected {
			t.Fatalf(
				"value %q menghasilkan %d, expected %d",
				test.value,
				got,
				test.expected,
			)
		}
	}
}

func TestChooseRecommendedPaymentMethods(t *testing.T) {
	options := []paymentMethodOption{
		{
			Code:        "SP",
			Name:        "ShopeePay QRIS",
			Category:    "QRIS",
			Enabled:     true,
			merchantFee: 601,
		},
		{
			Code:        "DA",
			Name:        "DANA",
			Category:    "E_WALLET",
			Enabled:     true,
			merchantFee: 1432,
		},
		{
			Code:        "AG",
			Name:        "Artha Graha VA",
			Category:    "VIRTUAL_ACCOUNT",
			Enabled:     true,
			merchantFee: 1500,
		},
	}

	ranked := chooseRecommendedPaymentMethods(options)
	if len(ranked) != 2 {
		t.Fatalf("ranked length = %d, expected 2", len(ranked))
	}
	if options[ranked[0]].Category != "QRIS" {
		t.Fatalf("rank 1 category = %s, expected QRIS", options[ranked[0]].Category)
	}
	if options[ranked[1]].Category != "E_WALLET" {
		t.Fatalf("rank 2 category = %s, expected E_WALLET", options[ranked[1]].Category)
	}
}

func TestQRISRemainsPrimaryForExpensiveProduct(t *testing.T) {
	options := []paymentMethodOption{
		{
			Code:        "SP",
			Name:        "ShopeePay QRIS",
			Category:    "QRIS",
			Enabled:     true,
			merchantFee: 3500,
		},
		{
			Code:        "DA",
			Name:        "DANA",
			Category:    "E_WALLET",
			Enabled:     true,
			merchantFee: 8350,
		},
		{
			Code:        "AG",
			Name:        "Artha Graha VA",
			Category:    "VIRTUAL_ACCOUNT",
			Enabled:     true,
			merchantFee: 1500,
		},
	}

	ranked := chooseRecommendedPaymentMethods(options)
	if len(ranked) != 2 {
		t.Fatalf("ranked length = %d, expected 2", len(ranked))
	}
	if options[ranked[0]].Category != "QRIS" {
		t.Fatalf("rank 1 category = %s, expected QRIS", options[ranked[0]].Category)
	}
	if options[ranked[1]].Category != "E_WALLET" {
		t.Fatalf("rank 2 category = %s, expected E_WALLET", options[ranked[1]].Category)
	}
}

func TestRecommendationFallsBackWithoutQRISOrEWallet(t *testing.T) {
	options := []paymentMethodOption{
		{
			Code:        "AG",
			Name:        "Artha Graha VA",
			Category:    "VIRTUAL_ACCOUNT",
			Enabled:     true,
			merchantFee: 1500,
		},
		{
			Code:        "JP",
			Name:        "Jenius Pay",
			Category:    "E_BANKING",
			Enabled:     true,
			merchantFee: 2000,
		},
	}

	ranked := chooseRecommendedPaymentMethods(options)
	if len(ranked) != 2 {
		t.Fatalf("ranked length = %d, expected 2", len(ranked))
	}
	if options[ranked[0]].Code != "AG" {
		t.Fatalf("rank 1 code = %s, expected AG", options[ranked[0]].Code)
	}
	if options[ranked[1]].Code != "JP" {
		t.Fatalf("rank 2 code = %s, expected JP", options[ranked[1]].Code)
	}
}

func TestCalculateQuotedTotalProtectsTargetNet(t *testing.T) {
	targetNet := 9000.0
	totalAmount, merchantFee := calculateQuotedTotal(
		targetNet,
		func(amount float64) float64 {
			return 750 + amount*0.7/100
		},
	)

	if totalAmount-merchantFee < targetNet {
		t.Fatalf(
			"net amount = %.0f, expected at least %.0f",
			totalAmount-merchantFee,
			targetNet,
		)
	}
	if totalAmount-1-math.Ceil(750+(totalAmount-1)*0.7/100) >= targetNet {
		t.Fatalf("total amount %.0f is not the minimum valid quote", totalAmount)
	}
}

func TestLogicalPaymentQuotesKeepsOneGenericQRISAndDisabledMethods(t *testing.T) {
	options := []paymentMethodOption{
		{
			QuoteKey:       paymentQuoteKey("tripay", "QRIS"),
			Code:           "QRIS",
			Name:           "QRIS A",
			Category:       "QRIS",
			Provider:       "tripay",
			ProviderMethod: "QRIS",
			Enabled:        false,
			DisabledReason: "Tidak aktif",
			TotalAmount:    9900,
		},
		{
			QuoteKey:       paymentQuoteKey("tripay", "QRIS2"),
			Code:           "QRIS2",
			Name:           "QRIS B",
			Category:       "QRIS",
			Provider:       "tripay",
			ProviderMethod: "QRIS2",
			Enabled:        true,
			TotalAmount:    9950,
		},
		{
			QuoteKey:       paymentQuoteKey("tripay", "VA1"),
			Code:           "VA1",
			Name:           "VA Satu",
			Category:       "VIRTUAL_ACCOUNT",
			Provider:       "tripay",
			ProviderMethod: "VA1",
			Enabled:        false,
			DisabledReason: "Minimum belum terpenuhi",
			TotalAmount:    13000,
		},
	}

	logical := logicalPaymentQuotes(options)
	if len(logical) != 2 {
		t.Fatalf("logical methods = %d, expected 2", len(logical))
	}
	if logical[0].Code != "QRIS" || logical[0].Name != "QRIS" {
		t.Fatalf("QRIS logical method = %#v", logical[0])
	}
	if logical[0].ProviderMethod != "QRIS2" || !logical[0].Enabled {
		t.Fatalf("QRIS provider method = %#v", logical[0])
	}
	if logical[1].Enabled || logical[1].DisabledReason == "" {
		t.Fatalf("disabled method was not preserved: %#v", logical[1])
	}
}

func TestEstimateTripayMerchantFeeUsesDynamicChannelRule(t *testing.T) {
	channel := tripayPaymentChannel{
		FeeMerchant: tripayFeeComponent{
			Flat:    tripayNumber(750),
			Percent: tripayNumber(0.7),
		},
		MinimumFee: tripayNumber(800),
		MaximumFee: tripayNumber(1200),
	}

	if fee := estimateTripayMerchantFee(channel, 10000); fee != 820 {
		t.Fatalf("fee = %.0f, expected 820", fee)
	}
	if fee := estimateTripayMerchantFee(channel, 1000); fee != 800 {
		t.Fatalf("minimum fee = %.0f, expected 800", fee)
	}
	if fee := estimateTripayMerchantFee(channel, 100000); fee != 1200 {
		t.Fatalf("maximum fee = %.0f, expected 1200", fee)
	}
}

func TestTripayCheapProductResponseUsesChannelMinimums(t *testing.T) {
	product := models.Product{Price: 8000}
	channels := []tripayPaymentChannel{
		{
			Group:         "E-Wallet",
			Code:          "QRIS_TEST",
			Name:          "QRIS Test",
			FeeMerchant:   tripayFeeComponent{Flat: 750, Percent: 0.7},
			MinimumAmount: 1000,
			MaximumAmount: 5000000,
			Active:        true,
		},
		{
			Group:         "E-Wallet",
			Code:          "EWALLET_TEST",
			Name:          "Dompet Digital Uji",
			FeeMerchant:   tripayFeeComponent{Percent: 3},
			MinimumAmount: 1000,
			MaximumAmount: 10000000,
			Active:        true,
		},
		{
			Group:         "Virtual Account",
			Code:          "BANKVA_TEST",
			Name:          "Virtual Account Uji",
			FeeMerchant:   tripayFeeComponent{Flat: 4250},
			MinimumAmount: 10000,
			MaximumAmount: 10000000,
			Active:        true,
		},
	}

	quotes := buildTripayPaymentQuotesFromChannels(product, channels, "MERCHANT")
	if len(quotes) != 3 {
		t.Fatalf("quotes = %d, expected 3", len(quotes))
	}

	var qris, wallet, virtualAccount *paymentMethodOption
	for index := range quotes {
		switch quotes[index].Category {
		case "QRIS":
			qris = &quotes[index]
		case "E_WALLET":
			wallet = &quotes[index]
		case "VIRTUAL_ACCOUNT":
			virtualAccount = &quotes[index]
		}
	}

	if qris == nil || !qris.Enabled {
		t.Fatalf("QRIS quote should be enabled: %#v", qris)
	}
	if wallet == nil || !wallet.Enabled {
		t.Fatalf("active e-wallet quote should be enabled: %#v", wallet)
	}
	if virtualAccount == nil || virtualAccount.Enabled {
		t.Fatalf("VA quote should remain visible and disabled: %#v", virtualAccount)
	}
	if virtualAccount.DisabledReason != "Minimum transaksi Rp10.000" {
		t.Fatalf(
			"VA disabled reason = %q",
			virtualAccount.DisabledReason,
		)
	}

	response := paymentMethodsResponse("tripay", "MERCHANT", 8400, quotes)
	minimumAmount, exists := response["minimum_transaction_amount"]
	if !exists {
		t.Fatal("Tripay response should expose the active logical minimum")
	}
	if minimumAmount != float64(1000) {
		t.Fatalf(
			"Tripay minimum_transaction_amount = %#v, expected 1000",
			minimumAmount,
		)
	}
	if minimumAmount == duitkuMinimumTransactionAmount {
		t.Fatal("Tripay response leaked the global Duitku minimum")
	}
}

func TestDuitkuResponseKeepsGlobalMinimum(t *testing.T) {
	response := paymentMethodsResponse("duitku", "MERCHANT", 10500, nil)
	if response["minimum_transaction_amount"] != duitkuMinimumTransactionAmount {
		t.Fatalf(
			"Duitku minimum_transaction_amount = %#v",
			response["minimum_transaction_amount"],
		)
	}
}
