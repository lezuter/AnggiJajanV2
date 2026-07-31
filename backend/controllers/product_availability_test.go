package controllers

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/derry/anggijajan-v2-backend/models"
	"github.com/gofiber/fiber/v2"
)

func TestStorefrontProductAvailabilityError(t *testing.T) {
	tests := []struct {
		name     string
		product  models.Product
		expected string
	}{
		{
			name: "sellable product",
			product: models.Product{
				IsActive:     true,
				AdminEnabled: true,
				Stock:        10,
			},
			expected: "",
		},
		{
			name: "unlimited stock is sellable",
			product: models.Product{
				IsActive:     true,
				AdminEnabled: true,
				Stock:        -1,
			},
			expected: "",
		},
		{
			name: "provider inactive",
			product: models.Product{
				IsActive:     false,
				AdminEnabled: true,
				Stock:        10,
			},
			expected: "Produk sedang tidak tersedia dari provider.",
		},
		{
			name: "admin disabled",
			product: models.Product{
				IsActive:     true,
				AdminEnabled: false,
				Stock:        10,
			},
			expected: "Produk sedang dinonaktifkan oleh admin.",
		},
		{
			name: "empty stock",
			product: models.Product{
				IsActive:     true,
				AdminEnabled: true,
				Stock:        0,
			},
			expected: "Stok produk sedang kosong.",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			actual := storefrontProductAvailabilityError(test.product)
			if actual != test.expected {
				t.Fatalf("expected %q, got %q", test.expected, actual)
			}
		})
	}
}

func TestNormalizeBulkProductIDs(t *testing.T) {
	productIDs, err := normalizeBulkProductIDs([]uint{3, 3, 7})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(productIDs) != 2 || productIDs[0] != 3 || productIDs[1] != 7 {
		t.Fatalf("expected deduplicated IDs [3 7], got %v", productIDs)
	}

	if _, err := normalizeBulkProductIDs([]uint{0}); err == nil {
		t.Fatal("expected product ID 0 to be rejected")
	}

	tooManyIDs := make([]uint, maxBulkProductIDs+1)
	for index := range tooManyIDs {
		tooManyIDs[index] = uint(index + 1)
	}
	if _, err := normalizeBulkProductIDs(tooManyIDs); err == nil {
		t.Fatalf("expected more than %d IDs to be rejected", maxBulkProductIDs)
	}
}

func TestBulkUpdateRejectsProviderAndPricingFields(t *testing.T) {
	for _, field := range []string{
		`"is_active":false`,
		`"price":1000`,
	} {
		t.Run(field, func(t *testing.T) {
			app := fiber.New()
			app.Patch("/", BulkUpdateProducts)

			body := `{"product_ids":[1],"changes":{` + field + `}}`
			request := httptest.NewRequest("PATCH", "/", strings.NewReader(body))
			request.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)

			response, err := app.Test(request)
			if err != nil {
				t.Fatalf("request failed: %v", err)
			}
			if response.StatusCode != fiber.StatusBadRequest {
				t.Fatalf("expected status 400, got %d", response.StatusCode)
			}
		})
	}
}

func TestNormalizeBulkProductImageURL(t *testing.T) {
	for _, imageURL := range []string{
		"https://i.imgur.com/vkLufAE.png",
		"http://example.com/product.png",
		"/images/products/pubg.png",
	} {
		normalized, err := normalizeBulkProductImageURL("  " + imageURL + "  ")
		if err != nil {
			t.Fatalf("expected %q to be accepted: %v", imageURL, err)
		}
		if normalized != imageURL {
			t.Fatalf("expected %q, got %q", imageURL, normalized)
		}
	}

	for _, imageURL := range []string{
		"",
		"[https://i.imgur.com/a.png](https://i.imgur.com/a.png)",
		"//example.com/product.png",
		"javascript:alert(1)",
	} {
		if _, err := normalizeBulkProductImageURL(imageURL); err == nil {
			t.Fatalf("expected %q to be rejected", imageURL)
		}
	}
}

func TestBulkUpdatePayloadAcceptsAllowedAdminFields(t *testing.T) {
	app := fiber.New()
	app.Patch("/", func(c *fiber.Ctx) error {
		var input bulkUpdateProductsInput
		if err := decodeStrictProductJSON(c, &input); err != nil {
			return c.SendStatus(fiber.StatusBadRequest)
		}
		if input.Changes.AdminEnabled == nil ||
			*input.Changes.AdminEnabled ||
			input.Changes.CatalogCardCode == nil ||
			*input.Changes.CatalogCardCode != "PUBGM" ||
			input.Changes.ImageURL == nil ||
			*input.Changes.ImageURL != "https://i.imgur.com/vkLufAE.png" {
			return c.SendStatus(fiber.StatusUnprocessableEntity)
		}
		return c.SendStatus(fiber.StatusNoContent)
	})

	body := `{"product_ids":[1,2],"changes":{"admin_enabled":false,"catalog_cardcode":"PUBGM","image_url":"https://i.imgur.com/vkLufAE.png"}}`
	request := httptest.NewRequest("PATCH", "/", strings.NewReader(body))
	request.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)

	response, err := app.Test(request)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if response.StatusCode != fiber.StatusNoContent {
		t.Fatalf("expected status 204, got %d", response.StatusCode)
	}
}
