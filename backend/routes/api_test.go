package routes

import (
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestProductArchiveAndDeleteRoutesAreNotRegistered(t *testing.T) {
	app := fiber.New()
	SetupRoutes(app)

	forbiddenRoutes := map[string]struct{}{
		"GET /api/admin/products/archived":      {},
		"POST /api/admin/products/bulk-archive": {},
		"POST /api/admin/products/bulk-restore": {},
		"DELETE /api/admin/products/:id":        {},
	}

	for _, route := range app.GetRoutes() {
		routeKey := route.Method + " " + route.Path
		if _, forbidden := forbiddenRoutes[routeKey]; forbidden {
			t.Fatalf("product lifecycle route must not be registered: %s", routeKey)
		}
	}
}
