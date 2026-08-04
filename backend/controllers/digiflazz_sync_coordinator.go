package controllers

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/derry/anggijajan-v2-backend/database"
	"github.com/derry/anggijajan-v2-backend/models"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

const (
	digiflazzProvider               = "digiflazz"
	defaultDigiflazzCooldownSeconds = 300
)

var (
	ErrDigiflazzSyncInProgress = errors.New("sinkronisasi Digiflazz sedang berjalan")
	ErrDigiflazzSyncCooldown   = errors.New("sinkronisasi Digiflazz masih dalam masa tunggu")
)

type DigiflazzSyncStatus struct {
	Provider          string     `json:"provider"`
	Running           bool       `json:"running"`
	Source            string     `json:"source"`
	LastStartedAt     *time.Time `json:"last_started_at"`
	LastFinishedAt    *time.Time `json:"last_finished_at"`
	LastSuccessAt     *time.Time `json:"last_success_at"`
	LastError         string     `json:"last_error,omitempty"`
	CooldownUntil     *time.Time `json:"cooldown_until"`
	RetryAfterSeconds int64      `json:"retry_after_seconds"`
}

type digiflazzSyncLease struct {
	startedAt time.Time
}

type providerSyncStateStore interface {
	Load(provider string) (models.ProviderSyncState, error)
	Save(state models.ProviderSyncState) error
	ResetRunning(provider string, finishedAt time.Time) error
}

type gormProviderSyncStateStore struct{}

func (gormProviderSyncStateStore) Load(provider string) (models.ProviderSyncState, error) {
	var state models.ProviderSyncState
	err := database.DB.Where("provider = ?", provider).First(&state).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return models.ProviderSyncState{Provider: provider}, nil
	}
	return state, err
}

func (gormProviderSyncStateStore) Save(state models.ProviderSyncState) error {
	return database.DB.Save(&state).Error
}

func (gormProviderSyncStateStore) ResetRunning(provider string, finishedAt time.Time) error {
	return database.DB.Model(&models.ProviderSyncState{}).
		Where("provider = ? AND running = ?", provider, true).
		Updates(map[string]interface{}{
			"running":          false,
			"source":           "",
			"last_finished_at": finishedAt,
			"last_error":       "Sinkronisasi sebelumnya terhenti saat backend restart.",
		}).Error
}

type digiflazzSyncCoordinator struct {
	mu       sync.Mutex
	store    providerSyncStateStore
	now      func() time.Time
	cooldown func() time.Duration
}

func newDigiflazzSyncCoordinator(
	store providerSyncStateStore,
	now func() time.Time,
	cooldown func() time.Duration,
) *digiflazzSyncCoordinator {
	return &digiflazzSyncCoordinator{store: store, now: now, cooldown: cooldown}
}

func configuredDigiflazzCooldown() time.Duration {
	raw := strings.TrimSpace(os.Getenv("DIGIFLAZZ_PRICELIST_COOLDOWN_SECONDS"))
	seconds, err := strconv.ParseInt(raw, 10, 64)
	if raw == "" || err != nil || seconds < 0 {
		seconds = defaultDigiflazzCooldownSeconds
	}
	return time.Duration(seconds) * time.Second
}

var digiflazzCoordinator = newDigiflazzSyncCoordinator(
	gormProviderSyncStateStore{},
	func() time.Time { return time.Now().UTC() },
	configuredDigiflazzCooldown,
)

func syncStatusFromState(state models.ProviderSyncState, now time.Time) DigiflazzSyncStatus {
	retryAfter := int64(0)
	if state.CooldownUntil != nil && now.Before(*state.CooldownUntil) {
		// Use ceiling semantics without depending on the wall clock used by tests.
		difference := state.CooldownUntil.Sub(now)
		retryAfter = int64((difference + time.Second - 1) / time.Second)
	}
	if retryAfter < 0 {
		retryAfter = 0
	}

	return DigiflazzSyncStatus{
		Provider:          digiflazzProvider,
		Running:           state.Running,
		Source:            state.Source,
		LastStartedAt:     utcTimePointer(state.LastStartedAt),
		LastFinishedAt:    utcTimePointer(state.LastFinishedAt),
		LastSuccessAt:     utcTimePointer(state.LastSuccessAt),
		LastError:         state.LastError,
		CooldownUntil:     utcTimePointer(state.CooldownUntil),
		RetryAfterSeconds: retryAfter,
	}
}

