package controllers

import (
	"errors"
	"time"

	"testing"

	"github.com/derry/anggijajan-v2-backend/models"
)

func TestDigiflazzPricelistSignatureUsesPricelistSuffix(t *testing.T) {
	got := buildDigiflazzPriceListSignature("user", "secret")
	want := GenerateMD5("user" + "secret" + "pricelist")
	if got != want {
		t.Fatalf("unexpected signature: got %s want %s", got, want)
	}
	if got == GenerateMD5("user"+"secret"+"depo") {
		t.Fatal("pricelist signature must not use depo suffix")
	}
}

func TestDigiflazzUnlimitedStockBecomesMinusOne(t *testing.T) {
	snapshot, ok := parseDigiflazzProduct(digiflazzPriceListProduct{
		BuyerSKUCode:        " SKU-1 ",
		Brand:               "Brand",
		ProductName:         "Product",
		Price:               1000,
		BuyerProductStatus:  true,
		SellerProductStatus: true,
		UnlimitedStock:      true,
		Stock:               0,
	})
	if !ok || snapshot.Stock != -1 {
		t.Fatalf("expected unlimited stock -1, got ok=%v stock=%d", ok, snapshot.Stock)
	}
}

func TestDigiflazzExistingProductKeepsAdminMapping(t *testing.T) {
	groupID := uint(7)
	existing := &models.Product{
		CatalogCardCode: "DFORCE",
		ProductGroupID:  &groupID,
		SortOrder:       9,
		Provider:        "digiflazz",
	}
	snapshot := digiflazzProductSnapshot{
		SKU:             "pre29333506",
		CatalogCardCode: "DELT",
		Name:            "Delta Force 18 Delta Coins",
		Price:           3759,
		Stock:           -1,
		IsActive:        true,
	}
	plan := planDigiflazzProduct(snapshot, map[string]bool{"DFORCE": true}, existing)
	if plan.Action != digiflazzSyncUpdate {
		t.Fatalf("expected update plan, got %d", plan.Action)
	}
	if _, changesCatalog := plan.Updates["catalog_cardcode"]; changesCatalog {
		t.Fatal("existing product catalog must not be overwritten by generated provider mapping")
	}
	if _, detachesGroup := plan.Updates["product_group_id"]; detachesGroup {
		t.Fatal("existing product group must not be detached")
	}
	if plan.Updates["stock"] != -1 || plan.Updates["price"] != float64(3759) {
		t.Fatalf("provider-owned inventory fields were not refreshed: %#v", plan.Updates)
	}
}

func TestDigiflazzUnknownNewSKUIsPending(t *testing.T) {
	plan := planDigiflazzProduct(
		digiflazzProductSnapshot{SKU: "NEW", Brand: "Unknown", CatalogCardCode: "UNKN"},
		map[string]bool{"DFORCE": true},
		nil,
	)
	if plan.Action != digiflazzSyncPending || plan.Pending == nil {
		t.Fatalf("expected pending plan, got %#v", plan)
	}
}

func TestEmptyDigiflazzSnapshotCannotResetInventory(t *testing.T) {
	_, _, _, err := syncDigiflazzSnapshot(nil, nil)
	if err == nil {
		t.Fatal("empty snapshot must be rejected before database mutation")
	}
}

func TestPendingApprovalIsIdempotentForExistingSKU(t *testing.T) {
	existing := &models.Product{}
	existing.ID = 62
	plan, err := planPendingProductApproval(
		models.PendingProduct{RawSKU: "pre29333506", Provider: "digiflazz"},
		"DFORCE",
		existing,
	)
	if err != nil {
		t.Fatal(err)
	}
	if plan.Create != nil || plan.ExistingProductID != 62 {
		t.Fatalf("existing SKU must be reused, got %#v", plan)
	}
}

func TestPendingApprovalCreatesDisabledPlaceholderOnlyForNewSKU(t *testing.T) {
	plan, err := planPendingProductApproval(
		models.PendingProduct{RawSKU: "NEW-SKU", RawName: "New", Provider: "digiflazz"},
		"DFORCE",
		nil,
	)
	if err != nil {
		t.Fatal(err)
	}
	if plan.Create == nil {
		t.Fatal("new SKU should create a placeholder product")
	}
	if plan.Create.Stock != 0 || plan.Create.IsActive || plan.Create.AdminEnabled {
		t.Fatalf("placeholder must remain disabled until provider sync: %#v", plan.Create)
	}
}

func TestMissingDigiflazzProductsAreMarkedOfflineAndStockCleared(t *testing.T) {
	updates := missingDigiflazzProductUpdates()

	isActive, ok := updates["is_active"].(bool)
	if !ok || isActive {
		t.Fatalf("expected is_active=false, got %#v", updates["is_active"])
	}

	stock, ok := updates["stock"].(int)
	if !ok || stock != 0 {
		t.Fatalf("expected stock=0, got %#v", updates["stock"])
	}
}

func TestPresentDigiflazzProductClearsProviderRemovedState(t *testing.T) {
	existing := &models.Product{ProviderRemoved: true}
	plan := planDigiflazzProduct(
		digiflazzProductSnapshot{SKU: "ACTIVE", Name: "Active", Price: 1000, Stock: -1, IsActive: true},
		map[string]bool{"GAME": true},
		existing,
	)
	if plan.Action != digiflazzSyncUpdate {
		t.Fatalf("expected update plan, got %d", plan.Action)
	}
	if removed, ok := plan.Updates["provider_removed"].(bool); !ok || removed {
		t.Fatalf("present SKU must clear provider_removed, got %#v", plan.Updates["provider_removed"])
	}
	if _, ok := plan.Updates["provider_last_seen_at"].(time.Time); !ok {
		t.Fatalf("present SKU must update last seen, got %#v", plan.Updates["provider_last_seen_at"])
	}
}

func TestMissingDigiflazzProductIsMarkedProviderRemoved(t *testing.T) {
	updates := missingDigiflazzProductUpdates()
	if removed, ok := updates["provider_removed"].(bool); !ok || !removed {
		t.Fatalf("missing SKU must set provider_removed=true, got %#v", updates["provider_removed"])
	}
	if active, ok := updates["is_active"].(bool); !ok || active {
		t.Fatalf("missing SKU must be offline, got %#v", updates["is_active"])
	}
	if stock, ok := updates["stock"].(int); !ok || stock != 0 {
		t.Fatalf("missing SKU must have stock 0, got %#v", updates["stock"])
	}
}

func TestProviderRemovedProductPermanentDeleteRules(t *testing.T) {
	if err := validateProviderProductPermanentDelete(false, 0); !errors.Is(err, errProviderProductStillPresent) {
		t.Fatalf("present provider product must be rejected, got %v", err)
	}
	if err := validateProviderProductPermanentDelete(true, 1); !errors.Is(err, errProviderProductHasHistory) {
		t.Fatalf("product with transactions must be rejected, got %v", err)
	}
	if err := validateProviderProductPermanentDelete(true, 0); err != nil {
		t.Fatalf("removed product without history should be deletable: %v", err)
	}
}
