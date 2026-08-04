package database

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/derry/anggijajan-v2-backend/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func Connect() {
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=Asia/Jakarta",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_NAME"),
		os.Getenv("DB_PORT"),
	)

	// DEBUG LOG
	fmt.Println("========================================")
	fmt.Println("🕵️‍♂️  CEK KONEKSI & CREDENTIALS")
	fmt.Println("----------------------------------------")
	fmt.Println("📂 DB NAME       :", os.Getenv("DB_NAME"))
	fmt.Println("========================================")

	database, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("❌ Gagal konek ke Database: ", err)
	}

	DB = database

	// OPTIMASI CONNECTION POOL
	sqlDB, err := DB.DB()
	if err == nil {
		sqlDB.SetMaxIdleConns(10)
		sqlDB.SetMaxOpenConns(100)
		sqlDB.SetConnMaxLifetime(time.Hour)
	}

	fmt.Println("🚀 Database Connected with Connection Pool!")

	// Catalog harus dimigrasikan lebih dulu karena ProductGroup dan Product
	// memakai catalogs.card_code sebagai referenced key. Database lama belum
	// tentu memiliki UNIQUE constraint meskipun model sekarang primaryKey.
	fmt.Println("🔄 Preparing catalog reference schema...")
	if err := DB.AutoMigrate(
		&models.User{},
		&models.Catalog{},
	); err != nil {
		log.Fatal("❌ Gagal Migrasi Schema Dasar: ", err)
	}

	if err := migrateCatalogReferenceIntegrity(); err != nil {
		log.Fatal("❌ Gagal menyiapkan referensi katalog: ", err)
	}

	// Foreign key menuju catalogs.card_code baru dibuat setelah referenced key
	// pada database lama dipastikan valid dan unik.
	fmt.Println("🔄 Migrating Database Schema...")
	err = DB.AutoMigrate(
		&models.ProductGroup{},
		&models.Product{},
		&models.Transaction{},
		&models.TransactionActivity{},
		&models.ActivityLog{},
		&models.Banner{},
		&models.Setting{},
		&models.PendingProduct{},
		&models.ProviderSyncState{},
	)

	if err != nil {
		log.Fatal("❌ Gagal Migrasi Schema: ", err)
	}

	if err := migratePendingProductProviderSKUIntegrity(DB); err != nil {
		log.Fatal("❌ Gagal migrasi index pending_products: ", err)
	}

	if err := migrateProductCodeIntegrity(DB); err != nil {
		log.Fatal("❌ Gagal migrasi integritas SKU produk: ", err)
	}

	if err := migrateCanonicalCatalogForeignKeys(DB); err != nil {
		log.Fatal("❌ Gagal migrasi FK canonical katalog: ", err)
	}

	if err := migrateProductGroupIntegrity(); err != nil {
		log.Fatal("Gagal migrasi integritas kelompok produk: ", err)
	}

	if err := migrateProductLifecycle(); err != nil {
		log.Fatal("Gagal migrasi lifecycle produk: ", err)
	}

	if err := migratePaymentFoundation(); err != nil {
		log.Fatal("Gagal migrasi fondasi payment: ", err)
	}

	// 2. [BARU] EKSEKUSI MIGRASI DATA TRANSAKSI LAMA
	fmt.Println("🔄 Memulai migrasi pemisahan log error transaksi lama...")
	// Pindahin sn ke serial_number buat yang sukses
	DB.Exec("UPDATE transactions SET serial_number = sn WHERE status IN ('SUCCESS', 'PAID') AND sn IS NOT NULL AND sn != ''")
	// Pindahin sn ke error_message buat yang gagal
	DB.Exec("UPDATE transactions SET error_message = sn WHERE status IN ('FAILED', 'PENDING') AND sn IS NOT NULL AND sn != ''")
	// Kosongin kolom sn lama biar nggak ada data duplikat (opsional tapi clean)
	DB.Exec("UPDATE transactions SET sn = '' WHERE sn IS NOT NULL AND sn != ''")
	fmt.Println("✅ Data transaksi lama berhasil dipisahkan!")

	// 3. SEEDING DEFAULT SETTINGS
	if err := seedDefaultSettings(); err != nil {
		log.Fatal("❌ Gagal seeding default settings: ", err)
	}

	fmt.Println("✅ Database Preparation Complete!")
}

