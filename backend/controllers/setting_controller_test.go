package controllers

import "testing"

func TestPaymentLogoURLValidation(t *testing.T) {
	for _, value := range []string{
		"",
		"/payment-logos/qris.svg",
		"/assets/payments/custom-logo.webp",
		"https://cdn.example.com/payment/logo.svg",
	} {
		if !isValidPaymentLogoURL(value) {
			t.Fatalf("valid logo URL rejected: %q", value)
		}
	}

	for _, value := range []string{
		"//evil.example/logo.svg",
		"/payment-logos/../secret",
		`/payment-logos\logo.svg`,
		"http://cdn.example.com/logo.svg",
		"javascript:alert(1)",
		"data:image/svg+xml;base64,AAAA",
		"file:///tmp/logo.svg",
	} {
		if isValidPaymentLogoURL(value) {
			t.Fatalf("unsafe logo URL accepted: %q", value)
		}
	}
}
