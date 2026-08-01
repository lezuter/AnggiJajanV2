package controllers

import "testing"

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
