package controllers

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/derry/anggijajan-v2-backend/models"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func apiGamesSnapshotForTest() apiGamesProductSnapshot {
	return apiGamesProductSnapshot{
		SKU:             "SKU-1",
		Brand:           "Mobile Legends",
		Name:            "86 Diamonds",
		CatalogCardCode: "MLBB",
		IsActive:        true,
	}
}

func TestApiGamesValidCatalogPlansCreateAndUpdate(t *testing.T) {
	snapshot := apiGamesSnapshotForTest()
	validCatalogs := map[string]bool{"MLBB": true}

	createPlan := planApiGamesProduct(snapshot, validCatalogs, nil)
	if createPlan.Action != apiGamesSyncCreate || createPlan.Create == nil {
		t.Fatalf("expected create plan, got %+v", createPlan)
	}
	if createPlan.Create.CatalogCardCode != "MLBB" || createPlan.Create.Provider != "apigames" {
		t.Fatalf("unexpected create product: %+v", createPlan.Create)
	}

	existing := &models.Product{CatalogCardCode: "OLD"}
	updatePlan := planApiGamesProduct(snapshot, validCatalogs, existing)
	if updatePlan.Action != apiGamesSyncUpdate {
		t.Fatalf("expected update plan, got %+v", updatePlan)
	}
	if updatePlan.Updates["catalog_cardcode"] != "MLBB" {
		t.Fatalf("expected canonical catalog update, got %+v", updatePlan.Updates)
	}
	if _, ok := updatePlan.Updates["product_group_id"]; !ok {
		t.Fatal("catalog move must detach old product group")
	}
}

func TestApiGamesUnknownCatalogPlansPendingWithoutProduct(t *testing.T) {
	snapshot := apiGamesSnapshotForTest()
	snapshot.CatalogCardCode = "UNKN"

	plan := planApiGamesProduct(snapshot, map[string]bool{"MLBB": true}, nil)
	if plan.Action != apiGamesSyncPending || plan.Pending == nil {
		t.Fatalf("expected pending plan, got %+v", plan)
	}
	if plan.Create != nil || len(plan.Updates) != 0 {
		t.Fatalf("unknown catalog must not create/update Product: %+v", plan)
	}
	if plan.Pending.Provider != "apigames" || plan.Pending.RawSKU != snapshot.SKU {
		t.Fatalf("unexpected pending row: %+v", plan.Pending)
	}
}

func TestApiGamesDoesNotMoveExistingProductToInvalidCatalog(t *testing.T) {
	snapshot := apiGamesSnapshotForTest()
	snapshot.CatalogCardCode = "UNKN"
	existing := &models.Product{CatalogCardCode: "MLBB", IsActive: true}

	plan := planApiGamesProduct(snapshot, map[string]bool{"MLBB": true}, existing)
	if plan.Action != apiGamesSyncPending {
		t.Fatalf("expected pending plan, got %+v", plan)
	}
	if len(plan.Updates) != 0 || plan.Create != nil {
		t.Fatalf("existing Product must remain untouched: %+v", plan)
	}
	if existing.CatalogCardCode != "MLBB" || !existing.IsActive {
		t.Fatalf("planner mutated existing Product: %+v", existing)
	}
}

func TestFetchApiGamesSnapshotUsesInjectedHTTPServer(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("merchant") != "merchant-1" {
			t.Fatalf("unexpected merchant query: %s", r.URL.RawQuery)
		}
		if r.URL.Query().Get("signature") == "" {
			t.Fatal("signature query is required")
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"data": []map[string]interface{}{{
				"product_id":   "SKU-1",
				"brand":        "Mobile Legends",
				"product_name": "86 Diamonds",
				"status":       "tersedia",
			}},
		})
	}))
	defer server.Close()

	data, err := fetchApiGamesSnapshot(server.Client(), server.URL, "merchant-1", "secret-1")
	if err != nil {
		t.Fatalf("unexpected fetch error: %v", err)
	}
	if len(data) != 1 {
		t.Fatalf("expected one product, got %d", len(data))
	}
}

func TestDeleteCatalogReturnsConflictWhenReferenced(t *testing.T) {
	originalDelete := deleteCatalogByCardCode
	deleteCatalogByCardCode = func(string) error { return errCatalogStillReferenced }
	t.Cleanup(func() { deleteCatalogByCardCode = originalDelete })

	app := fiber.New()
	app.Delete("/catalogs/:id", DeleteCatalog)
	request := httptest.NewRequest("DELETE", "/catalogs/MLBB", nil)

	response, err := app.Test(request)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if response.StatusCode != fiber.StatusConflict {
		t.Fatalf("expected 409, got %d", response.StatusCode)
	}
}

func TestDeleteCatalogStillReturnsNotFound(t *testing.T) {
	originalDelete := deleteCatalogByCardCode
	deleteCatalogByCardCode = func(string) error { return gorm.ErrRecordNotFound }
	t.Cleanup(func() { deleteCatalogByCardCode = originalDelete })

	app := fiber.New()
	app.Delete("/catalogs/:id", DeleteCatalog)
	request := httptest.NewRequest("DELETE", "/catalogs/MISSING", nil)

	response, err := app.Test(request)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if response.StatusCode != fiber.StatusNotFound {
		t.Fatalf("expected 404, got %d", response.StatusCode)
	}
}

func TestDeleteCatalogReturnsServerErrorForUnexpectedFailure(t *testing.T) {
	originalDelete := deleteCatalogByCardCode
	deleteCatalogByCardCode = func(string) error { return errors.New("database unavailable") }
	t.Cleanup(func() { deleteCatalogByCardCode = originalDelete })

	app := fiber.New()
	app.Delete("/catalogs/:id", DeleteCatalog)
	request := httptest.NewRequest("DELETE", "/catalogs/MLBB", strings.NewReader(""))

	response, err := app.Test(request)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if response.StatusCode != fiber.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", response.StatusCode)
	}
}
