package controllers

import (
	"testing"

	"github.com/derry/anggijajan-v2-backend/models"
)

func TestGooglePaySnapPayloadEnablesSecureCard(t *testing.T) {
	payload := buildMidtransSnapPayload(
		"INV-GPAY-TEST",
		models.Product{
			Name: "Test Product",
			Code: "TEST-GPAY",
		},
		midtransPaymentMethodOption{
			ProviderMethod: "google_pay",
			TotalAmount:    100_000,
		},
		models.CheckoutRequest{},
	)

	if payload.CreditCard == nil || !payload.CreditCard.Secure {
		t.Fatal("Google Pay payload must set credit_card.secure=true")
	}
	if len(payload.EnabledPayments) != 1 ||
		payload.EnabledPayments[0] != "google_pay" {
		t.Fatalf("enabled payments = %#v", payload.EnabledPayments)
	}
	if len(payload.ItemDetails) != 1 ||
		payload.ItemDetails[0].MerchantName == "" {
		t.Fatalf("item details are incomplete: %#v", payload.ItemDetails)
	}
}
