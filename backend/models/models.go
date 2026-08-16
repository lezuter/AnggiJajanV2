package models

import (
	"math"
	"time"

	"github.com/derry/anggijajan-v2-backend/payments"

	"gorm.io/gorm"
)

// User Model
type User struct {
	gorm.Model
	Name     string `json:"name"`
	Email    string `json:"email" gorm:"unique"`
	Password string `json:"-"`
	Role     string `json:"role"`
}

// Model Catalog (Card Game/Brand)
type Catalog struct {
	ID            uint     `gorm:"primaryKey" json:"id"`
	CardCode      string   `gorm:"column:card_code;size:20;not null;uniqueIndex:idx_catalogs_card_code_reference" json:"cardcode"`
	Name          string   `json:"name"`
	Slug          string   `gorm:"uniqueIndex" json:"slug"`
	ShortName     string   `json:"short_name"`
	Description   string   `json:"description"`
	ImageURL      string   `json:"image_url"`
	BannerURL     string   `json:"banner_url"`
	Publisher     string   `json:"publisher"`
	Region        string   `json:"region"`
	MarkupPercent *float64 `json:"markup_percent" gorm:"column:markup_percent"`

	Category  string `gorm:"index" json:"category"`
	IsPopular bool   `gorm:"default:false;index" json:"is_popular"`
	SortOrder int    `gorm:"default:0;index" json:"sort_order"`
	IsPublic  bool   `gorm:"default:true;index" json:"is_public"`

	IsActive      bool           `gorm:"default:true" json:"is_active"`
	CheckIDCode   string         `json:"check_id_code"`
	RequiresZone  bool           `json:"requires_zone" gorm:"default:false"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
	ProductGroups []ProductGroup `gorm:"foreignKey:CatalogCardCode;references:CardCode;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;" json:"product_groups"`
	Products      []Product      `gorm:"foreignKey:CatalogCardCode;references:CardCode;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;" json:"products"`

	// --- [BARU] KONFIGURASI INPUT TARGET AKUN DINAMIS ---
	TargetType          string `json:"target_type" gorm:"default:'SINGLE_ID'"`     // SINGLE_ID | DUAL_INPUT | SERVER_DROPDOWN | RIOT_ID | GENERIC
	TargetLabel         string `json:"target_label" gorm:"default:'User ID'"`      // Contoh: "User ID", "UID", "Player ID", "Riot ID"
	TargetSecondaryLabel string `json:"target_secondary_label" gorm:"default:'Zone ID'"` // Label untuk input secondary (mis. "Zone ID", "Server"). Tidak digunakan oleh SINGLE_ID, RIOT_ID, GENERIC kecuali konfigurasi memang requires.
	TargetServerOptions string `json:"target_server_options"`                      // Contoh JSON/String: "Asia, America, Europe, TW_HK_MO"
}

// ProductGroup is an admin-managed section inside a catalog. Provider syncs
// must never decide or overwrite this relationship.
type ProductGroup struct {
	gorm.Model
	Name            string    `json:"name" gorm:"size:100;not null;check:chk_product_group_name_nonempty,char_length(btrim(name)) > 0"`
	CatalogCardCode string    `json:"catalog_cardcode" gorm:"column:catalog_cardcode;size:20;not null;index"`
	Catalog         Catalog   `json:"-" gorm:"foreignKey:CatalogCardCode;references:CardCode;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
	SortOrder       int       `json:"sort_order" gorm:"not null;default:0;index;check:chk_product_group_sort_order_nonnegative,sort_order >= 0"`
	IsActive        bool      `json:"is_active" gorm:"not null;default:true;index"`
	MarkupPercent   *float64  `json:"markup_percent" gorm:"column:markup_percent"`
	Products        []Product `json:"products" gorm:"foreignKey:ProductGroupID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

// Product Model
type Product struct {
	gorm.Model
	Name               string        `json:"name"`
	Code               string        `gorm:"not null;index" json:"code"`
	Price              float64       `json:"price"`
	SellingPrice       float64       `json:"selling_price" gorm:"-"`
	StartingPrice      float64       `json:"starting_price" gorm:"-"`
	StartingMethod     string        `json:"starting_payment_method" gorm:"-"`
	OriginalPrice      *float64      `json:"original_price" gorm:"column:original_price"`
	Stock              int           `json:"stock" gorm:"default:0"`
	IsActive           bool          `json:"is_active" gorm:"default:true;index"` // Status ketersediaan dari provider.
	AdminEnabled       bool          `json:"admin_enabled" gorm:"default:true;index"`
	IsArchived         bool          `json:"is_archived" gorm:"default:false;index"` // Kolom kompatibilitas; tidak digunakan oleh workflow admin.
	ImageURL           string        `json:"image_url"`
	CatalogCardCode    string        `json:"catalog_cardcode" gorm:"column:catalog_cardcode;not null;index"`
	Catalog            Catalog       `gorm:"foreignKey:CatalogCardCode;references:CardCode;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;" json:"catalog"`
	ProductGroupID     *uint         `json:"product_group_id" gorm:"index"`
	ProductGroup       *ProductGroup `json:"product_group,omitempty" gorm:"foreignKey:ProductGroupID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	SortOrder          int           `json:"sort_order" gorm:"not null;default:0;index;check:chk_product_sort_order_nonnegative,sort_order >= 0"`
	Provider           string        `json:"provider" gorm:"default:'digiflazz';index"`
	ProviderRemoved    bool          `gorm:"column:provider_removed;not null;default:false;index" json:"provider_removed"`
	ProviderLastSeenAt *time.Time    `gorm:"column:provider_last_seen_at;index" json:"provider_last_seen_at,omitempty"`
	ProviderRemovedAt  *time.Time    `gorm:"column:provider_removed_at;index" json:"provider_removed_at,omitempty"`
}

