package controllers

import (
	"context"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/derry/anggijajan-v2-backend/models"
	"github.com/gofiber/fiber/v2"
)

func configureMidtransQuoteTest(
	t *testing.T,
	enabled string,
) midtransPaymentActivation {
	t.Helper()
	t.Setenv("MIDTRANS_MODE", "sandbox")
	t.Setenv("MIDTRANS_FEE_RULES_JSON_SANDBOX", "")
	t.Setenv("MIDTRANS_METHOD_LIMITS_JSON_SANDBOX", "")
	t.Setenv("MIDTRANS_FEE_VAT_PERCENT", "11")

	activation := midtransPaymentActivation{
		Verified: true,
		Methods:  make(map[string]bool),
	}
	for _, rawMethod := range strings.Split(enabled, ",") {
		method := strings.ToLower(strings.TrimSpace(rawMethod))
		if method != "" {
			activation.Methods[method] = true
		}
	}
	return activation
}

func resetMidtransPreferenceCacheForTest() {
	midtransPreferenceCacheMu.Lock()
	defer midtransPreferenceCacheMu.Unlock()
	midtransPreferenceCache = make(map[string]midtransPreferenceCacheEntry)
}

func requestMidtransPublicConfig(t *testing.T) (int, string) {
	t.Helper()
	app := fiber.New()
	app.Get("/api/payment-config", GetMidtransPaymentConfig)
	response, err := app.Test(httptest.NewRequest(http.MethodGet, "/api/payment-config", nil))
	if err != nil {
		t.Fatalf("payment-config request error = %v", err)
	}
	defer response.Body.Close()
	body, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatalf("read payment-config response error = %v", err)
	}
	return response.StatusCode, string(body)
}

func TestMidtransPaymentConfigUsesSelectedModeAndDoesNotLeakSecrets(t *testing.T) {
	for _, test := range []struct {
		mode      string
		suffix    string
		scriptURL string
	}{
		{mode: "sandbox", suffix: "SANDBOX", scriptURL: "https://app.sandbox.midtrans.com/snap/snap.js"},
		{mode: "production", suffix: "PRODUCTION", scriptURL: "https://app.midtrans.com/snap/snap.js"},
	} {
		t.Run(test.mode, func(t *testing.T) {
			t.Setenv("MIDTRANS_MODE", test.mode)
			t.Setenv("MIDTRANS_MERCHANT_ID_"+test.suffix, "merchant-must-not-leak")
			t.Setenv("MIDTRANS_SERVER_KEY_"+test.suffix, "server-must-not-leak")
			t.Setenv("MIDTRANS_CLIENT_KEY_"+test.suffix, "public-client-key")

			status, body := requestMidtransPublicConfig(t)
			if status != http.StatusOK {
				t.Fatalf("payment-config status = %d, body = %s", status, body)
			}
			for _, forbidden := range []string{
				"merchant-must-not-leak",
				"server-must-not-leak",
				"merchant_id",
				"server_key",
			} {
				if strings.Contains(body, forbidden) {
					t.Fatalf("payment-config leaked forbidden value or field %q", forbidden)
				}
			}
			if !strings.Contains(body, `"mode":"`+test.mode+`"`) ||
				!strings.Contains(body, `"client_key":"public-client-key"`) ||
				!strings.Contains(body, `"snap_script_url":"`+test.scriptURL+`"`) {
				t.Fatalf("unexpected payment-config response: %s", body)
			}
		})
	}
}

func TestMidtransPaymentConfigRejectsMissingClientKey(t *testing.T) {
	t.Setenv("MIDTRANS_MODE", "sandbox")
	t.Setenv("MIDTRANS_MERCHANT_ID_SANDBOX", "merchant")
	t.Setenv("MIDTRANS_SERVER_KEY_SANDBOX", "server")
	t.Setenv("MIDTRANS_CLIENT_KEY_SANDBOX", "")
	status, _ := requestMidtransPublicConfig(t)
	if status != http.StatusServiceUnavailable {
		t.Fatalf("payment-config status = %d, want %d", status, http.StatusServiceUnavailable)
	}
}

