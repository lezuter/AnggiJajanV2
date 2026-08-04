package models

import (
	"math"
	"testing"
)

func float64Pointer(value float64) *float64 {
	return &value
}

func TestResolveStorefrontMarkupRate(t *testing.T) {
	tests := []struct {
		name          string
		catalogMarkup *float64
		groupMarkup   *float64
		want          float64
	}{
		{name: "group overrides catalog", catalogMarkup: float64Pointer(2), groupMarkup: float64Pointer(3), want: 0.03},
		{name: "catalog used without group override", catalogMarkup: float64Pointer(2), want: 0.02},
		{name: "global used without overrides", want: StorefrontMarkupRate},
		{name: "zero group override is valid", catalogMarkup: float64Pointer(2), groupMarkup: float64Pointer(0), want: 0},
		{name: "zero catalog override is valid", catalogMarkup: float64Pointer(0), want: 0},
		{name: "negative group falls back to catalog", catalogMarkup: float64Pointer(2), groupMarkup: float64Pointer(-1), want: 0.02},
		{name: "group above one hundred falls back to global", groupMarkup: float64Pointer(101), want: StorefrontMarkupRate},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := ResolveStorefrontMarkupRate(test.catalogMarkup, test.groupMarkup); got != test.want {
				t.Fatalf("ResolveStorefrontMarkupRate() = %v, want %v", got, test.want)
			}
		})
	}
}

func TestInvalidMarkupDoesNotProduceInvalidPrice(t *testing.T) {
	invalidMarkups := []float64{
		math.NaN(),
		math.Inf(1),
		math.Inf(-1),
	}

	for _, invalidMarkup := range invalidMarkups {
		rate := ResolveStorefrontMarkupRate(nil, &invalidMarkup)
		price := CalculateSellingPriceWithMarkup(10_000, rate)
		if math.IsNaN(price) || math.IsInf(price, 0) {
			t.Fatalf("invalid markup %v produced invalid price %v", invalidMarkup, price)
		}
		if price != 10_500 {
			t.Fatalf("invalid markup %v produced price %v, want 10500", invalidMarkup, price)
		}
	}
}

func TestCalculateSellingPriceWithMarkup(t *testing.T) {
	if got := CalculateSellingPriceWithMarkup(10_000, 0.05); got != 10_500 {
		t.Fatalf("CalculateSellingPriceWithMarkup() = %v, want 10500", got)
	}
}

func TestProductGroupMarkupChangesSellingPrice(t *testing.T) {
	catalogMarkup := float64Pointer(2)
	groupMarkup := float64Pointer(3)
	catalogPrice := CalculateSellingPriceWithMarkup(
		10_000,
		ResolveStorefrontMarkupRate(catalogMarkup, nil),
	)
	groupPrice := CalculateSellingPriceWithMarkup(
		10_000,
		ResolveStorefrontMarkupRate(catalogMarkup, groupMarkup),
	)

	if catalogPrice != 10_200 || groupPrice != 10_300 {
		t.Fatalf("catalog price = %v, group price = %v", catalogPrice, groupPrice)
	}
	if catalogPrice == groupPrice {
		t.Fatal("product group markup must produce a different selling price")
	}
}

func TestCalculateSellingPrice(t *testing.T) {
	tests := []struct {
		name    string
		capital float64
		want    float64
	}{
		{name: "round amount", capital: 10000, want: 10500},
		{name: "round selling result", capital: 12345, want: 12962},
		{name: "round provider capital first", capital: 999.49, want: 1049},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := CalculateSellingPrice(test.capital); got != test.want {
				t.Fatalf("CalculateSellingPrice(%v) = %v, want %v", test.capital, got, test.want)
			}
		})
	}
}

func TestProductAfterFindExposesMidtransStartingPrice(t *testing.T) {
	t.Setenv("MIDTRANS_MODE", "sandbox")
	t.Setenv("MIDTRANS_FEE_RULES_JSON_SANDBOX", "")
	t.Setenv("MIDTRANS_FEE_VAT_PERCENT", "11")

	product := Product{Price: 1000}
	if err := product.AfterFind(nil); err != nil {
		t.Fatalf("AfterFind() error = %v", err)
	}
	if product.SellingPrice != 1050 {
		t.Fatalf("selling price = %v", product.SellingPrice)
	}
	if product.StartingPrice <= product.SellingPrice {
		t.Fatalf("starting price %v must gross-up selling price %v", product.StartingPrice, product.SellingPrice)
	}
	if product.StartingMethod != "QRIS" {
		t.Fatalf("starting method = %q", product.StartingMethod)
	}
}