// ProviderSyncState persists provider coordination metadata so cooldowns
// survive application restarts. Running is reset during backend startup.
type ProviderSyncState struct {
	Provider       string     `json:"provider" gorm:"primaryKey;size:40"`
	Running        bool       `json:"running" gorm:"not null;default:false"`
	Source         string     `json:"source" gorm:"size:20;not null;default:''"`
	LastStartedAt  *time.Time `json:"last_started_at"`
	LastFinishedAt *time.Time `json:"last_finished_at"`
	LastSuccessAt  *time.Time `json:"last_success_at"`
	LastError      string     `json:"last_error,omitempty" gorm:"type:text"`
	CooldownUntil  *time.Time `json:"cooldown_until"`
}

const StorefrontMarkupRate = 0.05

// ResolveStorefrontMarkupRate resolves human-readable percentage overrides to
// a decimal rate. Invalid persisted values fall through to the next level.
func ResolveStorefrontMarkupRate(catalogMarkup, groupMarkup *float64) float64 {
	if isValidStorefrontMarkupPercent(groupMarkup) {
		return *groupMarkup / 100
	}
	if isValidStorefrontMarkupPercent(catalogMarkup) {
		return *catalogMarkup / 100
	}
	return StorefrontMarkupRate
}

func isValidStorefrontMarkupPercent(markup *float64) bool {
	return markup != nil &&
		!math.IsNaN(*markup) &&
		!math.IsInf(*markup, 0) &&
		*markup >= 0 &&
		*markup <= 100
}

// CalculateSellingPriceWithMarkup calculates a non-persisted selling price
// from rounded provider capital and an already-resolved decimal markup rate.
func CalculateSellingPriceWithMarkup(capital, effectiveMarkupRate float64) float64 {
	roundedCapital := math.Round(capital)
	return math.Round(roundedCapital * (1 + effectiveMarkupRate))
}

// CalculateSellingPrice is the single source of truth for the internal target
// net. Price remains provider capital and SellingPrice is never persisted.
func CalculateSellingPrice(capital float64) float64 {
	return CalculateSellingPriceWithMarkup(capital, StorefrontMarkupRate)
}