// migrateCatalogReferenceIntegrity upgrades legacy catalog tables before any
// foreign key references catalogs.card_code. Migration sengaja berhenti dengan
// pesan jelas daripada menghapus atau menggabungkan data katalog diam-diam.
func migrateCatalogReferenceIntegrity() error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var invalidCardCodes int64
		if err := tx.Raw(`
			SELECT COUNT(*)
			FROM catalogs
			WHERE card_code IS NULL OR BTRIM(card_code) = ''
		`).Scan(&invalidCardCodes).Error; err != nil {
			return err
		}
		if invalidCardCodes > 0 {
			return fmt.Errorf(
				"terdapat %d katalog dengan card_code kosong; perbaiki data katalog sebelum migrasi",
				invalidCardCodes,
			)
		}

		var duplicateCardCodes int64
		if err := tx.Raw(`
			SELECT COUNT(*)
			FROM (
				SELECT card_code
				FROM catalogs
				GROUP BY card_code
				HAVING COUNT(*) > 1
			) AS duplicate_catalogs
		`).Scan(&duplicateCardCodes).Error; err != nil {
			return err
		}
		if duplicateCardCodes > 0 {
			return fmt.Errorf(
				"terdapat %d card_code katalog duplikat; perbaiki duplikat sebelum migrasi",
				duplicateCardCodes,
			)
		}

		if err := tx.Exec(`
			CREATE UNIQUE INDEX IF NOT EXISTS idx_catalogs_card_code_reference
			ON catalogs (card_code)
		`).Error; err != nil {
			return err
		}

		return tx.Exec(`
			ALTER TABLE catalogs
			ALTER COLUMN card_code SET NOT NULL
		`).Error
	})
}

type productCodeIntegrityAudit struct {
	InvalidCodes   int64
	DuplicateCodes int64
}

func (audit productCodeIntegrityAudit) validate() error {
	if audit.InvalidCodes > 0 {
		return fmt.Errorf("terdapat %d products.code NULL/kosong", audit.InvalidCodes)
	}
	if audit.DuplicateCodes > 0 {
		return fmt.Errorf("terdapat %d grup products.code duplikat setelah normalisasi", audit.DuplicateCodes)
	}
	return nil
}

func loadProductCodeIntegrityAudit(tx *gorm.DB) (productCodeIntegrityAudit, error) {
	audit := productCodeIntegrityAudit{}
	if err := tx.Raw(`
		SELECT COUNT(*)
		FROM products
		WHERE code IS NULL OR BTRIM(code) = ''
	`).Scan(&audit.InvalidCodes).Error; err != nil {
		return productCodeIntegrityAudit{}, err
	}
	if err := tx.Raw(`
		SELECT COUNT(*)
		FROM (
			SELECT LOWER(BTRIM(code))
			FROM products
			GROUP BY LOWER(BTRIM(code))
			HAVING COUNT(*) > 1
		) AS duplicate_product_codes
	`).Scan(&audit.DuplicateCodes).Error; err != nil {
		return productCodeIntegrityAudit{}, err
	}
	return audit, nil
}

