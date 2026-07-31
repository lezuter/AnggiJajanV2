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
	)

	if err != nil {
		log.Fatal("❌ Gagal Migrasi Schema: ", err)
	}

	if err := migrateProductGroupIntegrity(); err != nil {
		log.Fatal("Gagal migrasi integritas kelompok produk: ", err)
	}

	if err := migrateProductLifecycle(); err != nil {
		log.Fatal("Gagal migrasi lifecycle produk: ", err)
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
	var count int64
	DB.Model(&models.Setting{}).Count(&count)
	if count == 0 {
		fmt.Println("🌱 Seeding Default Settings...")
		DB.Create(&models.Setting{Key: "margin_percent", Value: "5"})
		DB.Create(&models.Setting{Key: "flat_fee", Value: "0"})
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

		return tx.Exec(`
			CREATE UNIQUE INDEX IF NOT EXISTS idx_catalogs_card_code_reference
			ON catalogs (card_code)
		`).Error
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
