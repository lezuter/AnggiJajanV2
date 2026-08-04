package main

import (
	"errors"
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
	if err := controllers.InitializeDigiflazzSyncCoordinator(); err != nil {
		log.Fatal("Gagal menginisialisasi coordinator sync Digiflazz: ", err)
	}

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

	runDigiflazzSync := func(trigger string) {
		log.Printf("⏰ [%s] Memulai Auto-Sync Digiflazz...", trigger)
		total, active, unmapped, err := controllers.RunDigiflazzSync("cron")

		if errors.Is(err, controllers.ErrDigiflazzSyncInProgress) {
			log.Println("[SYNC][DIGIFLAZZ] Cron dilewati: sync masih berjalan")
		} else if errors.Is(err, controllers.ErrDigiflazzSyncCooldown) {
			status, statusErr := controllers.CurrentDigiflazzSyncStatus()
			if statusErr != nil {
				log.Printf("[SYNC][DIGIFLAZZ] Cron dilewati: cooldown aktif (status gagal dimuat: %v)", statusErr)
			} else {
				log.Printf("[SYNC][DIGIFLAZZ] Cron dilewati: cooldown tersisa %d detik", status.RetryAfterSeconds)
			}
		} else if err != nil {
			log.Printf("❌ [%s] Gagal Sync: %v", trigger, err)
		} else {
			log.Printf("✅ [%s] Selesai! Update %d produk (Aktif: %d, Belum mapped: %d)", trigger, total, active, len(unmapped))
		}
	}

	if _, err := c.AddFunc("@every 15m", func() {
		runDigiflazzSync("CRON")
	}); err != nil {
		log.Printf("❌ Gagal menjadwalkan Auto-Sync Digiflazz: %v", err)
	}

	c.Start()
	log.Println("⏳ Cron Job Berjalan: Auto-Sync setiap 15 menit")
	// ==========================================

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Fatal(app.Listen(":" + port))
}
