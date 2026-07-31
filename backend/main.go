package main

import (
	"log"
	"os"

	"github.com/derry/anggijajan-v2-backend/controllers"
	"github.com/derry/anggijajan-v2-backend/database"
	"github.com/derry/anggijajan-v2-backend/routes"
	"github.com/robfig/cron/v3"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("⚠️  Warning: .env file not found")
	}

	// Connect ke DB (Sekaligus ngerjain AutoMigrate & mindahin data SN lama)
	database.Connect()

	// Panggil seeder dari file seeder.go
	database.SeedUsers()

	app := fiber.New()

	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, X-Callback-Signature, Authorization",
	}))

	routes.SetupRoutes(app)

	app.Get("/", func(c *fiber.Ctx) error {
		return c.SendString("🚀 Backend AnggiJajan Running (Auto-Sync Active)!")
	})

	// ==========================================
	// 🔥 CRON JOB SETUP (AUTO SYNC) 🔥
	// ==========================================
	c := cron.New()

	c.AddFunc("@every 1h", func() {
		log.Println("⏰ [CRON] Memulai Auto-Sync Digiflazz...")
		total, active, unmapped, err := controllers.RunDigiflazzSync()

		if err != nil {
			log.Printf("❌ [CRON] Gagal Sync: %v", err)
		} else {
			log.Printf("✅ [CRON] Selesai! Update %d produk (Aktif: %d, Belum mapped: %d)", total, active, len(unmapped))
		}
	})

	c.Start()
	log.Println("⏳ Cron Job Berjalan: Auto-Sync setiap 1 jam")
	// ==========================================

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Fatal(app.Listen(":" + port))
}