// ApplyStorefrontPricing exposes hierarchy-aware, non-persisted public pricing.
func (product *Product) ApplyStorefrontPricing(catalogMarkup, groupMarkup *float64) {
	effectiveMarkupRate := ResolveStorefrontMarkupRate(catalogMarkup, groupMarkup)
	product.SellingPrice = CalculateSellingPriceWithMarkup(product.Price, effectiveMarkupRate)
	product.StartingMethod = "QRIS"

	config, err := payments.LoadMidtransConfig()
	if err != nil {
		product.StartingPrice = product.SellingPrice
		return
	}
	product.StartingPrice, err = config.StartingPrice(product.SellingPrice)
	if err != nil {
		product.StartingPrice = product.SellingPrice
	}
}

// AfterFind exposes both the internal target and the QRIS-inclusive public
// starting price without adding a persisted Product column or a network call.
func (product *Product) AfterFind(_ *gorm.DB) error {
	product.ApplyStorefrontPricing(nil, nil)
	return nil
}

// Banner Model
type Banner struct {
	gorm.Model
	ImageURL  string     `json:"image_url"`
	TargetURL string     `json:"target_url"`
	IsActive  bool       `json:"is_active" gorm:"default:true;index"`
	ExpiresAt *time.Time `json:"expires_at"`
}

// ==========================================
// 🔥 1. GLOBAL ACTIVITY LOG (AUDIT SYSTEM)
// ==========================================
type ActivityLog struct {
	gorm.Model
	UserID      *uint  `json:"user_id" gorm:"index"` // Nullable jika aksi dari System/Cron
	User        *User  `json:"user" gorm:"foreignKey:UserID"`
	Action      string `json:"action"` // Contoh: LOGIN, UPDATE_MARGIN, DELETE_BANNER
	Description string `json:"description"`
	IPAddress   string `json:"ip_address"`
	UserAgent   string `json:"user_agent"`
}

// ==========================================
// 🔥 2. TRANSACTION ACTIVITY (AUDIT TRANSAKSI)
// ==========================================
type TransactionActivity struct {
	gorm.Model
	TransactionID uint   `json:"transaction_id" gorm:"index"`
	UserID        *uint  `json:"user_id" gorm:"index"` // FK ke User
	User          *User  `json:"user" gorm:"foreignKey:UserID"`
	Action        string `json:"action"` // Contoh: MANUAL_INJECT, RETRY, STATUS_CHANGE
	Description   string `json:"description"`
	OldStatus     string `json:"old_status"`
	NewStatus     string `json:"new_status"`
	IPAddress     string `json:"ip_address"`
	UserAgent     string `json:"user_agent"`
}

