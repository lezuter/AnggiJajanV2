package database

import (
	"strings"
	"testing"
)

func TestCanonicalAuditRejectsOrphanProducts(t *testing.T) {
	err := (canonicalCatalogReferenceAudit{OrphanProducts: 1}).validate()
	if err == nil || !strings.Contains(err.Error(), "orphan products.catalog_cardcode") {
		t.Fatalf("expected orphan products error, got %v", err)
	}
}

func TestCanonicalAuditRejectsOrphanProductGroups(t *testing.T) {
	err := (canonicalCatalogReferenceAudit{OrphanProductGroups: 1}).validate()
	if err == nil || !strings.Contains(err.Error(), "orphan product_groups.catalog_cardcode") {
		t.Fatalf("expected orphan product groups error, got %v", err)
	}
}

func TestCanonicalForeignKeyMigrationIsIdempotentByConstruction(t *testing.T) {
	statements := canonicalCatalogForeignKeyStatements()
	if len(statements) != 2 {
		t.Fatalf("expected 2 FK statements, got %d", len(statements))
	}

	for pass := 0; pass < 2; pass++ {
		for _, statement := range statements {
			for _, required := range []string{
				"IF NOT EXISTS",
				"ON UPDATE CASCADE",
				"ON DELETE RESTRICT",
			} {
				if !strings.Contains(statement, required) {
					t.Fatalf("migration statement missing %q", required)
				}
			}
		}
	}

	if !strings.Contains(statements[0], "fk_product_groups_catalog_cardcode") {
		t.Fatal("product group FK name is not stable")
	}
	if !strings.Contains(statements[1], "fk_products_catalog_cardcode") {
		t.Fatal("product FK name is not stable")
	}
}

func TestPendingProductProviderSKUIndexIsUniqueAndIdempotent(t *testing.T) {
	statement := `CREATE UNIQUE INDEX IF NOT EXISTS uidx_pending_products_provider_raw_sku`
	for _, required := range []string{"UNIQUE INDEX", "IF NOT EXISTS", "provider", "raw_sku"} {
		if !strings.Contains(statement, required) {
			t.Fatalf("pending product index statement missing %q", required)
		}
	}
}

func TestCanonicalChildColumnsAreSetNotNull(t *testing.T) {
	statements := canonicalCatalogNotNullStatements()
	if len(statements) != 2 {
		t.Fatalf("expected 2 NOT NULL statements, got %d", len(statements))
	}

	required := map[string]string{
		"product_groups": "ALTER COLUMN catalog_cardcode SET NOT NULL",
		"products":       "ALTER COLUMN catalog_cardcode SET NOT NULL",
	}
	for table, fragment := range required {
		found := false
		for _, statement := range statements {
			if strings.Contains(statement, "ALTER TABLE "+table) &&
				strings.Contains(statement, fragment) {
				found = true
				break
			}
		}
		if !found {
			t.Fatalf("missing NOT NULL migration for %s", table)
		}
	}

	for pass := 0; pass < 2; pass++ {
		for _, statement := range statements {
			if !strings.Contains(statement, "SET NOT NULL") {
				t.Fatalf("pass %d: invalid NOT NULL statement %q", pass, statement)
			}
		}
	}
}
