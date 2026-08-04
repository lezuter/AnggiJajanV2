package database

import (
	"strings"
	"testing"
)

func TestProductCodeIntegrityAuditRejectsInvalidData(t *testing.T) {
	if err := (productCodeIntegrityAudit{InvalidCodes: 1}).validate(); err == nil {
		t.Fatal("invalid product code must be rejected")
	}
	if err := (productCodeIntegrityAudit{DuplicateCodes: 1}).validate(); err == nil {
		t.Fatal("duplicate normalized product code must be rejected")
	}
	if err := (productCodeIntegrityAudit{}).validate(); err != nil {
		t.Fatalf("clean audit should pass: %v", err)
	}
}

func TestProductCodeIntegrityMigrationIsNormalizedAndIdempotent(t *testing.T) {
	statements := productCodeIntegrityStatements()
	if len(statements) != 2 {
		t.Fatalf("expected 2 statements, got %d", len(statements))
	}
	joined := strings.ToLower(strings.Join(statements, "\n"))
	for _, fragment := range []string{
		"alter column code set not null",
		"create unique index if not exists idx_products_code_normalized_unique",
		"lower(btrim(code))",
	} {
		if !strings.Contains(joined, fragment) {
			t.Fatalf("missing migration fragment %q", fragment)
		}
	}
}
