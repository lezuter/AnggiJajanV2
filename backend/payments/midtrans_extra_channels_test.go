package payments

import "testing"

func TestExtraMidtransMethodsAndFees(t *testing.T) {
	config := MidtransConfig{
		FeeVATPercent: DefaultMidtransFeeVATPercent,
		FeeRules:      defaultMidtransFeeRules(),
		Methods:       defaultMidtransMethods(),
	}

	expectedMethods := map[string]bool{
		"google_pay": false,
		"akulaku":    false,
		"kredivo":    false,
	}
	for _, method := range config.Methods {
		if _, found := expectedMethods[method.ProviderMethod]; found {
			expectedMethods[method.ProviderMethod] = true
		}
	}
	for method, found := range expectedMethods {
		if !found {
			t.Fatalf("%s is missing from default methods", method)
		}
	}

	googleFee, configured := config.EstimateFee("google_pay", 100_000)
	if !configured || googleFee <= 0 {
		t.Fatalf("Google Pay fee is not configured: %v %v", googleFee, configured)
	}

	akulakuFee, configured := config.EstimateFee("akulaku", 100_000)
	if !configured || akulakuFee != 1_887 {
		t.Fatalf("Akulaku fee = %v, want 1887", akulakuFee)
	}

	kredivoFee, configured := config.EstimateFee("kredivo", 100_000)
	if !configured || kredivoFee != 2_220 {
		t.Fatalf("Kredivo fee = %v, want 2220", kredivoFee)
	}

	for _, method := range []string{"alfamart", "indomaret"} {
		fee, configured := config.EstimateFee(method, 100_000)
		if !configured || fee != 5_000 {
			t.Fatalf("%s fee = %v configured=%v, want 5000", method, fee, configured)
		}
	}
}
