package main

import (
	"log"
	"os"

	"github.com/derry/anggijajan-v2-backend/controllers" // 👈 Import Controller buat panggil Sync
	"github.com/derry/anggijajan-v2-backend/database"
	"github.com/derry/anggijajan-v2-backend/models"
	"github.com/derry/anggijajan-v2-backend/routes"
	"github.com/robfig/cron/v3" // 👈 Import Library Cron
	"golang.org/x/crypto/bcrypt"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/joho/godotenv"
)

func SeedUsers() {
	var count int64
	database.DB.Model(&models.User{}).Count(&count)

	if count == 0 {
		// Ambil Data dari .env
		devEmail := os.Getenv("SEED_DEV_EMAIL")
		devPass := os.Getenv("SEED_DEV_PASSWORD")
		adminEmail := os.Getenv("SEED_ADMIN_EMAIL")
		adminPass := os.Getenv("SEED_ADMIN_PASSWORD")

		// 1. Buat Akun DEV (Akses Full)
		hashDev, _ := bcrypt.GenerateFromPassword([]byte(devPass), bcrypt.DefaultCost)
		devUser := models.User{
			Name:     "Developer",
			Email:    devEmail,
			Password: string(hashDev),
			Role:     "dev", // Role khusus dev
		}
		database.DB.Create(&devUser)

		// 2. Buat Akun ADMIN STAFF
		hashAdmin, _ := bcrypt.GenerateFromPassword([]byte(adminPass), bcrypt.DefaultCost)
		adminUser := models.User{
			Name:     "Admin Staff",
			Email:    adminEmail,
			Password: string(hashAdmin),
			Role:     "admin", // Role staff biasa
		}
		database.DB.Create(&adminUser)

		log.Println("✅ Seeding Selesai: Akun Dev & Admin Staff Berhasil Dibuat!")
	}
}

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("⚠️  Warning: .env file not found")
	}

	database.Connect()
	database.SeedUsers()

	app := fiber.New()

	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, X-Callback-Signature, Authorization",
	}))

	// Setup Routes
	routes.SetupRoutes(app)

	app.Get("/", func(c *fiber.Ctx) error {
		return c.SendString("🚀 Backend AnggiJajan Running (Auto-Sync Active)!")
	})

	// ==========================================
	// 🔥 CRON JOB SETUP (AUTO SYNC) 🔥
	// ==========================================
	c := cron.New()

	// Jadwal: "@every 1h" (Tiap 1 Jam)
	// Bisa diganti: "@every 30m" (30 menit) atau "0 0 * * *" (Tiap Jam 12 Malam)
	c.AddFunc("@every 1h", func() {
		log.Println("⏰ [CRON] Memulai Auto-Sync Digiflazz...")

		// Panggil Logic Sync dari Controller (Bukan API Handler)
		total, active, inactive, err := controllers.RunDigiflazzSync()

		if err != nil {
			log.Printf("❌ [CRON] Gagal Sync: %v", err)
		} else {
			log.Printf("✅ [CRON] Selesai! Update %d produk (Aktif: %d, Mati: %d)", total, active, inactive)
		}
	})

	c.Start() // Nyalakan Mesin Waktu
	log.Println("⏳ Cron Job Berjalan: Auto-Sync setiap 1 jam")
	// ==========================================

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Fatal(app.Listen(":" + port))
}