func TestMidtransPaymentConfigRejectsInvalidMode(t *testing.T) {
	t.Setenv("MIDTRANS_MODE", "live")
	status, _ := requestMidtransPublicConfig(t)
	if status != http.StatusServiceUnavailable {
		t.Fatalf("payment-config status = %d, want %d", status, http.StatusServiceUnavailable)
	}
}

func methodByProvider(
	t *testing.T,
	quote midtransPaymentQuote,
	providerMethod string,
) midtransPaymentMethodOption {
	t.Helper()
	for _, method := range quote.Methods {
		if method.ProviderMethod == providerMethod {
			return method
		}
	}
	t.Fatalf("method %s not found", providerMethod)
	return midtransPaymentMethodOption{}
}

func TestBuildMidtransPaymentQuoteCheapProduct(t *testing.T) {
	activation := configureMidtransQuoteTest(
		t,
		"other_qris,dana,ovo,gopay,bca_va,seabank_va,bni_va",
	)

	quote, err := buildMidtransPaymentQuote(models.Product{Price: 8_000}, activation)
	if err != nil {
		t.Fatalf("buildMidtransPaymentQuote() error = %v", err)
	}
	if quote.PaymentProvider != "midtrans" {
		t.Fatalf("payment provider = %q", quote.PaymentProvider)
	}
	if quote.StartingPrice-quote.Methods[0].EstimatedFee < 0 {
		t.Fatal("unexpected negative quote")
	}

	qris := methodByProvider(t, quote, "other_qris")
	if !qris.Enabled || qris.RecommendationRank != 1 {
		t.Fatalf("QRIS = enabled %v rank %d", qris.Enabled, qris.RecommendationRank)
	}
	if qris.TotalAmount-qris.EstimatedFee < quote.ProductAmount {
		t.Fatalf("QRIS gross-up is unsafe: total %v fee %v target %v", qris.TotalAmount, qris.EstimatedFee, quote.ProductAmount)
	}

	dana := methodByProvider(t, quote, "dana")
	if !dana.Enabled || dana.RecommendationRank != 2 {
		t.Fatalf("lowest-fee enabled e-wallet = enabled %v rank %d", dana.Enabled, dana.RecommendationRank)
	}

	for _, method := range quote.Methods {
		if method.Enabled && method.TotalAmount != quote.StartingPrice {
			t.Fatalf("enabled method %s total %v != starting price %v", method.ProviderMethod, method.TotalAmount, quote.StartingPrice)
		}
		if method.CustomerSurcharge != 0 || method.ServiceFee != 0 {
			t.Fatalf("customer surcharge must be zero for %s", method.ProviderMethod)
		}
	}

	for _, providerMethod := range []string{"bca_va", "seabank_va"} {
		method := methodByProvider(t, quote, providerMethod)
		if method.Enabled || method.DisabledReason != "Minimum transaksi Rp10.000" {
			t.Fatalf("%s = enabled %v reason %q", providerMethod, method.Enabled, method.DisabledReason)
		}
	}

	bni := methodByProvider(t, quote, "bni_va")
	if bni.Enabled || bni.DisabledReason != "Biaya metode melebihi margin produk" {
		t.Fatalf("expensive VA should be disabled by margin: %#v", bni)
	}
}

func TestBuildMidtransPaymentQuoteUsesProductGroupMarkup(t *testing.T) {
	activation := configureMidtransQuoteTest(t, "other_qris,dana")
	catalogMarkup := 2.0
	groupMarkup := 3.0
	product := models.Product{
		Price: 10_000,
		Catalog: models.Catalog{
			MarkupPercent: &catalogMarkup,
		},
		ProductGroup: &models.ProductGroup{
			MarkupPercent: &groupMarkup,
		},
	}

	quote, err := buildMidtransPaymentQuote(product, activation)
	if err != nil {
		t.Fatalf("buildMidtransPaymentQuote() error = %v", err)
	}
	if quote.ProductAmount != 10_300 {
		t.Fatalf("product amount = %v, want 10300", quote.ProductAmount)
	}
	for _, method := range quote.Methods {
		if method.TotalAmount != quote.StartingPrice {
			t.Fatalf("method %s total %v != starting price %v", method.ProviderMethod, method.TotalAmount, quote.StartingPrice)
		}
		if method.CustomerSurcharge != 0 {
			t.Fatalf("method %s customer surcharge = %v, want 0", method.ProviderMethod, method.CustomerSurcharge)
		}
	}
}