func productCodeIntegrityStatements() []string {
	return []string{
		`ALTER TABLE products ALTER COLUMN code SET NOT NULL`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_products_code_normalized_unique
		 ON products (LOWER(BTRIM(code)))`,
	}
}

func migrateProductCodeIntegrity(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		audit, err := loadProductCodeIntegrityAudit(tx)
		if err != nil {
			return fmt.Errorf("gagal audit SKU produk: %w", err)
		}
		if err := audit.validate(); err != nil {
			return fmt.Errorf("audit SKU produk gagal: %w", err)
		}
		for _, statement := range productCodeIntegrityStatements() {
			if err := tx.Exec(statement).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func migratePendingProductProviderSKUIntegrity(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var duplicatePairs int64
		if err := tx.Raw(`
			SELECT COUNT(*)
			FROM (
				SELECT LOWER(BTRIM(provider)) AS normalized_provider,
				       BTRIM(raw_sku) AS normalized_sku
				FROM pending_products
				WHERE provider IS NOT NULL
				  AND BTRIM(provider) <> ''
				  AND raw_sku IS NOT NULL
				  AND BTRIM(raw_sku) <> ''
				GROUP BY LOWER(BTRIM(provider)), BTRIM(raw_sku)
				HAVING COUNT(*) > 1
			) AS duplicate_pending_products
		`).Scan(&duplicatePairs).Error; err != nil {
			return err
		}
		if duplicatePairs > 0 {
			return fmt.Errorf(
				"terdapat %d pasangan pending_products provider + raw_sku duplikat; rapikan data sebelum migrasi",
				duplicatePairs,
			)
		}

		return tx.Exec(`
			CREATE UNIQUE INDEX IF NOT EXISTS uidx_pending_products_provider_raw_sku
			ON pending_products (LOWER(BTRIM(provider)), BTRIM(raw_sku))
			WHERE provider IS NOT NULL
			  AND BTRIM(provider) <> ''
			  AND raw_sku IS NOT NULL
			  AND BTRIM(raw_sku) <> ''
		`).Error
	})
}

type canonicalCatalogReferenceAudit struct {
	InvalidCatalogs      int64
	DuplicateCatalogs    int64
	InvalidProductGroups int64
	OrphanProductGroups  int64
	InvalidProducts      int64
	OrphanProducts       int64
}

func (audit canonicalCatalogReferenceAudit) validate() error {
	switch {
	case audit.InvalidCatalogs > 0:
		return fmt.Errorf("terdapat %d catalogs.card_code NULL/kosong", audit.InvalidCatalogs)
	case audit.DuplicateCatalogs > 0:
		return fmt.Errorf("terdapat %d catalogs.card_code duplikat", audit.DuplicateCatalogs)
	case audit.InvalidProductGroups > 0:
		return fmt.Errorf("terdapat %d product_groups.catalog_cardcode NULL/kosong", audit.InvalidProductGroups)
	case audit.OrphanProductGroups > 0:
		return fmt.Errorf("terdapat %d orphan product_groups.catalog_cardcode", audit.OrphanProductGroups)
	case audit.InvalidProducts > 0:
		return fmt.Errorf("terdapat %d products.catalog_cardcode NULL/kosong", audit.InvalidProducts)
	case audit.OrphanProducts > 0:
		return fmt.Errorf("terdapat %d orphan products.catalog_cardcode", audit.OrphanProducts)
	default:
		return nil
	}
}

func loadCanonicalCatalogReferenceAudit(tx *gorm.DB) (canonicalCatalogReferenceAudit, error) {
	audit := canonicalCatalogReferenceAudit{}
	queries := []struct {
		destination *int64
		query       string
	}{
		{&audit.InvalidCatalogs, `SELECT COUNT(*) FROM catalogs WHERE card_code IS NULL OR BTRIM(card_code) = ''`},
		{&audit.DuplicateCatalogs, `SELECT COUNT(*) FROM (SELECT card_code FROM catalogs GROUP BY card_code HAVING COUNT(*) > 1) AS duplicate_catalogs`},
		{&audit.InvalidProductGroups, `SELECT COUNT(*) FROM product_groups WHERE catalog_cardcode IS NULL OR BTRIM(catalog_cardcode) = ''`},
		{&audit.OrphanProductGroups, `SELECT COUNT(*) FROM product_groups AS product_group WHERE NOT EXISTS (SELECT 1 FROM catalogs AS catalog WHERE catalog.card_code = product_group.catalog_cardcode)`},
		{&audit.InvalidProducts, `SELECT COUNT(*) FROM products WHERE catalog_cardcode IS NULL OR BTRIM(catalog_cardcode) = ''`},
		{&audit.OrphanProducts, `SELECT COUNT(*) FROM products AS product WHERE NOT EXISTS (SELECT 1 FROM catalogs AS catalog WHERE catalog.card_code = product.catalog_cardcode)`},
	}

	for _, item := range queries {
		if err := tx.Raw(item.query).Scan(item.destination).Error; err != nil {
			return canonicalCatalogReferenceAudit{}, err
		}
	}

	return audit, nil
}

func canonicalCatalogNotNullStatements() []string {
	return []string{
		`ALTER TABLE product_groups
		 ALTER COLUMN catalog_cardcode SET NOT NULL`,
		`ALTER TABLE products
		 ALTER COLUMN catalog_cardcode SET NOT NULL`,
	}
}

func canonicalCatalogForeignKeyStatements() []string {
	return []string{
		`DO $$
		BEGIN
			IF NOT EXISTS (
				SELECT 1 FROM pg_constraint
				WHERE conname = 'fk_product_groups_catalog_cardcode'
				  AND conrelid = 'product_groups'::regclass
			) THEN
				ALTER TABLE product_groups
				ADD CONSTRAINT fk_product_groups_catalog_cardcode
				FOREIGN KEY (catalog_cardcode)
				REFERENCES catalogs(card_code)
				ON UPDATE CASCADE
				ON DELETE RESTRICT;
			END IF;
		END $$`,
		`DO $$
		BEGIN
			IF NOT EXISTS (
				SELECT 1 FROM pg_constraint
				WHERE conname = 'fk_products_catalog_cardcode'
				  AND conrelid = 'products'::regclass
			) THEN
				ALTER TABLE products
				ADD CONSTRAINT fk_products_catalog_cardcode
				FOREIGN KEY (catalog_cardcode)
				REFERENCES catalogs(card_code)
				ON UPDATE CASCADE
				ON DELETE RESTRICT;
			END IF;
		END $$`,
	}
}

func migrateCanonicalCatalogForeignKeys(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		audit, err := loadCanonicalCatalogReferenceAudit(tx)
		if err != nil {
			return fmt.Errorf("gagal menjalankan audit referensi katalog: %w", err)
		}
		if err := audit.validate(); err != nil {
			return fmt.Errorf("audit referensi katalog gagal: %w", err)
		}

		for _, statement := range canonicalCatalogNotNullStatements() {
			if err := tx.Exec(statement).Error; err != nil {
				return err
			}
		}

		for _, statement := range canonicalCatalogForeignKeyStatements() {
			if err := tx.Exec(statement).Error; err != nil {
				return err
			}
		}

		return nil
	})
}

// migrateProductGroupIntegrity is intentionally idempotent. It repairs rows
// that could have been written manually or by an older application version
// before enforcing case-insensitive uniqueness for active groups.
func migrateProductGroupIntegrity() error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(`
			UPDATE products AS product
			SET product_group_id = NULL, sort_order = 0
			WHERE product.product_group_id IS NOT NULL
			  AND NOT EXISTS (
				SELECT 1
				FROM product_groups AS product_group
				WHERE product_group.id = product.product_group_id
				  AND product_group.deleted_at IS NULL
				  AND product_group.catalog_cardcode = product.catalog_cardcode
			  )
		`).Error; err != nil {
			return err
		}

		return tx.Exec(`
			CREATE UNIQUE INDEX IF NOT EXISTS idx_product_groups_catalog_name_active
			ON product_groups (catalog_cardcode, LOWER(BTRIM(name)))
			WHERE deleted_at IS NULL
		`).Error
	})
}

func migrateProductLifecycle() error {
	if err := DB.Exec(
		"UPDATE products SET admin_enabled = TRUE WHERE admin_enabled IS NULL",
	).Error; err != nil {
		return err
	}

	if err := DB.Exec(
		"UPDATE products SET is_archived = FALSE WHERE is_archived IS NULL",
	).Error; err != nil {
		return err
	}

	result := DB.Unscoped().
		Model(&models.Product{}).
		Where("deleted_at IS NOT NULL").
		Updates(map[string]interface{}{
			"is_archived":   true,
			"admin_enabled": false,
			"deleted_at":    nil,
		})
	if result.Error != nil {
		return result.Error
	}

	log.Printf(
		"Product lifecycle migration: %d legacy soft-deleted row dikonversi menjadi arsip",
		result.RowsAffected,
	)
	return nil
}

// migratePaymentFoundation hanya melakukan backfill metadata payment lama.
// Migrasi ini idempotent dan tidak menghapus, mereset, atau mengubah nominal
// transaksi yang sudah ada.
func migratePaymentFoundation() error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(`
			UPDATE transactions
			SET payment_provider = 'tripay'
			WHERE COALESCE(BTRIM(payment_provider), '') = ''
		`).Error; err != nil {
			return err
		}

		if err := tx.Exec(`
			UPDATE transactions
			SET payment_reference = reference
			WHERE COALESCE(BTRIM(payment_reference), '') = ''
			  AND COALESCE(BTRIM(reference), '') <> ''
		`).Error; err != nil {
			return err
		}

		// Kita tidak boleh menganggap fee transaksi historis ditanggung merchant
		// atau customer tanpa data yang mendukung, jadi tandai UNKNOWN.
		if err := tx.Exec(`
			UPDATE transactions
			SET payment_fee_bearer = 'UNKNOWN'
			WHERE COALESCE(BTRIM(payment_fee_bearer), '') = ''
		`).Error; err != nil {
			return err
		}

		return nil
	})
}

// seedDefaultSettings menambahkan setting yang belum ada tanpa menimpa value
// yang sudah pernah diubah admin.
func seedDefaultSettings() error {
	defaultSettings := []models.Setting{
		{Key: "margin_percent", Value: "5"},
		{Key: "flat_fee", Value: "0"},
		{Key: "payment_gateway", Value: "duitku"},
		{Key: "payment_fee_bearer", Value: "MERCHANT"},
		{Key: "minimum_net_profit", Value: "1500"},
		{Key: "minimum_profit_retention_percent", Value: "50"},
	}

	fmt.Println("🌱 Ensuring Default Settings...")

	return DB.Transaction(func(tx *gorm.DB) error {
		for _, defaultSetting := range defaultSettings {
			setting := defaultSetting

			if err := tx.
				Where("key = ?", setting.Key).
				FirstOrCreate(&setting).Error; err != nil {
				return fmt.Errorf(
					"gagal memastikan setting %s: %w",
					setting.Key,
					err,
				)
			}
		}

		return nil
	})
}
