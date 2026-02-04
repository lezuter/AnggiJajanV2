package routes

import (
	"github.com/derry/anggijajan-v2-backend/controllers"
	"github.com/derry/anggijajan-v2-backend/middleware"

	"github.com/gofiber/fiber/v2"
)

func SetupRoutes(app *fiber.App) {
	api := app.Group("/api")

	// ===========================
	// 🟢 PUBLIC ROUTES (BEBAS AKSES)
	// ===========================
	// 👇 INI PERBAIKANNYA! Kita tambahin "/admin" di depannya
	api.Post("/admin/login", controllers.Login)

	api.Get("/catalogs", controllers.GetCatalogs)
	api.Get("/catalogs/:slug", controllers.GetCatalogBySlug)
	api.Get("/products", controllers.GetProducts)
	api.Get("/banners", controllers.GetPublicBanners)
	api.Post("/checkout", controllers.Checkout)
	api.Post("/callback", controllers.TripayCallbackHandler)
	api.Post("/search-order", controllers.SearchOrder)
	api.Post("/check-account", controllers.CheckAccount)
	api.Get("/transaction/:invoice", controllers.CheckTransactionStatus)

	// ===========================
	// 🔒 ADMIN ROUTES (BUTUH TOKEN)
	// ===========================
	admin := api.Group("/admin", middleware.AuthRequired)

	admin.Get("/dashboard", controllers.GetDashboardStats)
	admin.Get("/balance", controllers.GetDigiflazzBalance)
	admin.Get("/digiflazz-balance", controllers.GetDigiflazzBalance)

	// CATALOG
	admin.Post("/catalogs", controllers.CreateCatalog)
	admin.Put("/catalogs/:id", controllers.UpdateCatalog)
	admin.Delete("/catalogs/:id", controllers.DeleteCatalog)
	admin.Get("/catalogs", controllers.GetAdminCatalogs)

	// PRODUCT
	admin.Post("/products/sync/:provider", controllers.SyncAllProducts)
	admin.Put("/products/:id/image", controllers.UpdateProductImage)
	// Route CRUD Biasa
	admin.Put("/products/:id", controllers.UpdateProduct)
	admin.Delete("/products/:id", controllers.DeleteProduct)

	// BANNER
	admin.Get("/banners", controllers.GetAdminBanners)     // Buat Admin liat list
	admin.Post("/banners", controllers.CreateBanner)       // Buat Tambah
	admin.Delete("/banners/:id", controllers.DeleteBanner) // Buat Hapus
	admin.Put("/banners/:id", controllers.UpdateBanner)

	// TRANSACTION
	admin.Get("/transactions", controllers.GetTransactions)
	admin.Post("/manual-order", controllers.ManualOrder)

	// SETTINGS
	admin.Get("/settings", controllers.GetSettings)
	admin.Put("/settings", controllers.UpdateSettings)

}