func TestBuildMidtransPaymentQuoteLargeProductAllowsSafeVA(t *testing.T) {
	activation := configureMidtransQuoteTest(t, "other_qris,dana,bca_va,seabank_va")

	quote, err := buildMidtransPaymentQuote(models.Product{Price: 200_000}, activation)
	if err != nil {
		t.Fatalf("buildMidtransPaymentQuote() error = %v", err)
	}
	for _, providerMethod := range []string{"bca_va", "seabank_va"} {
		method := methodByProvider(t, quote, providerMethod)
		if !method.Enabled {
			t.Fatalf("%s should be enabled above minimum with safe margin: %s", providerMethod, method.DisabledReason)
		}
	}
}

func TestBuildMidtransPaymentQuoteDoesNotInventActiveMethods(t *testing.T) {
	activation := configureMidtransQuoteTest(t, "other_qris")

	quote, err := buildMidtransPaymentQuote(models.Product{Price: 50_000}, activation)
	if err != nil {
		t.Fatalf("buildMidtransPaymentQuote() error = %v", err)
	}
	method := methodByProvider(t, quote, "dana")
	if method.Enabled || method.DisabledReason != "Metode belum aktif di akun Midtrans" {
		t.Fatalf("inactive method response = %#v", method)
	}
}

func TestBuildMidtransPaymentQuoteDisablesCatalogWhenPreferenceIsUnverified(t *testing.T) {
	configureMidtransQuoteTest(t, "")
	activation := midtransPaymentActivation{
		Methods:        map[string]bool{},
		DisabledReason: midtransPreferenceUnavailableReason,
	}

	quote, err := buildMidtransPaymentQuote(models.Product{Price: 50_000}, activation)
	if err != nil {
		t.Fatalf("buildMidtransPaymentQuote() error = %v", err)
	}
	if len(quote.Methods) == 0 {
		t.Fatal("complete catalog must remain visible")
	}
	for _, method := range quote.Methods {
		if method.Enabled || method.DisabledReason != midtransPreferenceUnavailableReason {
			t.Fatalf("unverified method must remain disabled: %#v", method)
		}
	}
}

