package controllers

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
)

type productSyncProviderResult struct {
	Provider       string   `json:"provider"`
	Total          int      `json:"total"`
	Active         int      `json:"active"`
	UnmappedBrands []string `json:"unmapped_brands"`
}

type productSyncJob struct {
	ID        string                      `json:"id"`
	Provider  string                      `json:"provider"`
	Status    string                      `json:"status"`
	Stage     string                      `json:"stage"`
	Progress  int                         `json:"progress"`
	Processed int                         `json:"processed"`
	Total     int                         `json:"total"`
	Error     string                      `json:"error,omitempty"`
	Results   []productSyncProviderResult `json:"results,omitempty"`
	CreatedAt time.Time                   `json:"created_at"`
	UpdatedAt time.Time                   `json:"updated_at"`
}

var productSyncJobs = struct {
	sync.RWMutex
	items map[string]productSyncJob
}{items: make(map[string]productSyncJob)}

func newProductSyncJobID() (string, error) {
	randomBytes := make([]byte, 12)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(randomBytes), nil
}

func updateProductSyncJob(
	jobID string,
	stage string,
	progress int,
	processed int,
	total int,
) {
	productSyncJobs.Lock()
	defer productSyncJobs.Unlock()

	job, exists := productSyncJobs.items[jobID]
	if !exists || job.Status != "running" {
		return
	}
	if progress < 0 {
		progress = 0
	}
	if progress > 99 {
		progress = 99
	}
	job.Stage = stage
	job.Progress = progress
	job.Processed = processed
	job.Total = total
	job.UpdatedAt = time.Now()
	productSyncJobs.items[jobID] = job
}

func completeProductSyncJob(jobID string, results []productSyncProviderResult) {
	productSyncJobs.Lock()
	defer productSyncJobs.Unlock()

	job, exists := productSyncJobs.items[jobID]
	if !exists {
		return
	}
	job.Status = "completed"
	job.Stage = "Sinkronisasi selesai"
	job.Progress = 100
	job.Processed = job.Total
	job.Results = results
	job.UpdatedAt = time.Now()
	productSyncJobs.items[jobID] = job
}

func failProductSyncJob(jobID string, err error) {
	productSyncJobs.Lock()
	defer productSyncJobs.Unlock()

	job, exists := productSyncJobs.items[jobID]
	if !exists {
		return
	}
	job.Status = "failed"
	job.Stage = "Sinkronisasi gagal"
	job.Error = err.Error()
	job.UpdatedAt = time.Now()
	productSyncJobs.items[jobID] = job
}

func digiflazzJobReporter(jobID string, baseProgress, progressSpan int) DigiflazzSyncProgressReporter {
	return func(stage string, processed, total int) {
		stageProgress := 0
		stageLabel := "Menyiapkan sinkronisasi Digiflazz"
		switch stage {
		case "fetching_price_list":
			stageProgress = 5
			stageLabel = "Mengambil price list Digiflazz"
		case "validating_snapshot":
			stageProgress = 15
			stageLabel = "Memvalidasi snapshot Digiflazz"
		case "updating_products":
			stageProgress = 20
			if total > 0 {
				stageProgress += 70 * processed / total
			}
			stageLabel = "Memperbarui produk Digiflazz"
		case "finalizing":
			stageProgress = 95
			stageLabel = "Menyelesaikan sinkronisasi Digiflazz"
		}

		overallProgress := baseProgress + stageProgress*progressSpan/100
		updateProductSyncJob(jobID, stageLabel, overallProgress, processed, total)
	}
}

func runProductSyncJob(jobID, provider string, digiflazzLease *digiflazzSyncLease) {
	defer func() {
		if recovered := recover(); recovered != nil {
			failProductSyncJob(jobID, fmt.Errorf("proses sinkronisasi berhenti: %v", recovered))
		}
	}()

	results := make([]productSyncProviderResult, 0, 2)

	if provider == "all" || provider == "digiflazz" {
		progressSpan := 95
		if provider == "all" {
			progressSpan = 75
		}
		total, active, unmapped, err := runDigiflazzSyncWithLease(
			digiflazzLease,
			digiflazzJobReporter(jobID, 0, progressSpan),
		)
		if err != nil {
			failProductSyncJob(jobID, err)
			return
		}
		results = append(results, productSyncProviderResult{
			Provider:       "digiflazz",
			Total:          total,
			Active:         active,
			UnmappedBrands: unmapped,
		})
	}

	if provider == "all" || provider == "apigames" {
		baseProgress := 5
		if provider == "all" {
			baseProgress = 78
		}
		updateProductSyncJob(
			jobID,
			"Mengambil dan memperbarui produk ApiGames",
			baseProgress,
			0,
			0,
		)
		total, active, unmapped, err := RunApiGamesSync()
		if err != nil {
			failProductSyncJob(jobID, err)
			return
		}
		results = append(results, productSyncProviderResult{
			Provider:       "apigames",
			Total:          total,
			Active:         active,
			UnmappedBrands: unmapped,
		})
	}

	completeProductSyncJob(jobID, results)
}

func StartProductSyncJob(c *fiber.Ctx) error {
	provider := strings.ToLower(strings.TrimSpace(c.Params("provider")))
	if provider != "all" && provider != "digiflazz" && provider != "apigames" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Provider sinkronisasi tidak dikenal",
		})
	}

	var digiflazzLease *digiflazzSyncLease
	if provider == "all" || provider == "digiflazz" {
		var err error
		digiflazzLease, err = digiflazzCoordinator.Start("manual")
		if err != nil {
			if errors.Is(err, ErrDigiflazzSyncInProgress) || errors.Is(err, ErrDigiflazzSyncCooldown) {
				return digiflazzSyncRejectionResponse(c, err)
			}
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": err.Error(),
			})
		}
	}

	jobID, err := newProductSyncJobID()
	if err != nil {
		_ = digiflazzCoordinator.Finish(
			digiflazzLease,
			fmt.Errorf("gagal membuat ID sinkronisasi: %w", err),
			false,
		)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal membuat ID sinkronisasi",
		})
	}

	now := time.Now()
	productSyncJobs.Lock()
	for existingJobID, existingJob := range productSyncJobs.items {
		if now.Sub(existingJob.UpdatedAt) > 24*time.Hour {
			delete(productSyncJobs.items, existingJobID)
		}
	}
	productSyncJobs.items[jobID] = productSyncJob{
		ID:        jobID,
		Provider:  provider,
		Status:    "running",
		Stage:     "Menunggu proses sinkronisasi",
		Progress:  1,
		CreatedAt: now,
		UpdatedAt: now,
	}
	productSyncJobs.Unlock()

	go runProductSyncJob(jobID, provider, digiflazzLease)

	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
		"job_id": jobID,
		"status": "running",
	})
}

func GetProductSyncJob(c *fiber.Ctx) error {
	jobID := strings.TrimSpace(c.Params("id"))
	productSyncJobs.RLock()
	job, exists := productSyncJobs.items[jobID]
	productSyncJobs.RUnlock()
	if !exists {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Proses sinkronisasi tidak ditemukan",
		})
	}

	return c.JSON(job)
}
