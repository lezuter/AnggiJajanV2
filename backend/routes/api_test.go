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

func TestMidtransCustomerRoutesAreRegistered(t *testing.T) {
	app := fiber.New()
	SetupRoutes(app)

	requiredRoutes := map[string]bool{
		"GET /api/payment-config":     false,
		"GET /api/payment-methods":    false,
		"POST /api/checkout":          false,
		"POST /api/callback/midtrans": false,
	}
	for _, route := range app.GetRoutes() {
		key := route.Method + " " + route.Path
		if _, required := requiredRoutes[key]; required {
			requiredRoutes[key] = true
		}
	}
	for route, registered := range requiredRoutes {
		if !registered {
			t.Fatalf("required Midtrans customer route is not registered: %s", route)
		}
	}
}
