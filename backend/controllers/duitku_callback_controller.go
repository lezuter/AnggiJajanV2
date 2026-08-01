package controllers

import (
	"crypto/hmac"
	"errors"
	"fmt"
	"math"
	"os"
	"strconv"
	"strings"

	"github.com/derry/anggijajan-v2-backend/database"
	"github.com/derry/anggijajan-v2-backend/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	errDuitkuCallbackProviderMismatch  = errors.New("transaksi bukan milik payment provider Duitku")
	errDuitkuCallbackAmountMismatch    = errors.New("nominal callback tidak sesuai dengan transaksi")
	errDuitkuCallbackReferenceMismatch = errors.New("reference callback tidak sesuai dengan transaksi")
	errDuitkuCallbackMethodMismatch    = errors.New("metode pembayaran callback tidak sesuai dengan transaksi")
)

type duitkuCallbackPayload struct {
	MerchantCode    string
	AmountRaw       string
	Amount          int64
	MerchantOrderID string
	PaymentCode     string
	ResultCode      string
	Reference       string
	Signature       string
}

func parseDuitkuCallbackAmount(value string) (int64, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return 0, fmt.Errorf("amount kosong")
	}

	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil || parsed <= 0 {
		return 0, fmt.Errorf("amount tidak valid")
	}

	rounded := math.Round(parsed)
	if math.Abs(parsed-rounded) > 0.001 {
		return 0, fmt.Errorf("amount harus berupa rupiah tanpa pecahan")
	}

	return int64(rounded), nil
}

func isValidDuitkuCallbackSignature(
	merchantCode string,
	amountRaw string,
	merchantOrderID string,
	signature string,
	apiKey string,
) bool {
	merchantCode = strings.TrimSpace(merchantCode)
	amountRaw = strings.TrimSpace(amountRaw)
	merchantOrderID = strings.TrimSpace(merchantOrderID)
	signature = strings.ToLower(strings.TrimSpace(signature))
	apiKey = strings.TrimSpace(apiKey)

	if merchantCode == "" ||
		amountRaw == "" ||
		merchantOrderID == "" ||
		signature == "" ||
		apiKey == "" {
		return false
	}

	expected := duitkuHMACSHA256(
		merchantCode+amountRaw+merchantOrderID,
		apiKey,
	)

	return hmac.Equal(
		[]byte(strings.ToLower(expected)),
		[]byte(signature),
	)
}

func readDuitkuCallback(c *fiber.Ctx) (duitkuCallbackPayload, error) {
	amountRaw := strings.TrimSpace(c.FormValue("amount"))
	amount, err := parseDuitkuCallbackAmount(amountRaw)
	if err != nil {
		return duitkuCallbackPayload{}, err
	}

	payload := duitkuCallbackPayload{
		MerchantCode:    strings.TrimSpace(c.FormValue("merchantCode")),
		AmountRaw:       amountRaw,
		Amount:          amount,
		MerchantOrderID: strings.TrimSpace(c.FormValue("merchantOrderId")),
		PaymentCode:     strings.ToUpper(strings.TrimSpace(c.FormValue("paymentCode"))),
		ResultCode:      strings.TrimSpace(c.FormValue("resultCode")),
		Reference:       strings.TrimSpace(c.FormValue("reference")),
		Signature:       strings.TrimSpace(c.FormValue("signature")),
	}

	if payload.MerchantCode == "" ||
		payload.MerchantOrderID == "" ||
		payload.ResultCode == "" ||
		payload.Reference == "" ||
		payload.Signature == "" {
		return duitkuCallbackPayload{}, fmt.Errorf("parameter callback Duitku tidak lengkap")
	}

	switch payload.ResultCode {
	case "00", "01":
		return payload, nil
	default:
		return duitkuCallbackPayload{}, fmt.Errorf(
			"resultCode Duitku tidak dikenal: %s",
			payload.ResultCode,
		)
	}
}