func TestMidtransPaymentActivationComesFromPreferenceAndIsCached(t *testing.T) {
	resetMidtransPreferenceCacheForTest()
	t.Cleanup(resetMidtransPreferenceCacheForTest)
	var requestCount int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&requestCount, 1)
		if r.URL.Path != "/snap/v3/merchant-preferences" {
			t.Errorf("unexpected preference path: %s", r.URL.Path)
		}
		if username, password, ok := r.BasicAuth(); !ok || username != "server-key" || password != "" {
			t.Errorf("unexpected Basic Auth")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"merchant_id":"M-TEST",
			"payment_channels":[
				{"name":"other_qris","enabled":true},
				{"name":"dana","enabled":false}
			]
		}`))
	}))
	defer server.Close()

	t.Setenv("MIDTRANS_MODE", "sandbox")
	t.Setenv("MIDTRANS_SERVER_KEY_SANDBOX", "server-key")
	t.Setenv("MIDTRANS_MERCHANT_ID_SANDBOX", "M-TEST")
	t.Setenv("MIDTRANS_SNAP_BASE_URL", server.URL)

	first := getMidtransPaymentActivation(context.Background())
	second := getMidtransPaymentActivation(context.Background())
	if !first.Verified || !first.Methods["other_qris"] || first.Methods["dana"] {
		t.Fatalf("unexpected preference activation: %#v", first)
	}
	if !second.Verified || atomic.LoadInt32(&requestCount) != 1 {
		t.Fatalf("preference cache was not used, request count = %d", requestCount)
	}
}

func TestMidtransPreferenceFailureDoesNotEnableAnyMethod(t *testing.T) {
	resetMidtransPreferenceCacheForTest()
	t.Cleanup(resetMidtransPreferenceCacheForTest)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "unavailable", http.StatusBadGateway)
	}))
	defer server.Close()

	t.Setenv("MIDTRANS_MODE", "sandbox")
	t.Setenv("MIDTRANS_SERVER_KEY_SANDBOX", "server-key")
	t.Setenv("MIDTRANS_MERCHANT_ID_SANDBOX", "M-TEST")
	t.Setenv("MIDTRANS_SNAP_BASE_URL", server.URL)

	activation := getMidtransPaymentActivation(context.Background())
	if activation.Verified || len(activation.Methods) != 0 ||
		activation.DisabledReason != midtransPreferenceUnavailableReason {
		t.Fatalf("failed preference must be safe-disabled: %#v", activation)
	}
}

func TestBuildMidtransSnapPayloadUsesRebuiltQuote(t *testing.T) {
	activation := configureMidtransQuoteTest(t, "other_qris")
	product := models.Product{Code: "SKU-7", Name: "5 Diamonds", Price: 8_000}
	quote, err := buildMidtransPaymentQuote(product, activation)
	if err != nil {
		t.Fatal(err)
	}
	selected, found := findMidtransPaymentQuote(quote, "v1:midtrans:other_qris")
	if !found || !selected.Enabled {
		t.Fatalf("rebuilt QRIS quote unavailable: %#v", selected)
	}

	var request models.CheckoutRequest
	if err := json.Unmarshal([]byte(`{
		"product_id":7,
		"customer_phone":"12345",
		"quote_key":"v1:midtrans:other_qris",
		"amount":1,
		"total_amount":1,
		"estimated_fee":0
	}`), &request); err != nil {
		t.Fatal(err)
	}
	payload := buildMidtransSnapPayload(
		"INV-TEST",
		product,
		selected,
		request,
	)

	if payload.TransactionDetails.GrossAmount != int64(quote.StartingPrice) {
		t.Fatalf("gross amount = %d, want rebuilt %v", payload.TransactionDetails.GrossAmount, quote.StartingPrice)
	}
	if len(payload.EnabledPayments) != 1 || payload.EnabledPayments[0] != "other_qris" {
		t.Fatalf("enabled payments = %v", payload.EnabledPayments)
	}
	var itemTotal int64
	for _, item := range payload.ItemDetails {
		itemTotal += item.Price * int64(item.Quantity)
	}
	if itemTotal != payload.TransactionDetails.GrossAmount {
		t.Fatalf("item total %d != gross amount %d", itemTotal, payload.TransactionDetails.GrossAmount)
	}
	encoded, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	t.Log(string(encoded))
}

func TestCreateMidtransSnapUsesBasicAuthAndSelectedPayment(t *testing.T) {
	var received midtransSnapRequest
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if username, password, ok := r.BasicAuth(); !ok || username != "server-key" || password != "" {
			t.Errorf("unexpected Basic Auth: username=%q password=%q ok=%v", username, password, ok)
		}
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatal(err)
		}
		if err := json.Unmarshal(body, &received); err != nil {
			t.Fatal(err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"token":"snap-token","redirect_url":"https://example.test/pay"}`))
	}))
	defer server.Close()

	t.Setenv("MIDTRANS_MODE", "sandbox")
	t.Setenv("MIDTRANS_SERVER_KEY_SANDBOX", "server-key")
	t.Setenv("MIDTRANS_SNAP_BASE_URL", server.URL)
	payload := midtransSnapRequest{
		TransactionDetails: midtransSnapTransactionDetails{OrderID: "INV-TEST", GrossAmount: 10_000},
		ItemDetails:        []midtransSnapItem{{ID: "ITEM", Price: 10_000, Quantity: 1, Name: "Item"}},
		EnabledPayments:    []string{"bca_va"},
	}

	response, err := createMidtransSnap(context.Background(), payload)
	if err != nil {
		t.Fatalf("createMidtransSnap() error = %v", err)
	}
	if response.Token != "snap-token" || len(received.EnabledPayments) != 1 || received.EnabledPayments[0] != "bca_va" {
		t.Fatalf("response=%#v received=%#v", response, received)
	}
}

