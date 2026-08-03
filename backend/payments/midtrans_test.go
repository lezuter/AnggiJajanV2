package payments

import (
	"math"
	"strings"
	"testing"
)

func TestResolveMidtransRuntimeConfigSelectsModeSpecificValues(t *testing.T) {
	t.Setenv("MIDTRANS_MERCHANT_ID_SANDBOX", "sandbox-merchant")
	t.Setenv("MIDTRANS_SERVER_KEY_SANDBOX", "sandbox-server")
	t.Setenv("MIDTRANS_CLIENT_KEY_SANDBOX", "sandbox-client")
	t.Setenv("MIDTRANS_MERCHANT_ID_PRODUCTION", "production-merchant")
	t.Setenv("MIDTRANS_SERVER_KEY_PRODUCTION", "production-server")
	t.Setenv("MIDTRANS_CLIENT_KEY_PRODUCTION", "production-client")

	for _, test := range []struct {
		mode       string
		credential string
		scriptURL  string
	}{
		{mode: "sandbox", credential: "sandbox", scriptURL: "https://app.sandbox.midtrans.com/snap/snap.js"},
		{mode: "production", credential: "production", scriptURL: "https://app.midtrans.com/snap/snap.js"},
	} {
		t.Run(test.mode, func(t *testing.T) {
			t.Setenv("MIDTRANS_MODE", test.mode)
			config, err := ResolveMidtransRuntimeConfig()
			if err != nil {
				t.Fatalf("ResolveMidtransRuntimeConfig() error = %v", err)
			}
			if config.Mode != test.mode ||
				!strings.HasPrefix(config.MerchantID, test.credential) ||
				!strings.HasPrefix(config.ServerKey, test.credential) ||
				!strings.HasPrefix(config.ClientKey, test.credential) ||
				config.SnapScriptURL != test.scriptURL {
				t.Fatalf("unexpected runtime config for %s", test.mode)
			}
		})
	}
}

func TestResolveMidtransRuntimeConfigRejectsInvalidMode(t *testing.T) {
	t.Setenv("MIDTRANS_MODE", "live")
	if _, err := ResolveMidtransRuntimeConfig(); err == nil {
		t.Fatal("invalid MIDTRANS_MODE must be rejected")
	}
}

func TestMidtransQRISGrossUpFindsSmallestSafeInteger(t *testing.T) {
	t.Setenv("MIDTRANS_MODE", "sandbox")
	t.Setenv("MIDTRANS_FEE_RULES_JSON_SANDBOX", "")
	t.Setenv("MIDTRANS_FEE_VAT_PERCENT", "11")

	config, err := LoadMidtransConfig()
	if err != nil {
		t.Fatalf("LoadMidtransConfig() error = %v", err)
	}

	const targetNet = 1050
	startingPrice, err := config.StartingPrice(targetNet)
	if err != nil {
		t.Fatalf("StartingPrice() error = %v", err)
	}
	fee, configured := config.EstimateFee(MidtransQRISMethod, startingPrice)
	if !configured {
		t.Fatal("QRIS fallback fee must be configured")
	}
	if startingPrice != math.Trunc(startingPrice) {
		t.Fatalf("starting price must be an integer, got %v", startingPrice)
	}
	if startingPrice-fee < targetNet {
		t.Fatalf("starting price %v - fee %v is below target %v", startingPrice, fee, targetNet)
	}

	previousFee, _ := config.EstimateFee(MidtransQRISMethod, startingPrice-1)
	if startingPrice-1-previousFee >= targetNet {
		t.Fatalf("starting price %v is not minimal", startingPrice)
	}
}

func TestMidtransFeeRulesCanBeOverridden(t *testing.T) {
	t.Setenv("MIDTRANS_MODE", "sandbox")
	t.Setenv("MIDTRANS_FEE_RULES_JSON_SANDBOX", `{"other_qris":{"percent_fee":1,"flat_fee":100}}`)
	t.Setenv("MIDTRANS_FEE_VAT_PERCENT", "0")

	config, err := LoadMidtransConfig()
	if err != nil {
		t.Fatalf("LoadMidtransConfig() error = %v", err)
	}
	fee, configured := config.EstimateFee(MidtransQRISMethod, 10_000)
	if !configured || fee != 200 {
		t.Fatalf("EstimateFee() = (%v, %v), want (200, true)", fee, configured)
	}
}
