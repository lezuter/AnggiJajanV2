package controllers

import (
	"errors"
	"strconv"
	"strings"

	"github.com/derry/anggijajan-v2-backend/database"
	"github.com/derry/anggijajan-v2-backend/models"
	"gorm.io/gorm"
)

// paymentSettingValue reads optional payment configuration without treating a
// missing row as an application error. Callers receive their own fallback.
func paymentSettingValue(key, fallback string) string {
	if database.DB == nil {
		return fallback
	}

	var setting models.Setting
	err := database.DB.Where("key = ?", key).First(&setting).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fallback
		}
		return fallback
	}

	if value := strings.TrimSpace(setting.Value); value != "" {
		return value
	}
	return fallback
}

func paymentSettingFloat(key string, fallback float64) float64 {
	value := paymentSettingValue(key, "")
	if value == "" {
		return fallback
	}

	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil || parsed < 0 {
		return fallback
	}
	return parsed
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func isPaymentMethodAllowed(
	grossProfit float64,
	merchantFee float64,
	minimumNetProfit float64,
	minimumRetentionPercent float64,
) bool {
	if grossProfit <= 0 {
		return false
	}

	netProfit := grossProfit - merchantFee
	if netProfit <= 0 {
		return false
	}

	retentionPercent := netProfit / grossProfit * 100
	return netProfit >= minimumNetProfit ||
		retentionPercent >= minimumRetentionPercent
}
