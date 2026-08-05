package payments

import "testing"

func methodByProviderForPaymentTest(
	t *testing.T,
	methods []MidtransMethod,
	providerMethod string,
) MidtransMethod {
	t.Helper()
	for _, method := range methods {
		if method.ProviderMethod == providerMethod {
			return method
		}
	}
	t.Fatalf("method %s not found", providerMethod)
	return MidtransMethod{}
}

func TestMidtransDefaultCategoriesAndLimits(t *testing.T) {
	methods := defaultMidtransMethods()

	googlePay := methodByProviderForPaymentTest(t, methods, "google_pay")
	if googlePay.Category != "CREDIT_CARD" {
		t.Fatalf("Google Pay category = %q", googlePay.Category)
	}
	if googlePay.MaximumAmount != 999_999_999 {
		t.Fatalf("Google Pay maximum = %v", googlePay.MaximumAmount)
	}

	for method, expectedMaximum := range map[string]float64{
		MidtransQRISMethod: 10_000_000,
		"gopay":            2_000_000,
		"dana":             2_000_000,
		"shopeepay":        2_000_000,
		"alfamart":         2_500_000,
		"indomaret":        5_000_000,
		"credit_card":      999_999_999,
		"seabank_va":       100_000_000,
		"cimb_va":          250_000_000,
	} {
		got := methodByProviderForPaymentTest(t, methods, method)
		if got.MaximumAmount != expectedMaximum {
			t.Fatalf(
				"%s maximum = %v, want %v",
				method,
				got.MaximumAmount,
				expectedMaximum,
			)
		}
	}
}

func TestProductionContractFeesRequireExplicitOverrides(t *testing.T) {
	t.Setenv("MIDTRANS_MODE", "production")
	t.Setenv("MIDTRANS_FEE_RULES_JSON_PRODUCTION", "")
	t.Setenv("MIDTRANS_METHOD_LIMITS_JSON_PRODUCTION", "")

	config, err := LoadMidtransConfig()
	if err != nil {
		t.Fatal(err)
	}

	for _, method := range []string{
		MidtransQRISMethod,
		"gopay",
		"dana",
		"ovo",
		"shopeepay",
		"bca_va",
		"indomaret",
	} {
		if config.FeeRules[method].Configured {
			t.Fatalf("%s should require a production fee override", method)
		}
	}

	if !config.FeeRules["credit_card"].Configured {
		t.Fatal("public credit-card fallback should remain configured")
	}
}

func TestProductionContractFeeOverrideReEnablesMethod(t *testing.T) {
	t.Setenv("MIDTRANS_MODE", "production")
	t.Setenv(
		"MIDTRANS_FEE_RULES_JSON_PRODUCTION",
		`{"other_qris":{"percent_fee":0.8,"vat_included":true}}`,
	)
	t.Setenv("MIDTRANS_METHOD_LIMITS_JSON_PRODUCTION", "")

	config, err := LoadMidtransConfig()
	if err != nil {
		t.Fatal(err)
	}

	rule := config.FeeRules[MidtransQRISMethod]
	if !rule.Configured || !rule.Overridden {
		t.Fatalf("QRIS override was not activated: %#v", rule)
	}
	fee, configured := config.EstimateFee(MidtransQRISMethod, 100_000)
	if !configured || fee != 800 {
		t.Fatalf("QRIS fee = %v configured=%v", fee, configured)
	}
}