func utcTimePointer(value *time.Time) *time.Time {
	if value == nil {
		return nil
	}
	utcValue := value.UTC()
	return &utcValue
}

func (coordinator *digiflazzSyncCoordinator) Status() (DigiflazzSyncStatus, error) {
	coordinator.mu.Lock()
	defer coordinator.mu.Unlock()

	state, err := coordinator.store.Load(digiflazzProvider)
	if err != nil {
		return DigiflazzSyncStatus{}, err
	}
	return syncStatusFromState(state, coordinator.now()), nil
}

func (coordinator *digiflazzSyncCoordinator) Start(source string) (*digiflazzSyncLease, error) {
	coordinator.mu.Lock()
	defer coordinator.mu.Unlock()

	now := coordinator.now()
	state, err := coordinator.store.Load(digiflazzProvider)
	if err != nil {
		return nil, fmt.Errorf("gagal membaca status sync Digiflazz: %w", err)
	}
	if state.Running {
		return nil, ErrDigiflazzSyncInProgress
	}
	if state.CooldownUntil != nil && now.Before(*state.CooldownUntil) {
		return nil, ErrDigiflazzSyncCooldown
	}

	startedAt := now
	state.Provider = digiflazzProvider
	state.Running = true
	state.Source = source
	state.LastStartedAt = &startedAt
	state.LastError = ""
	if err := coordinator.store.Save(state); err != nil {
		return nil, fmt.Errorf("gagal menyimpan status mulai sync Digiflazz: %w", err)
	}
	return &digiflazzSyncLease{startedAt: startedAt}, nil
}

func (coordinator *digiflazzSyncCoordinator) Finish(
	lease *digiflazzSyncLease,
	syncErr error,
	providerRequestSent bool,
) error {
	if lease == nil {
		return nil
	}

	coordinator.mu.Lock()
	defer coordinator.mu.Unlock()

	now := coordinator.now()
	state, err := coordinator.store.Load(digiflazzProvider)
	if err != nil {
		return fmt.Errorf("gagal membaca status akhir sync Digiflazz: %w", err)
	}

	state.Provider = digiflazzProvider
	state.Running = false
	state.Source = ""
	state.LastFinishedAt = &now
	if syncErr != nil {
		state.LastError = syncErr.Error()
	} else {
		state.LastError = ""
		state.LastSuccessAt = &now
	}
	if providerRequestSent {
		cooldownUntil := now.Add(coordinator.cooldown())
		state.CooldownUntil = &cooldownUntil
	}

	if err := coordinator.store.Save(state); err != nil {
		return fmt.Errorf("gagal menyimpan status akhir sync Digiflazz: %w", err)
	}
	return nil
}

func (coordinator *digiflazzSyncCoordinator) ResetStaleRunning() error {
	coordinator.mu.Lock()
	defer coordinator.mu.Unlock()
	return coordinator.store.ResetRunning(digiflazzProvider, coordinator.now())
}

func InitializeDigiflazzSyncCoordinator() error {
	return digiflazzCoordinator.ResetStaleRunning()
}

func CurrentDigiflazzSyncStatus() (DigiflazzSyncStatus, error) {
	return digiflazzCoordinator.Status()
}

func GetDigiflazzSyncStatus(c *fiber.Ctx) error {
	status, err := digiflazzCoordinator.Status()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Status sinkronisasi Digiflazz gagal dimuat.",
		})
	}
	return c.JSON(status)
}

func digiflazzSyncRejectionResponse(c *fiber.Ctx, err error) error {
	status, statusErr := digiflazzCoordinator.Status()
	if statusErr != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Status sinkronisasi Digiflazz gagal dimuat.",
		})
	}

	if errors.Is(err, ErrDigiflazzSyncInProgress) {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error":               "Sinkronisasi Digiflazz sedang berjalan.",
			"status":              "running",
			"source":              status.Source,
			"retry_after_seconds": int64(0),
		})
	}
	if errors.Is(err, ErrDigiflazzSyncCooldown) {
		return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
			"error":               "Sinkronisasi Digiflazz masih dalam masa tunggu.",
			"status":              "cooldown",
			"retry_after_seconds": status.RetryAfterSeconds,
			"cooldown_until":      status.CooldownUntil,
		})
	}
	return nil
}
