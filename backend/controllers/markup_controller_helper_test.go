package controllers

import (
	"encoding/json"
	"testing"
)

func TestParseNullableMarkupPercent(t *testing.T) {
	tests := []struct {
		name        string
		raw         json.RawMessage
		wantPresent bool
		wantNil     bool
		wantValue   float64
		wantError   bool
	}{
		{name: "omitted", wantNil: true},
		{name: "null", raw: json.RawMessage(`null`), wantPresent: true, wantNil: true},
		{name: "zero", raw: json.RawMessage(`0`), wantPresent: true, wantValue: 0},
		{name: "decimal", raw: json.RawMessage(`2.5`), wantPresent: true, wantValue: 2.5},
		{name: "one hundred", raw: json.RawMessage(`100`), wantPresent: true, wantValue: 100},
		{name: "negative", raw: json.RawMessage(`-1`), wantPresent: true, wantError: true},
		{name: "above one hundred", raw: json.RawMessage(`101`), wantPresent: true, wantError: true},
		{name: "numeric string", raw: json.RawMessage(`"2.5"`), wantPresent: true, wantError: true},
		{name: "boolean", raw: json.RawMessage(`true`), wantPresent: true, wantError: true},
		{name: "object", raw: json.RawMessage(`{}`), wantPresent: true, wantError: true},
		{name: "array", raw: json.RawMessage(`[]`), wantPresent: true, wantError: true},
		{name: "trailing JSON", raw: json.RawMessage(`2.5 3`), wantPresent: true, wantError: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			value, present, err := parseNullableMarkupPercent(test.raw)
			if present != test.wantPresent {
				t.Fatalf("present = %v, want %v", present, test.wantPresent)
			}
			if (err != nil) != test.wantError {
				t.Fatalf("error = %v, wantError %v", err, test.wantError)
			}
			if test.wantError {
				return
			}
			if test.wantNil {
				if value != nil {
					t.Fatalf("value = %v, want nil", *value)
				}
				return
			}
			if value == nil || *value != test.wantValue {
				t.Fatalf("value = %v, want %v", value, test.wantValue)
			}
		})
	}
}
