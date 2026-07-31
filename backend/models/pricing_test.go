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
