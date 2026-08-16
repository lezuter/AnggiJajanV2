package controllers

import (
	"strings"
	"testing"

	"github.com/derry/anggijajan-v2-backend/models"
	"github.com/derry/anggijajan-v2-backend/payments"
)

func TestMidtransLimitUsesFinalTransactionAmount(t *testing.T) {
	reason := midtransDisabledReason(
		payments.MidtransMethod{
			MinimumAmount: 10_000,
			MaximumAmount: 100_000,
		},
		midtransPaymentActivation{Verified: true},
		true,
		true,
		100_001,
		2_000,
		true,
	)
	if reason != "Maksimum transaksi Rp100.000" {
		t.Fatalf("disabled reason = %q", reason)
	}
}

func TestGooglePayRequiresActiveCardChannel(t *testing.T) {
	activation := configureMidtransQuoteTest(t, "google_pay")
	quote, err := buildMidtransPaymentQuote(
		models.Product{Price: 100_000},
		activation, 1,
	)
	if err != nil {
		t.Fatal(err)
	}

	googlePay := methodByProvider(t, quote, "google_pay")
	if googlePay.Enabled ||
		googlePay.DisabledReason !=
			"Google Pay membutuhkan channel kartu aktif" {
		t.Fatalf("Google Pay dependency was not enforced: %#v", googlePay)
	}

	activation.Methods["credit_card"] = true
	quote, err = buildMidtransPaymentQuote(
		models.Product{Price: 100_000},
		activation, 1,
	)
	if err != nil {
		t.Fatal(err)
	}
	googlePay = methodByProvider(t, quote, "google_pay")
	if !googlePay.Enabled {
		t.Fatalf(
			"Google Pay should be enabled with card channel: %s",
			googlePay.DisabledReason,
		)
	}
}

func TestPayLaterProductionReadinessIsFailClosed(t *testing.T) {
	t.Setenv("MIDTRANS_MODE", "sandbox")
	if reason := midtransPaylaterDisabledReason("akulaku"); reason != "" {
		t.Fatalf("sandbox Akulaku reason = %q", reason)
	}
	if reason := midtransPaylaterDisabledReason("kredivo"); !strings.Contains(reason, "belum tersedia") {
		t.Fatalf("Kredivo reason = %q", reason)
	}

	t.Setenv("MIDTRANS_MODE", "production")
	if reason := midtransPaylaterDisabledReason("akulaku"); !strings.Contains(reason, "pembayar asli") {
		t.Fatalf("production Akulaku reason = %q", reason)
	}
}

func TestMidtransExpectedTotalMustMatchRebuiltQuote(t *testing.T) {
	for _, test := range []struct {
		expected float64
		actual   float64
		want     bool
	}{
		{expected: 109_618, actual: 109_618, want: true},
		{expected: 109_618.4, actual: 109_618, want: true},
		{expected: 109_618, actual: 109_619, want: false},
		{expected: 0, actual: 109_618, want: false},
	} {
		if got := midtransExpectedTotalMatches(
			test.expected,
			test.actual,
		); got != test.want {
			t.Fatalf(
				"match(%v,%v)=%v want %v",
				test.expected,
				test.actual,
				got,
				test.want,
			)
		}
	}
}

func TestMidtransQuoteDeclaresDynamicFeeBearer(t *testing.T) {
	quote, err := buildMidtransPaymentQuote(
		models.Product{Price: 100_000},
		configureMidtransQuoteTest(
			t,
			"other_qris,dana,credit_card",
		),
		1,
	)
	if err != nil {
		t.Fatal(err)
	}
	if quote.FeeBearer != "DYNAMIC" {
		t.Fatalf("fee bearer = %q", quote.FeeBearer)
	}
}
