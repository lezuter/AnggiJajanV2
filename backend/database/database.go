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

	// 1. AUTO MIGRATE SCHEMA BARU
	fmt.Println("🔄 Migrating Database Schema...")
	err = DB.AutoMigrate(
		&models.User{},
		&models.Catalog{},
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
