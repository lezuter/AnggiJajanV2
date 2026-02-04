package database

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/derry/anggijajan-v2-backend/models" // Pastikan import ini bener

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

	// 👇 TAMBAHIN BLOK KODE INI BUAT OPTIMASI CONNECTION POOL
	sqlDB, err := DB.DB()
	if err == nil {
		// Set maksimal jumlah koneksi yang nganggur (Standby)
		sqlDB.SetMaxIdleConns(10)
		// Set maksimal jumlah koneksi yang dibuka barengan
		sqlDB.SetMaxOpenConns(100)
		// Set waktu hidup koneksi (biar direfresh tiap jam)
		sqlDB.SetConnMaxLifetime(time.Hour)
	}

	fmt.Println("🚀 Database Connected with Connection Pool!")

	// 👇 PERBAIKAN UTAMA: Tambahin &models.Banner{} disini!
	fmt.Println("🔄 Migrating Database Schema...")
	err = DB.AutoMigrate(
		&models.User{},
		&models.Catalog{},
		&models.Product{},
		&models.Transaction{},
		&models.Banner{},
		&models.Setting{}, // 👈 TAMBAHIN INI
	)

	if err != nil {
		log.Fatal("❌ Gagal Migrasi: ", err)
	}

	// 👇 TAMBAHAN: SEEDING DEFAULT SETTINGS
	// Kalau tabel kosong, kita isi default margin 5%
	var count int64
	DB.Model(&models.Setting{}).Count(&count)
	if count == 0 {
		fmt.Println("🌱 Seeding Default Settings...")
		DB.Create(&models.Setting{Key: "margin_percent", Value: "5"}) // Untung 5%
		DB.Create(&models.Setting{Key: "flat_fee", Value: "0"})       // Biaya Admin Rp 0
	}

	fmt.Println("✅ Database Migrated Successfully!")
}
