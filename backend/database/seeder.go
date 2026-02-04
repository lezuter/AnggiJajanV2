package database

import (
	"fmt"
	"os"

	"github.com/derry/anggijajan-v2-backend/models"
	"golang.org/x/crypto/bcrypt"
)

func SeedUsers() {
	var count int64
	DB.Model(&models.User{}).Count(&count)
	if count == 0 {
		fmt.Println("🌱 Seeding Users...")
		devEmail := os.Getenv("SEED_DEV_EMAIL")
		devPass := os.Getenv("SEED_DEV_PASSWORD")
		adminEmail := os.Getenv("SEED_ADMIN_EMAIL")
		adminPass := os.Getenv("SEED_ADMIN_PASSWORD")

		if devEmail != "" {
			hash, _ := bcrypt.GenerateFromPassword([]byte(devPass), 14)
			DB.Create(&models.User{Name: "Lezut3Rr", Email: devEmail, Password: string(hash), Role: "developer"})
		}
		if adminEmail != "" {
			hash, _ := bcrypt.GenerateFromPassword([]byte(adminPass), 14)
			DB.Create(&models.User{Name: "Enzyy", Email: adminEmail, Password: string(hash), Role: "admin"})
		}
		fmt.Println("✅ User Seeded!")
	}
}