// ==========================================
// 🔥 3. TRANSACTION MODEL (ENTERPRISE VER.)
// ==========================================
type Transaction struct {
	gorm.Model
	InvoiceID       string  `json:"invoice_id" gorm:"unique"`
	ProductID       uint    `json:"product_id"`
	Quantity        int     `json:"quantity" gorm:"not null;default:1"`
	Product         Product `gorm:"foreignKey:ProductID;references:ID"`
	Target          string  `json:"target" gorm:"column:target"`
	TargetSecondary string  `json:"target_secondary"`
	TargetType      string  `json:"target_type"`

	Amount  float64 `json:"amount"`  // Harga Jual
	Capital float64 `json:"capital"` // Modal (Dari Digiflazz)
	Profit  float64 `json:"profit"`  // Untung (Amount - Capital)
	// ProductAmount adalah target net internal. StartingPrice/Amount adalah harga
	// publik yang dibayar customer; fee payment disubsidi merchant.
	ProductAmount     float64 `json:"product_amount" gorm:"not null;default:0"`
	StartingPrice     float64 `json:"starting_price" gorm:"not null;default:0"`
	CustomerSurcharge float64 `json:"customer_surcharge" gorm:"not null;default:0"`

	Status            string `json:"status" gorm:"index"`
	PaymentStatus     string `json:"payment_status" gorm:"index"`
	FulfillmentStatus string `json:"fulfillment_status" gorm:"index"`
	ProviderStatus    string `json:"provider_status"`
	SerialNumber      string `json:"serial_number"`
	ErrorMessage      string `json:"error_message"`
	ErrorCode         string `json:"error_code"`

	// --- PAYMENT SNAPSHOT ---
	// Dipisahkan dari Provider* karena Provider* khusus fulfillment/top-up
	// seperti Digiflazz, ApiGames, atau manual.
	PaymentProvider       string     `json:"payment_provider" gorm:"size:30;index"`
	PaymentQuoteKey       string     `json:"payment_quote_key" gorm:"size:120;index"`
	PaymentMethod         string     `json:"payment_method"`
	ActualPaymentMethod   string     `json:"actual_payment_method" gorm:"size:40;index"`
	PaymentURL            string     `json:"payment_url"`
	PaymentReference      string     `json:"payment_reference" gorm:"size:100;index"`
	PaymentFeeBearer      string     `json:"payment_fee_bearer" gorm:"size:20;index"`
	PaymentFeeEstimated   float64    `json:"payment_fee_estimated" gorm:"not null;default:0"`
	PaymentFeeActual      *float64   `json:"payment_fee_actual"`
	NetProfitEstimated    float64    `json:"net_profit_estimated" gorm:"not null;default:0"`
	NetProfitActual       *float64   `json:"net_profit_actual"`
	MidtransTransactionID string     `json:"midtrans_transaction_id" gorm:"size:100;index"`
	SnapToken             string     `json:"-" gorm:"type:text"`
	ExpiryTime            *time.Time `gorm:"index" json:"expiry_time,omitempty"`

	// Legacy/external reference. Dipertahankan sementara agar flow lama tidak rusak.
	Reference string `json:"reference"`

	// --- PROVIDER SNAPSHOT (Audit Multi-Provider) ---
	Provider     string `json:"provider" gorm:"index"`     // digiflazz / apigames / manual
	ProviderSKU  string `json:"provider_sku" gorm:"index"` // SKU yang ditembak saat transaksi
	ProviderRef  string `json:"provider_ref" gorm:"index"` // ref_id/trx_id dari provider
	ProviderName string `json:"provider_name"`             // display: DIGIFLAZZ / APIGAMES / MANUAL

	// --- [BARU] OPERATIONAL & AUDIT TRAIL ---
	CreatedVia  string `json:"created_via" gorm:"default:'WEB';index"` // ENUM: WEB, ADMIN, API, SYSTEM, CRON, IMPORT
	CreatedByID *uint  `json:"created_by_id" gorm:"index"`             // FK ke Users (NULL = Customer Web)
	CreatedBy   *User  `json:"created_by" gorm:"foreignKey:CreatedByID"`

	RetryCount      int        `json:"retry_count" gorm:"default:0"`
	LastRetryAt     *time.Time `json:"last_retry_at"`
	LastRetryByID   *uint      `json:"last_retry_by_id" gorm:"index"`
	LastRetryBy     *User      `json:"last_retry_by" gorm:"foreignKey:LastRetryByID"`
	InjectReason    string     `json:"inject_reason"`
	ManualOrderType string     `json:"manual_order_type"`

	// Relasi ke Histori Aktivitas Transaksi
	Activities []TransactionActivity `json:"activities" gorm:"foreignKey:TransactionID"`

	VANumber    string `json:"va_number,omitempty" gorm:"size:100"`
	VABank      string `json:"va_bank,omitempty" gorm:"size:30"`
	BillerCode  string `json:"biller_code,omitempty" gorm:"size:30"`
	BillKey     string `json:"bill_key,omitempty" gorm:"size:100"`
	QRString    string `json:"qr_string,omitempty" gorm:"type:text"`
	QRURL       string `json:"qr_url,omitempty" gorm:"type:text"`
	DeeplinkURL string `json:"deeplink_url,omitempty" gorm:"type:text"`
	PaymentCode string `json:"payment_code,omitempty" gorm:"size:100"`
}

// ==========================================
// 🚀 4. DTO KHUSUS UNTUK RESPONSE LIST FRONTEND
// ==========================================
type MinimalProductDTO struct {
	ID   uint   `json:"ID"` //
	Name string `json:"name"`
	Code string `json:"code"`
}

