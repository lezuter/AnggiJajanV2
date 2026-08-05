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

func TestCustomerSurchargeWorthinessGuard(t *testing.T) {
	for _, test := range []struct {
		name       string
		basePrice  float64
		surcharge  float64
		maxPercent float64
		want       bool
	}{
		{
			name:      "zero surcharge",
			basePrice: 1_500, surcharge: 0, maxPercent: 30, want: true,
		},
		{
			name:      "fee larger than cheap product",
			basePrice: 1_500, surcharge: 3_000, maxPercent: 30, want: false,
		},
		{
			name:      "small relative credit card fee",
			basePrice: 4_123_874, surcharge: 45_950, maxPercent: 30, want: true,
		},
		{
			name:      "exact threshold",
			basePrice: 10_000, surcharge: 3_000, maxPercent: 30, want: true,
		},
		{
			name:      "above threshold",
			basePrice: 10_000, surcharge: 3_001, maxPercent: 30, want: false,
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			got := isCustomerSurchargeWorthwhile(
				test.basePrice,
				test.surcharge,
				test.maxPercent,
			)
			if got != test.want {
				t.Fatalf(
					"worthiness(%v, %v, %v) = %v, want %v",
					test.basePrice,
					test.surcharge,
					test.maxPercent,
					got,
					test.want,
				)
			}
		})
	}
}

func TestBuildMidtransPaymentQuoteCheapProduct(t *testing.T) {
	activation := configureMidtransQuoteTest(
		t,
		"other_qris,dana,ovo,gopay,bca_va,seabank_va,bni_va",
	)
	capital := 8_000.0

	quote, err := buildMidtransPaymentQuote(
		models.Product{Price: capital},
		activation,
	)
	if err != nil {
		t.Fatalf("buildMidtransPaymentQuote() error = %v", err)
	}
	if quote.PaymentProvider != "midtrans" {
		t.Fatalf("payment provider = %q", quote.PaymentProvider)
	}

	requiredMerchantNet, minimumRetainedProfit :=
		calculateMidtransRetentionTarget(
			capital,
			quote.ProductAmount,
			defaultPaymentSurchargeProfitRetentionPercent,
		)

	qris := methodByProvider(t, quote, "other_qris")
	if !qris.Enabled || qris.RecommendationRank != 1 {
		t.Fatalf(
			"QRIS = enabled %v rank %d",
			qris.Enabled,
			qris.RecommendationRank,
		)
	}
	if qris.TotalAmount-qris.EstimatedFee < quote.ProductAmount {
		t.Fatalf(
			"QRIS gross-up is unsafe: total %v fee %v target %v",
			qris.TotalAmount,
			qris.EstimatedFee,
			quote.ProductAmount,
		)
	}

	dana := methodByProvider(t, quote, "dana")
	if !dana.Enabled || dana.RecommendationRank != 2 {
		t.Fatalf(
			"second cheapest method = enabled %v rank %d",
			dana.Enabled,
			dana.RecommendationRank,
		)
	}

	for _, method := range quote.Methods {
		if !method.Enabled {
			continue
		}
		if method.TotalAmount < quote.StartingPrice {
			t.Fatalf(
				"enabled method %s total %v below starting price %v",
				method.ProviderMethod,
				method.TotalAmount,
				quote.StartingPrice,
			)
		}
		if method.CustomerSurcharge !=
			method.TotalAmount-quote.StartingPrice {
			t.Fatalf(
				"method %s surcharge %v does not match total delta",
				method.ProviderMethod,
				method.CustomerSurcharge,
			)
		}
		if method.ServiceFee != method.CustomerSurcharge {
			t.Fatalf(
				"method %s service fee %v != surcharge %v",
				method.ProviderMethod,
				method.ServiceFee,
				method.CustomerSurcharge,
			)
		}
		if method.TotalAmount-method.EstimatedFee < requiredMerchantNet {
			t.Fatalf(
				"method %s breaks retained-profit floor: total=%v fee=%v required=%v",
				method.ProviderMethod,
				method.TotalAmount,
				method.EstimatedFee,
				requiredMerchantNet,
			)
		}
		if method.EstimatedNetProfit < minimumRetainedProfit {
			t.Fatalf(
				"method %s retained profit %v below minimum %v",
				method.ProviderMethod,
				method.EstimatedNetProfit,
				minimumRetainedProfit,
			)
		}
	}

	for _, providerMethod := range []string{"bca_va", "seabank_va"} {
		method := methodByProvider(t, quote, providerMethod)
		if method.Enabled ||
			!strings.Contains(
				method.DisabledReason,
				"Biaya metode terlalu besar",
			) {
			t.Fatalf(
				"%s should be disabled by surcharge worthiness: %#v",
				providerMethod,
				method,
			)
		}
	}

	bni := methodByProvider(t, quote, "bni_va")
	if bni.Enabled ||
		!strings.Contains(
			bni.DisabledReason,
			"Biaya metode terlalu besar",
		) {
		t.Fatalf(
			"expensive VA should be disabled when surcharge is not worth it: %#v",
			bni,
		)
	}
}