func TestMidtransSignatureValidation(t *testing.T) {
	input := "INV-1" + "200" + "10000.00" + "server-key"
	digest := sha512.Sum512([]byte(input))
	notification := midtransNotification{
		OrderID:      "INV-1",
		StatusCode:   "200",
		GrossAmount:  "10000.00",
		SignatureKey: hex.EncodeToString(digest[:]),
	}
	if !isValidMidtransSignature(notification, "server-key") {
		t.Fatal("valid signature was rejected")
	}
	notification.GrossAmount = "9999.00"
	if isValidMidtransSignature(notification, "server-key") {
		t.Fatal("tampered signature was accepted")
	}
}

func TestMidtransPaidTransitionIsIdempotentAfterProviderClaim(t *testing.T) {
	notification := midtransNotification{
		StatusCode:        "200",
		TransactionStatus: "settlement",
		FraudStatus:       "accept",
	}
	first := resolveMidtransPaymentTransition(models.Transaction{
		Status: "UNPAID", PaymentStatus: "UNPAID", FulfillmentStatus: "WAITING_PAYMENT",
	}, notification)
	if !first.ShouldExecute || first.FulfillmentStatus != "READY" {
		t.Fatalf("first transition = %#v", first)
	}

	duplicate := resolveMidtransPaymentTransition(models.Transaction{
		Status: "PENDING", PaymentStatus: "PAID", FulfillmentStatus: "PROCESSING",
	}, notification)
	if duplicate.ShouldExecute || duplicate.Changed {
		t.Fatalf("duplicate callback must not claim provider twice: %#v", duplicate)
	}
}

func TestMidtransFailureCannotDowngradePaidTransaction(t *testing.T) {
	transition := resolveMidtransPaymentTransition(models.Transaction{
		Status: "PENDING", PaymentStatus: "PAID", FulfillmentStatus: "PROCESSING",
	}, midtransNotification{TransactionStatus: "expire"})
	if transition.Changed || transition.PaymentStatus != "PAID" {
		t.Fatalf("paid transaction was downgraded: %#v", transition)
	}
}

func TestMidtransRecommendationDoesNotDependOnWalletBrand(t *testing.T) {
	options := []midtransPaymentMethodOption{
		{Name: "Wallet Mahal", Category: "E_WALLET", Enabled: true, EstimatedFee: 200},
		{Name: "QRIS", Category: "QRIS", Enabled: true, EstimatedFee: 70},
		{Name: "Wallet Hemat", Category: "E_WALLET", Enabled: true, EstimatedFee: 100},
	}
	ranks := chooseMidtransRecommendations(options)
	if len(ranks) != 2 || ranks[0] != 1 || ranks[1] != 2 {
		t.Fatalf("recommendation indexes = %v", ranks)
	}
}

func TestMidtransSnapResponseDoesNotLeakServerKey(t *testing.T) {
	serverKey := "do-not-leak"
	t.Setenv("MIDTRANS_MODE", "sandbox")
	t.Setenv("MIDTRANS_SERVER_KEY_SANDBOX", serverKey)
	response := midtransSnapResponse{Token: "token", RedirectURL: "url"}
	encoded, err := json.Marshal(response)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(encoded), serverKey) {
		t.Fatal("server key leaked into response")
	}
}

func TestMidtransQuoteExamples(t *testing.T) {
	activation := configureMidtransQuoteTest(t, strings.Join([]string{
		"other_qris", "gopay", "dana", "ovo", "shopeepay",
		"bca_va", "bni_va", "bri_va", "cimb_va", "permata_va",
		"echannel", "bsi_va", "seabank_va", "credit_card",
		"alfamart", "indomaret",
	}, ","))

	for _, example := range []struct {
		name    string
		capital float64
	}{
		{name: "cheap", capital: 8_000},
		{name: "large", capital: 200_000},
	} {
		t.Run(example.name, func(t *testing.T) {
			quote, err := buildMidtransPaymentQuote(
				models.Product{Price: example.capital},
				activation,
			)
			if err != nil {
				t.Fatal(err)
			}
			encoded, err := json.MarshalIndent(quote, "", "  ")
			if err != nil {
				t.Fatal(err)
			}
			t.Log(string(encoded))
		})
	}
}
