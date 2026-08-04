package controllers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"strconv"
)

const nullableMarkupPercentError = "markup_percent harus berupa angka 0 sampai 100 atau null"

func parseNullableMarkupPercent(raw json.RawMessage) (value *float64, present bool, err error) {
	if len(bytes.TrimSpace(raw)) == 0 {
		return nil, false, nil
	}

	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()

	var decoded interface{}
	if err := decoder.Decode(&decoded); err != nil {
		return nil, true, fmt.Errorf("%s", nullableMarkupPercentError)
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		return nil, true, fmt.Errorf("%s", nullableMarkupPercentError)
	}
	if decoded == nil {
		return nil, true, nil
	}

	number, ok := decoded.(json.Number)
	if !ok {
		return nil, true, fmt.Errorf("%s", nullableMarkupPercentError)
	}
	markupPercent, parseErr := strconv.ParseFloat(number.String(), 64)
	if parseErr != nil || math.IsNaN(markupPercent) || math.IsInf(markupPercent, 0) || markupPercent < 0 || markupPercent > 100 {
		return nil, true, fmt.Errorf("%s", nullableMarkupPercentError)
	}

	return &markupPercent, true, nil
}
