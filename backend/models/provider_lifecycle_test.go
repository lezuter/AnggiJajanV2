package models

import (
	"reflect"
	"strings"
	"testing"
)

func TestProductProviderLifecycleSchema(t *testing.T) {
	productType := reflect.TypeOf(Product{})
	removed, ok := productType.FieldByName("ProviderRemoved")
	if !ok {
		t.Fatal("Product.ProviderRemoved field is missing")
	}
	for _, fragment := range []string{"column:provider_removed", "not null", "default:false", "index"} {
		if !strings.Contains(removed.Tag.Get("gorm"), fragment) {
			t.Fatalf("ProviderRemoved tag missing %q: %q", fragment, removed.Tag.Get("gorm"))
		}
	}
	lastSeen, ok := productType.FieldByName("ProviderLastSeenAt")
	if !ok {
		t.Fatal("Product.ProviderLastSeenAt field is missing")
	}
	if !strings.Contains(lastSeen.Tag.Get("gorm"), "column:provider_last_seen_at") {
		t.Fatalf("unexpected ProviderLastSeenAt tag: %q", lastSeen.Tag.Get("gorm"))
	}
	removedAt, ok := productType.FieldByName("ProviderRemovedAt")
	if !ok {
		t.Fatal("Product.ProviderRemovedAt field is missing")
	}
	for _, fragment := range []string{"column:provider_removed_at", "index"} {
		if !strings.Contains(removedAt.Tag.Get("gorm"), fragment) {
			t.Fatalf("ProviderRemovedAt tag missing %q: %q", fragment, removedAt.Tag.Get("gorm"))
		}
	}
}