func TestBuildMidtransPaymentQuoteUsesProductGroupMarkup(t *testing.T) {
	activation := configureMidtransQuoteTest(t, "other_qris,dana")
	catalogMarkup := 2.0
	groupMarkup := 3.0
	capital := 10_000.0
	product := models.Product{
		Price: capital,
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

	requiredMerchantNet, minimumRetainedProfit :=
		calculateMidtransRetentionTarget(
			capital,
			quote.ProductAmount,
			defaultPaymentSurchargeProfitRetentionPercent,
		)

	for _, method := range quote.Methods {
		if method.TotalAmount < quote.StartingPrice {
			t.Fatalf(
				"method %s total %v below starting price %v",
				method.ProviderMethod,
				method.TotalAmount,
				quote.StartingPrice,
			)
		}
		if method.CustomerSurcharge !=
			method.TotalAmount-quote.StartingPrice {
			t.Fatalf(
				"method %s customer surcharge = %v, total delta = %v",
				method.ProviderMethod,
				method.CustomerSurcharge,
				method.TotalAmount-quote.StartingPrice,
			)
		}
		if method.Enabled &&
			method.TotalAmount-method.EstimatedFee < requiredMerchantNet {
			t.Fatalf(
				"method %s does not preserve the retained-profit floor",
				method.ProviderMethod,
			)
		}
		if method.Enabled &&
			method.EstimatedNetProfit < minimumRetainedProfit {
			t.Fatalf(
				"method %s retained profit %v below %v",
				method.ProviderMethod,
				method.EstimatedNetProfit,
				minimumRetainedProfit,
			)
		}
	}
}

func TestBuildMidtransPaymentQuoteAppliesOnlyRequiredSurcharge(t *testing.T) {
	activation := configureMidtransQuoteTest(
		t,
		"other_qris,dana,ovo,gopay,bca_va",
	)
	capital := 1_800_000.0

	quote, err := buildMidtransPaymentQuote(
		models.Product{Price: capital},
		activation,
	)
	if err != nil {
		t.Fatalf("buildMidtransPaymentQuote() error = %v", err)
	}

	requiredMerchantNet, minimumRetainedProfit :=
		calculateMidtransRetentionTarget(
			capital,
			quote.ProductAmount,
			defaultPaymentSurchargeProfitRetentionPercent,
		)
	targetProductProfit := quote.ProductAmount - capital

	qris := methodByProvider(t, quote, "other_qris")
	if !qris.Enabled ||
		qris.CustomerSurcharge != 0 ||
		qris.TotalAmount != quote.StartingPrice {
		t.Fatalf(
			"QRIS must remain the zero-surcharge baseline: %#v",
			qris,
		)
	}

	for _, providerMethod := range []string{"dana", "ovo", "bca_va"} {
		method := methodByProvider(t, quote, providerMethod)
		if !method.Enabled || method.CustomerSurcharge != 0 {
			t.Fatalf(
				"%s fee should be fully covered by the 30%% subsidy allowance: %#v",
				providerMethod,
				method,
			)
		}
		if method.EstimatedNetProfit < minimumRetainedProfit {
			t.Fatalf(
				"%s retained profit %v below %v",
				providerMethod,
				method.EstimatedNetProfit,
				minimumRetainedProfit,
			)
		}
	}

	gopay := methodByProvider(t, quote, "gopay")
	if !gopay.Enabled || gopay.CustomerSurcharge <= 0 {
		t.Fatalf(
			"GoPay should charge only the amount beyond merchant subsidy: %#v",
			gopay,
		)
	}
	if gopay.TotalAmount-gopay.EstimatedFee < requiredMerchantNet {
		t.Fatalf(
			"GoPay still breaks retained-profit floor: %#v",
			gopay,
		)
	}
	if gopay.EstimatedNetProfit < minimumRetainedProfit {
		t.Fatalf(
			"GoPay retained profit %v below %v",
			gopay.EstimatedNetProfit,
			minimumRetainedProfit,
		)
	}
	if gopay.EstimatedNetProfit >= targetProductProfit {
		t.Fatalf(
			"GoPay test must demonstrate partial merchant subsidy: %#v",
			gopay,
		)
	}

	for _, method := range quote.Methods {
		if !method.Enabled {
			continue
		}
		if method.CustomerSurcharge !=
			method.TotalAmount-quote.StartingPrice {
			t.Fatalf(
				"%s surcharge does not equal final total delta",
				method.ProviderMethod,
			)
		}
		if method.EstimatedNetProfit < minimumRetainedProfit {
			t.Fatalf(
				"%s reduced retained profit below policy: %#v",
				method.ProviderMethod,
				method,
			)
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

func TestBuildMidtransSnapPayloadUsesSurchargedMethodTotal(t *testing.T) {
	activation := configureMidtransQuoteTest(t, "other_qris,gopay")
	product := models.Product{Code: "SKU-GOPAY", Name: "Large Product", Price: 1_800_000}
	quote, err := buildMidtransPaymentQuote(product, activation)
	if err != nil {
		t.Fatal(err)
	}
	selected, found := findMidtransPaymentQuote(quote, "v1:midtrans:gopay")
	if !found || !selected.Enabled || selected.CustomerSurcharge <= 0 {
		t.Fatalf("surcharged GoPay quote unavailable: %#v", selected)
	}

	payload := buildMidtransSnapPayload(
		"INV-GOPAY",
		product,
		selected,
		models.CheckoutRequest{CustomerPhone: "12345"},
	)

	if payload.TransactionDetails.GrossAmount != int64(selected.TotalAmount) {
		t.Fatalf("gross amount = %d, want selected total %v", payload.TransactionDetails.GrossAmount, selected.TotalAmount)
	}
	if payload.TransactionDetails.GrossAmount <= int64(quote.StartingPrice) {
		t.Fatalf("surcharged gross amount %d must exceed starting price %v", payload.TransactionDetails.GrossAmount, quote.StartingPrice)
	}
	if len(payload.ItemDetails) != 1 ||
		payload.ItemDetails[0].Price != payload.TransactionDetails.GrossAmount {
		t.Fatalf("item details do not match surcharged gross amount: %#v", payload)
	}
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

func TestMidtransRecommendationUsesLowestCustomerTotal(t *testing.T) {
	options := []midtransPaymentMethodOption{
		{
			Name: "Wallet Mahal", Category: "E_WALLET", Enabled: true,
			TotalAmount: 103_000, CustomerSurcharge: 3_000, EstimatedFee: 2_000,
		},
		{
			Name: "QRIS", Category: "QRIS", Enabled: true,
			TotalAmount: 100_000, CustomerSurcharge: 0, EstimatedFee: 777,
		},
		{
			Name: "Wallet Hemat", Category: "E_WALLET", Enabled: true,
			TotalAmount: 101_500, CustomerSurcharge: 1_500, EstimatedFee: 1_200,
		},
	}
	ranks := chooseMidtransRecommendations(options)
	if len(ranks) != 2 || ranks[0] != 1 || ranks[1] != 2 {
		t.Fatalf("recommendation indexes = %v", ranks)
	}
}

func TestMidtransRecommendationPrefersQRISOnlyWhenCustomerTotalTies(t *testing.T) {
	options := []midtransPaymentMethodOption{
		{
			Name: "Wallet A", ProviderMethod: "wallet_a", Category: "E_WALLET",
			Enabled: true, TotalAmount: 100_000, CustomerSurcharge: 0,
			EstimatedFee: 777,
		},
		{
			Name: "QRIS", ProviderMethod: "other_qris", Category: "QRIS",
			Enabled: true, TotalAmount: 100_000, CustomerSurcharge: 0,
			EstimatedFee: 777,
		},
		{
			Name: "Wallet B", ProviderMethod: "wallet_b", Category: "E_WALLET",
			Enabled: true, TotalAmount: 101_000, CustomerSurcharge: 1_000,
			EstimatedFee: 1_200,
		},
	}
	ranks := chooseMidtransRecommendations(options)
	if len(ranks) != 2 || ranks[0] != 1 || ranks[1] != 0 {
		t.Fatalf("recommendation indexes = %v", ranks)
	}
}

func TestMidtransRecommendationCanBeatQRISWhenActuallyCheaper(t *testing.T) {
	options := []midtransPaymentMethodOption{
		{
			Name: "Wallet Promo", ProviderMethod: "wallet_promo",
			Category: "E_WALLET", Enabled: true, TotalAmount: 99_000,
			CustomerSurcharge: 0, EstimatedFee: 500,
		},
		{
			Name: "QRIS", ProviderMethod: "other_qris", Category: "QRIS",
			Enabled: true, TotalAmount: 100_000, CustomerSurcharge: 0,
			EstimatedFee: 777,
		},
	}
	ranks := chooseMidtransRecommendations(options)
	if len(ranks) != 2 || ranks[0] != 0 || ranks[1] != 1 {
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
