package models

import (
	"reflect"
	"strings"
	"testing"
)

func requireGormTagContains(t *testing.T, model reflect.Type, fieldName string, fragments ...string) {
	t.Helper()
	field, ok := model.FieldByName(fieldName)
	if !ok {
		t.Fatalf("field %s tidak ditemukan", fieldName)
	}

	tag := field.Tag.Get("gorm")
	for _, fragment := range fragments {
		if !strings.Contains(tag, fragment) {
			t.Fatalf("gorm tag %s.%s harus mengandung %q, got %q", model.Name(), fieldName, fragment, tag)
		}
	}
}

func TestCatalogUsesIDAsPrimaryKey(t *testing.T) {
	catalogType := reflect.TypeOf(Catalog{})
	requireGormTagContains(t, catalogType, "ID", "primaryKey")

	cardCode, ok := catalogType.FieldByName("CardCode")
	if !ok {
		t.Fatal("CardCode tidak ditemukan")
	}
	if strings.Contains(cardCode.Tag.Get("gorm"), "primaryKey") {
		t.Fatal("CardCode tidak boleh menjadi primary key")
	}
}

func TestCatalogCardCodeRemainsUniqueBusinessKey(t *testing.T) {
	requireGormTagContains(
		t,
		reflect.TypeOf(Catalog{}),
		"CardCode",
		"column:card_code",
		"not null",
		"uniqueIndex:idx_catalogs_card_code_reference",
	)
}

func TestCatalogProductRelationUsesCardCode(t *testing.T) {
	requireGormTagContains(
		t,
		reflect.TypeOf(Catalog{}),
		"Products",
		"foreignKey:CatalogCardCode",
		"references:CardCode",
		"OnUpdate:CASCADE",
		"OnDelete:RESTRICT",
	)
	requireGormTagContains(
		t,
		reflect.TypeOf(Product{}),
		"Catalog",
		"foreignKey:CatalogCardCode",
		"references:CardCode",
		"OnDelete:RESTRICT",
	)
}

func TestCatalogProductGroupRelationUsesCardCode(t *testing.T) {
	requireGormTagContains(
		t,
		reflect.TypeOf(Catalog{}),
		"ProductGroups",
		"foreignKey:CatalogCardCode",
		"references:CardCode",
		"OnUpdate:CASCADE",
		"OnDelete:RESTRICT",
	)
	requireGormTagContains(
		t,
		reflect.TypeOf(ProductGroup{}),
		"Catalog",
		"foreignKey:CatalogCardCode",
		"references:CardCode",
		"OnDelete:RESTRICT",
	)
}

func TestCanonicalCatalogReferenceColumnsAreRequired(t *testing.T) {
	requireGormTagContains(
		t,
		reflect.TypeOf(Product{}),
		"CatalogCardCode",
		"column:catalog_cardcode",
		"not null",
	)
	requireGormTagContains(
		t,
		reflect.TypeOf(ProductGroup{}),
		"CatalogCardCode",
		"column:catalog_cardcode",
		"not null",
	)
}
