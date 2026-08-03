package models

import "testing"

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