type TransactionListDTO struct {
	ID                  uint              `json:"ID"`
	CreatedAt           time.Time         `json:"CreatedAt"`
	UpdatedAt           time.Time         `json:"UpdatedAt"`
	InvoiceID           string            `json:"invoice_id"`
	Target              string            `json:"target"`
	Product             MinimalProductDTO `json:"Product"`
	Amount              float64           `json:"amount"`
	Capital             float64           `json:"capital"`
	Profit              float64           `json:"profit"`
	ProductAmount       float64           `json:"product_amount"`
	StartingPrice       float64           `json:"starting_price"`
	CustomerSurcharge   float64           `json:"customer_surcharge"`
	PaymentMethod       string            `json:"payment_method"`
	ActualPaymentMethod string            `json:"actual_payment_method" gorm:"size:40;index"`
	PaymentProvider     string            `json:"payment_provider"`
	PaymentQuoteKey     string            `json:"payment_quote_key"`
	PaymentURL          string            `json:"payment_url"`
	PaymentReference    string            `json:"payment_reference"`
	PaymentFeeBearer    string            `json:"payment_fee_bearer"`
	PaymentFeeEstimated float64           `json:"payment_fee_estimated"`
	PaymentFeeActual    *float64          `json:"payment_fee_actual"`
	NetProfitEstimated  float64           `json:"net_profit_estimated"`
	NetProfitActual     *float64          `json:"net_profit_actual"`
	Reference           string            `json:"reference"`
	Status              string            `json:"status"`
	PaymentStatus       string            `json:"payment_status,omitempty"`
	FulfillmentStatus   string            `json:"fulfillment_status,omitempty"`
	DigiStatus          string            `json:"digi_status"`
	SN                  string            `json:"sn"`

	// --- PROVIDER AUDIT FIELDS ---
	Provider     string `json:"provider"`
	ProviderSKU  string `json:"provider_sku"`
	ProviderRef  string `json:"provider_ref"`
	ProviderName string `json:"provider_name"`

	// --- [BARU] AUDIT FIELDS ---
	CreatedVia      string                `json:"created_via"`
	CreatedByName   string                `json:"created_by_name"`
	CreatedByRole   string                `json:"created_by_role"`
	RetryCount      int                   `json:"retry_count"`
	ManualOrderType string                `json:"manual_order_type,omitempty"`
	Activities      []TransactionActivity `json:"activities"`
}

// --- Request/Response Structs ---
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type CheckoutRequest struct {
	ProductID           uint    `json:"product_id"`
	Target              string  `json:"target"`
	TargetSecondary     string  `json:"target_secondary"`
	TargetType          string  `json:"target_type"`
	QuoteKey            string  `json:"quote_key"`
	ExpectedTotalAmount float64 `json:"expected_total_amount"`
	Quantity            int     `json:"quantity"`
	PaymentMethod       string  `json:"payment_method"`
	CustomerName        string  `json:"customer_name"`
	Email               string  `json:"email"`
	PayerPhone          string  `json:"payer_phone"`
}

type ManualOrderRequest struct {
	SKU             string  `json:"sku"`
	TargetID        string  `json:"target_id"`
	Target          string  `json:"target"`
	TargetSecondary string  `json:"target_secondary"`
	TargetType      string  `json:"target_type"`
	SellingPrice    float64 `json:"selling_price"`
	ManualOrderType string  `json:"manual_order_type"`
	InjectReason    string  `json:"inject_reason"`
}

type SearchOrderRequest struct {
	InvoiceID string `json:"invoice_id"`
}

type TripayCallback struct {
	MerchantRef string `json:"merchant_ref"`
	Status      string `json:"status"`
}

// Setting Global
type Setting struct {
	ID    uint   `gorm:"primaryKey" json:"id"`
	Key   string `gorm:"unique;not null" json:"key"`
	Value string `json:"value"`
}

// PendingProduct Model
type PendingProduct struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	RawSKU    string    `gorm:"index" json:"raw_sku"`
	RawBrand  string    `json:"raw_brand"`
	RawName   string    `json:"raw_name"`
	Provider  string    `gorm:"index" json:"provider"`
	Status    string    `gorm:"default:'pending'" json:"status"`
	CreatedAt time.Time `json:"created_at"`
}
