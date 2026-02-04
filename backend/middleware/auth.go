package middleware

import (
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// Helper: Ambil Kunci Rahasia (Biar sinkron sama AuthController)
func GetJWTSecret() []byte {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return []byte("rahasia-negara-api") // Default kalau di .env kosong
	}
	return []byte(secret)
}

// Middleware: Penjaga Pintu (Cek Token)
func AuthRequired(c *fiber.Ctx) error {
	// 1. Ambil Header Authorization
	authHeader := c.Get("Authorization")
	if authHeader == "" {
		return c.Status(401).JSON(fiber.Map{"error": "Akses Ditolak: Butuh Token!"})
	}

	// 2. Format harus "Bearer <token>"
	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || parts[0] != "Bearer" {
		return c.Status(401).JSON(fiber.Map{"error": "Format Token Salah"})
	}
	tokenString := parts[1]

	// 3. Validasi Token
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		// Pastikan algoritma enkripsinya bener (HMAC)
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fiber.ErrUnauthorized
		}
		return GetJWTSecret(), nil
	})

	if err != nil || !token.Valid {
		return c.Status(401).JSON(fiber.Map{"error": "Token Expired atau Tidak Valid"})
	}

	// Kalau aman, lanjut ke controller berikutnya
	return c.Next()
}
