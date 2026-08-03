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
	CardCode    string `gorm:"primaryKey;size:20" json:"cardcode"`
	Name        string `json:"name"`
	Slug        string `gorm:"uniqueIndex" json:"slug"`
	ShortName   string `json:"short_name"`
	Description string `json:"description"`
	ImageURL    string `json:"image_url"`
	BannerURL   string `json:"banner_url"`
	Publisher   string `json:"publisher"`
	Region      string `json:"region"`

	Category  string `gorm:"index" json:"category"`
	IsPopular bool   `gorm:"default:false;index" json:"is_popular"`
	SortOrder int    `gorm:"default:0;index" json:"sort_order"`
	IsPublic  bool   `gorm:"default:true;index" json:"is_public"`

	IsActive    bool           `gorm:"default:true" json:"is_active"`
	CheckIDCode string         `json:"check_id_code"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	ProductGroups []ProductGroup `gorm:"foreignKey:CatalogCardCode;references:CardCode;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"product_groups"`
	Products      []Product      `gorm:"foreignKey:CatalogCardCode;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;" json:"products"`
}

// ProductGroup is an admin-managed section inside a catalog. Provider syncs
// must never decide or overwrite this relationship.
type ProductGroup struct {
	gorm.Model
	Name            string    `json:"name" gorm:"size:100;not null;check:chk_product_group_name_nonempty,char_length(btrim(name)) > 0"`
	CatalogCardCode string    `json:"catalog_cardcode" gorm:"column:catalog_cardcode;size:20;not null;index"`
	Catalog         Catalog   `json:"-" gorm:"foreignKey:CatalogCardCode;references:CardCode;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	SortOrder       int       `json:"sort_order" gorm:"not null;default:0;index;check:chk_product_group_sort_order_nonnegative,sort_order >= 0"`
	IsActive        bool      `json:"is_active" gorm:"not null;default:true;index"`
	Products        []Product `json:"products" gorm:"foreignKey:ProductGroupID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

// Product Model
type Product struct {
	gorm.Model
	Name            string        `json:"name"`
	Code            string        `gorm:"uniqueIndex" json:"code"`
	Price           float64       `json:"price"`
	SellingPrice    float64       `json:"selling_price" gorm:"-"`
	StartingPrice   float64       `json:"starting_price" gorm:"-"`
	StartingMethod  string        `json:"starting_payment_method" gorm:"-"`
	OriginalPrice   *float64      `json:"original_price" gorm:"column:original_price"`
	Stock           int           `json:"stock" gorm:"default:0"`
	IsActive        bool          `json:"is_active" gorm:"default:true;index"` // Status ketersediaan dari provider.
	AdminEnabled    bool          `json:"admin_enabled" gorm:"default:true;index"`
	IsArchived      bool          `json:"is_archived" gorm:"default:false;index"` // Kolom kompatibilitas; tidak digunakan oleh workflow admin.
	ImageURL        string        `json:"image_url"`
	CatalogCardCode string        `json:"catalog_cardcode" gorm:"column:catalog_cardcode;index"`
	Catalog         Catalog       `gorm:"foreignKey:CatalogCardCode;references:CardCode" json:"catalog"`
	ProductGroupID  *uint         `json:"product_group_id" gorm:"index"`
	ProductGroup    *ProductGroup `json:"product_group,omitempty" gorm:"foreignKey:ProductGroupID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	SortOrder       int           `json:"sort_order" gorm:"not null;default:0;index;check:chk_product_sort_order_nonnegative,sort_order >= 0"`
	Provider        string        `json:"provider" gorm:"default:'digiflazz';index"`
}

const StorefrontMarkupRate = 0.05

// CalculateSellingPrice is the single source of truth for the internal target
// net. Price remains provider capital and SellingPrice is never persisted.
func CalculateSellingPrice(capital float64) float64 {
	roundedCapital := math.Round(capital)
	return math.Round(roundedCapital * (1 + StorefrontMarkupRate))
}

// AfterFind exposes both the internal target and the QRIS-inclusive public
// starting price without adding a persisted Product column or a network call.
func (product *Product) AfterFind(_ *gorm.DB) error {
	product.SellingPrice = CalculateSellingPrice(product.Price)
	product.StartingMethod = "QRIS"

	config, err := payments.LoadMidtransConfig()
	if err != nil {
		product.StartingPrice = product.SellingPrice
		return nil
	}
	product.StartingPrice, err = config.StartingPrice(product.SellingPrice)
	if err != nil {
		product.StartingPrice = product.SellingPrice
	}
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
	InvoiceID     string  `json:"invoice_id" gorm:"unique"`
	ProductID     uint    `json:"product_id"`
	Product       Product `gorm:"foreignKey:ProductID;references:ID"`
	CustomerPhone string  `json:"customer_phone"` // Target ID

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
	PaymentProvider       string   `json:"payment_provider" gorm:"size:30;index"`
	PaymentQuoteKey       string   `json:"payment_quote_key" gorm:"size:120;index"`
	PaymentMethod         string   `json:"payment_method"`
	PaymentURL            string   `json:"payment_url"`
	PaymentReference      string   `json:"payment_reference" gorm:"size:100;index"`
	PaymentFeeBearer      string   `json:"payment_fee_bearer" gorm:"size:20;index"`
	PaymentFeeEstimated   float64  `json:"payment_fee_estimated" gorm:"not null;default:0"`
	PaymentFeeActual      *float64 `json:"payment_fee_actual"`
	NetProfitEstimated    float64  `json:"net_profit_estimated" gorm:"not null;default:0"`
	NetProfitActual       *float64 `json:"net_profit_actual"`
	MidtransTransactionID string   `json:"midtrans_transaction_id" gorm:"size:100;index"`
	SnapToken             string   `json:"-" gorm:"type:text"`

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
}

// ==========================================
// 🚀 4. DTO KHUSUS UNTUK RESPONSE LIST FRONTEND
// ==========================================
type MinimalProductDTO struct {
	ID   uint   `json:"ID"` // 🔥 BALIKIN INI
	Name string `json:"name"`
	Code string `json:"code"`
}

type TransactionListDTO struct {
	ID                  uint              `json:"ID"`
	CreatedAt           time.Time         `json:"CreatedAt"`
	UpdatedAt           time.Time         `json:"UpdatedAt"` // 🔥 BALIKIN INI
	InvoiceID           string            `json:"invoice_id"`
	CustomerPhone       string            `json:"customer_phone"`
	Product             MinimalProductDTO `json:"Product"`
	Amount              float64           `json:"amount"`
	Capital             float64           `json:"capital"` // 🔥 BALIKIN INI
	Profit              float64           `json:"profit"`
	ProductAmount       float64           `json:"product_amount"`
	StartingPrice       float64           `json:"starting_price"`
	CustomerSurcharge   float64           `json:"customer_surcharge"`
	PaymentMethod       string            `json:"payment_method"`
	PaymentProvider     string            `json:"payment_provider"`
	PaymentQuoteKey     string            `json:"payment_quote_key"`
	PaymentURL          string            `json:"payment_url"` // 🔥 BALIKIN INI
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
	ProductID     uint   `json:"product_id"`
	CustomerPhone string `json:"customer_phone"`
	QuoteKey      string `json:"quote_key"`
	PaymentMethod string `json:"payment_method"`
	CustomerName  string `json:"customer_name"`
	Email         string `json:"email"`
}

type ManualOrderRequest struct {
	SKU             string  `json:"sku"`
	TargetID        string  `json:"target_id"`
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
