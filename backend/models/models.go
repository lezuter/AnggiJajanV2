package models

import (
	"time"

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

// [BARU] Model Catalog (Card Game/Brand)
type Catalog struct {
	// CardCode jadi Primary Key (String)
	CardCode    string         `gorm:"primaryKey;size:20" json:"cardcode"`
	Name        string         `json:"name"`
	Slug        string         `gorm:"uniqueIndex" json:"slug"`
	ImageURL    string         `json:"image_url"`
	IsActive    bool           `gorm:"default:true" json:"is_active"`
	CheckIDCode string         `json:"check_id_code"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	// Relasi ke banyak produk
	Products []Product `gorm:"foreignKey:CatalogCardCode;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;" json:"products"`
}

// [UPDATE] Product Model (Tambah CatalogID)
type Product struct {
	gorm.Model
	Name            string  `json:"name"`
	Code            string  `gorm:"uniqueIndex" json:"code"`
	Price           float64 `json:"price"`
	Stock           int     `json:"stock" gorm:"default:0"`
	IsActive        bool    `json:"is_active"`
	ImageURL        string  `json:"image_url"`
	CatalogCardCode string  `json:"catalog_cardcode" gorm:"column:catalog_cardcode;index"`
	Catalog         Catalog `gorm:"foreignKey:CatalogCardCode;references:CardCode" json:"catalog"`
	Provider        string  `json:"provider" gorm:"default:'digiflazz';index"`
}

// Banner Model (Versi Ringkas)
type Banner struct {
	gorm.Model
	ImageURL  string     `json:"image_url"`
	TargetURL string     `json:"target_url"` // 👈 Link tujuan kalau banner diklik
	IsActive  bool       `json:"is_active" gorm:"default:true;index"`
	ExpiresAt *time.Time `json:"expires_at"` // 👈 Pake Pointer (*) biar bisa NULL (Unlimited)
}

// Transaction Model
type Transaction struct {
	gorm.Model
	InvoiceID     string  `json:"invoice_id" gorm:"unique"`
	ProductID     uint    `json:"product_id"`
	Product       Product `gorm:"foreignKey:ProductID"`
	CustomerPhone string  `json:"customer_phone"` // Ini kita pake buat nyimpen No Tujuan/Target ID juga

	Amount     float64 `json:"amount"`      // Harga Jual
	Capital    float64 `json:"capital"`     // Modal (Dari Digiflazz)
	Profit     float64 `json:"profit"`      // Untung (Amount - Capital)
	DigiStatus string  `json:"digi_status"` // Status Detail (Sukses/Gagal/Pending)

	Status        string `json:"status" gorm:"index"`
	PaymentMethod string `json:"payment_method"`
	PaymentURL    string `json:"payment_url"`
	Reference     string `json:"reference"`
	SN            string `json:"sn"`
}

// --- Request/Response Structs ---
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type CheckoutRequest struct {
	ProductID     uint   `json:"product_id"`
	CustomerPhone string `json:"customer_phone"`
	PaymentMethod string `json:"payment_method"`
}

type ManualOrderRequest struct {
	SKU      string `json:"sku"`
	TargetID string `json:"target_id"`
}

type SearchOrderRequest struct {
	InvoiceID string `json:"invoice_id"`
}

type TripayCallback struct {
	MerchantRef string `json:"merchant_ref"`
	Status      string `json:"status"`
}

// Setting Global (Keuntungan, Maintenance, dll)
type Setting struct {
	ID    uint   `gorm:"primaryKey" json:"id"`
	Key   string `gorm:"unique;not null" json:"key"` // Contoh: "margin_percent"
	Value string `json:"value"`                      // Contoh: "5"
}
