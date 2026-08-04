package controllers

import (
	"crypto/md5"
	"encoding/hex"
	"strings"
	"testing"
)

func TestDigiflazzPriceListSignatureUsesPricelistSuffix(t *testing.T) {
	username := "buyer"
	apiKey := "secret"
	expectedDigest := md5.Sum([]byte(username + apiKey + "pricelist"))
	want := hex.EncodeToString(expectedDigest[:])

	if got := digiflazzPriceListSignature(username, apiKey); got != want {
		t.Fatalf("signature = %q, want %q", got, want)
	}
}

func TestDecodeDigiflazzPriceListSuccess(t *testing.T) {
	products, err := decodeDigiflazzPriceList(strings.NewReader(`{
		"data": [{"buyer_sku_code":"PM60UC","price":14543}]
	}`))
	if err != nil {
		t.Fatalf("decodeDigiflazzPriceList() error = %v", err)
	}
	if len(products) != 1 || products[0]["buyer_sku_code"] != "PM60UC" {
		t.Fatalf("products = %#v", products)
	}
}

func TestDecodeDigiflazzPriceListSurfacesProviderError(t *testing.T) {
	_, err := decodeDigiflazzPriceList(strings.NewReader(`{
		"data": {"rc":"83","message":"IP tidak terdaftar"}
	}`))
	if err == nil {
		t.Fatal("decodeDigiflazzPriceList() error = nil, want provider error")
	}

	want := "Digiflazz menolak price list (RC 83): IP tidak terdaftar"
	if err.Error() != want {
		t.Fatalf("error = %q, want %q", err.Error(), want)
	}
}

func TestDecodeDigiflazzPriceListRejectsEmptySnapshot(t *testing.T) {
	_, err := decodeDigiflazzPriceList(strings.NewReader(`{"data":[]}`))
	if err == nil || !strings.Contains(err.Error(), "daftar harga kosong") {
		t.Fatalf("error = %v, want empty price list error", err)
	}
}