func DuitkuCallbackHandler(c *fiber.Ctx) error {
	payload, err := readDuitkuCallback(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"reason":  err.Error(),
		})
	}

	merchantCode := strings.TrimSpace(os.Getenv("DUITKU_MERCHANT_CODE"))
	apiKey := strings.TrimSpace(os.Getenv("DUITKU_API_KEY"))
	if merchantCode == "" || apiKey == "" {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"reason":  "konfigurasi Duitku belum lengkap",
		})
	}

	if payload.MerchantCode != merchantCode {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"reason":  "merchant code tidak valid",
		})
	}

	if !isValidDuitkuCallbackSignature(
		payload.MerchantCode,
		payload.AmountRaw,
		payload.MerchantOrderID,
		payload.Signature,
		apiKey,
	) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"reason":  "invalid callback signature",
		})
	}

	var trx models.Transaction
	oldPaymentStatus := ""
	oldFulfillmentStatus := ""
	stateChanged := false
	shouldExecuteProvider := false

	err = database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.
			Clauses(clause.Locking{Strength: "UPDATE"}).
			Preload("Product").
			Where("invoice_id = ?", payload.MerchantOrderID).
			First(&trx).Error; err != nil {
			return err
		}

		if !strings.EqualFold(strings.TrimSpace(trx.PaymentProvider), "duitku") {
			return errDuitkuCallbackProviderMismatch
		}

		if int64(math.Round(trx.Amount)) != payload.Amount {
			return errDuitkuCallbackAmountMismatch
		}

		currentReference := firstNonEmpty(
			trx.PaymentReference,
			trx.Reference,
		)
		if currentReference != "" &&
			!strings.EqualFold(currentReference, payload.Reference) {
			return errDuitkuCallbackReferenceMismatch
		}

		if payload.PaymentCode != "" &&
			strings.TrimSpace(trx.PaymentMethod) != "" &&
			!strings.EqualFold(trx.PaymentMethod, payload.PaymentCode) {
			return errDuitkuCallbackMethodMismatch
		}

		oldPaymentStatus = strings.TrimSpace(trx.PaymentStatus)
		oldFulfillmentStatus = strings.TrimSpace(trx.FulfillmentStatus)

		if strings.TrimSpace(trx.PaymentReference) == "" {
			trx.PaymentReference = payload.Reference
			trx.Reference = payload.Reference
			stateChanged = true
		}

		switch payload.ResultCode {
		case "00":
			if trx.PaymentStatus != "PAID" {
				trx.PaymentStatus = "PAID"
				stateChanged = true
			}

			if !isFinalFulfillmentStatus(trx.FulfillmentStatus) &&
				trx.FulfillmentStatus != "PROCESSING" {
				trx.Status = "PENDING"
				trx.FulfillmentStatus = "READY"
				trx.ProviderStatus = "Payment Paid"
				trx.ErrorMessage = ""
				stateChanged = true
			}

			shouldExecuteProvider =
				!isFinalFulfillmentStatus(trx.FulfillmentStatus) &&
					trx.FulfillmentStatus != "PROCESSING" &&
					strings.TrimSpace(trx.ProviderRef) == ""

		case "01":
			// Callback gagal tidak boleh menurunkan transaksi yang sudah PAID
			// atau yang fulfillment-nya sudah berjalan/final.
			if trx.PaymentStatus == "PAID" ||
				trx.FulfillmentStatus == "PROCESSING" ||
				isFinalFulfillmentStatus(trx.FulfillmentStatus) ||
				strings.TrimSpace(trx.ProviderRef) != "" {
				break
			}

			trx.Status = "FAILED"
			trx.PaymentStatus = "FAILED"
			if strings.TrimSpace(trx.FulfillmentStatus) == "" {
				trx.FulfillmentStatus = "WAITING_PAYMENT"
			}
			trx.ProviderStatus = "Payment Failed"
			trx.ErrorMessage = "Pembayaran Duitku gagal"
			stateChanged = true
		}

		if !stateChanged {
			return nil
		}

		return tx.Save(&trx).Error
	})
	if err != nil {
		switch {
		case errors.Is(err, gorm.ErrRecordNotFound):
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"success": false,
				"reason":  "transaksi tidak ditemukan",
			})
		case errors.Is(err, errDuitkuCallbackProviderMismatch),
			errors.Is(err, errDuitkuCallbackAmountMismatch),
			errors.Is(err, errDuitkuCallbackReferenceMismatch),
			errors.Is(err, errDuitkuCallbackMethodMismatch):
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"reason":  err.Error(),
			})
		default:
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"reason":  "gagal memproses callback Duitku",
			})
		}
	}

	if stateChanged {
		action := "PAYMENT_CALLBACK_FAILED"
		description := "Callback Duitku mengubah pembayaran menjadi FAILED"
		if payload.ResultCode == "00" {
			action = "PAYMENT_CALLBACK_PAID"
			description = "Callback Duitku mengubah pembayaran menjadi PAID"
		}

		recordTransactionActivity(
			models.TransactionActivity{
				TransactionID: trx.ID,
				Action:        action,
				Description:   description,
				OldStatus:     oldPaymentStatus,
				NewStatus:     trx.PaymentStatus,
				IPAddress:     c.IP(),
				UserAgent:     string(c.Request().Header.UserAgent()),
			},
			strings.ToLower(action),
		)
	}

	if payload.ResultCode == "00" && shouldExecuteProvider {
		if _, err := executeProviderForTransaction(
			c,
			&trx,
			nil,
			oldFulfillmentStatus,
		); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"reason":  "pembayaran tersimpan, tetapi provider gagal dieksekusi",
			})
		}
	}

	// Duitku akan mengirim ulang callback ketika tidak menerima HTTP 200.
	return c.Status(fiber.StatusOK).SendString("OK")
}
