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
	api.Post("/webhook/digiflazz", controllers.DigiflazzWebhookHandler)
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
	admin.Get("/catalogs/:cardcode/product-groups", controllers.GetProductGroups)
	admin.Post("/catalogs/:cardcode/product-groups", controllers.CreateProductGroup)

	// PRODUCT GROUP
	admin.Post("/product-groups/unassign-products", controllers.UnassignProductsFromGroups)
	admin.Patch("/product-groups/:id", controllers.UpdateProductGroup)
	admin.Delete("/product-groups/:id", controllers.DeleteProductGroup)
	admin.Post("/product-groups/:id/products", controllers.AssignProductsToGroup)
	admin.Delete("/product-groups/:id/products/:productId", controllers.RemoveProductFromGroup)

	// PRODUCT
	admin.Post("/products/sync/:provider", controllers.SyncAllProducts)
	admin.Patch("/products/bulk", controllers.BulkUpdateProducts)
	admin.Put("/products/:id/image", controllers.UpdateProductImage)
	// Route CRUD Biasa
	admin.Put("/products/:id", controllers.UpdateProduct)

	// BANNER
	admin.Get("/banners", controllers.GetAdminBanners)     // Buat Admin liat list
	admin.Post("/banners", controllers.CreateBanner)       // Buat Tambah
	admin.Delete("/banners/:id", controllers.DeleteBanner) // Buat Hapus
	admin.Put("/banners/:id", controllers.UpdateBanner)

	// TRANSACTION
	admin.Get("/transactions", controllers.GetTransactions)
	admin.Get("/manual-orders/running", controllers.GetRunningManualOrders)
	admin.Get("/manual-order/:id/status", controllers.GetManualOrderStatus)
	admin.Post("/manual-order", controllers.ManualOrder)
	admin.Post("/manual-order/:id/execute", controllers.ExecuteManualOrderProvider)
	admin.Post("/manual-order/:id/check-provider-status", controllers.CheckManualOrderProviderStatus)
	admin.Post("/transactions/:id/retry", controllers.RetryTransaction)

	// SETTINGS
	admin.Get("/settings", controllers.GetSettings)
	admin.Put("/settings", controllers.UpdateSettings)

	// PENDING PRODUCTS (Staging Area)
	admin.Get("/products/pending", controllers.GetPendingProducts)
	admin.Post("/products/approve", controllers.ApprovePendingProduct)

}
