package controllers

import (
	"errors"
	"testing"
	"time"

	"github.com/derry/anggijajan-v2-backend/models"
)

type memoryProviderSyncStateStore struct {
	state models.ProviderSyncState
}

func (store *memoryProviderSyncStateStore) Load(provider string) (models.ProviderSyncState, error) {
	if store.state.Provider == "" {
		return models.ProviderSyncState{Provider: provider}, nil
	}
	return store.state, nil
}

func (store *memoryProviderSyncStateStore) Save(state models.ProviderSyncState) error {
	store.state = state
	return nil
}

func (store *memoryProviderSyncStateStore) ResetRunning(provider string, finishedAt time.Time) error {
	if store.state.Provider == provider && store.state.Running {
		store.state.Running = false
		store.state.Source = ""
		store.state.LastFinishedAt = &finishedAt
		store.state.LastError = "Sinkronisasi sebelumnya terhenti saat backend restart."
	}
	return nil
}

func newTestDigiflazzCoordinator(
	now *time.Time,
	store *memoryProviderSyncStateStore,
) *digiflazzSyncCoordinator {
	return newDigiflazzSyncCoordinator(
		store,
		func() time.Time { return *now },
		func() time.Duration { return 5 * time.Minute },
	)
}

func TestDigiflazzCoordinatorAllowsManualStartWhenIdle(t *testing.T) {
	now := time.Date(2026, 8, 4, 1, 0, 0, 0, time.UTC)
	store := &memoryProviderSyncStateStore{}
	coordinator := newTestDigiflazzCoordinator(&now, store)

	lease, err := coordinator.Start("manual")
	if err != nil || lease == nil {
		t.Fatalf("Start(manual) lease = %#v, error = %v", lease, err)
	}
	if !store.state.Running || store.state.Source != "manual" {
		t.Fatalf("state after start = %#v", store.state)
	}
}

func TestDigiflazzCoordinatorRejectsSecondManualWhileRunning(t *testing.T) {
	now := time.Date(2026, 8, 4, 1, 0, 0, 0, time.UTC)
	coordinator := newTestDigiflazzCoordinator(&now, &memoryProviderSyncStateStore{})
	if _, err := coordinator.Start("manual"); err != nil {
		t.Fatal(err)
	}
	if _, err := coordinator.Start("manual"); !errors.Is(err, ErrDigiflazzSyncInProgress) {
		t.Fatalf("second Start(manual) error = %v", err)
	}
}

func TestDigiflazzCoordinatorRejectsCronWhileManualRunningWithoutProviderCall(t *testing.T) {
	now := time.Date(2026, 8, 4, 1, 0, 0, 0, time.UTC)
	coordinator := newTestDigiflazzCoordinator(&now, &memoryProviderSyncStateStore{})
	if _, err := coordinator.Start("manual"); err != nil {
		t.Fatal(err)
	}

	providerCalls := 0
	if _, err := coordinator.Start("cron"); err == nil {
		providerCalls++
	} else if !errors.Is(err, ErrDigiflazzSyncInProgress) {
		t.Fatalf("Start(cron) error = %v", err)
	}
	if providerCalls != 0 {
		t.Fatalf("providerCalls = %d, want 0", providerCalls)
	}
}

func TestDigiflazzCoordinatorRejectsManualDuringCooldown(t *testing.T) {
	now := time.Date(2026, 8, 4, 1, 0, 0, 0, time.UTC)
	coordinator := newTestDigiflazzCoordinator(&now, &memoryProviderSyncStateStore{})
	lease, err := coordinator.Start("manual")
	if err != nil {
		t.Fatal(err)
	}
	if err := coordinator.Finish(lease, nil, true); err != nil {
		t.Fatal(err)
	}
	if _, err := coordinator.Start("manual"); !errors.Is(err, ErrDigiflazzSyncCooldown) {
		t.Fatalf("Start(manual) during cooldown error = %v", err)
	}
}

func TestDigiflazzCoordinatorRejectsCronDuringCooldownWithoutProviderCall(t *testing.T) {
	now := time.Date(2026, 8, 4, 1, 0, 0, 0, time.UTC)
	coordinator := newTestDigiflazzCoordinator(&now, &memoryProviderSyncStateStore{})
	lease, err := coordinator.Start("manual")
	if err != nil {
		t.Fatal(err)
	}
	if err := coordinator.Finish(lease, nil, true); err != nil {
		t.Fatal(err)
	}

	providerCalls := 0
	if _, err := coordinator.Start("cron"); err == nil {
		providerCalls++
	} else if !errors.Is(err, ErrDigiflazzSyncCooldown) {
		t.Fatalf("Start(cron) error = %v", err)
	}
	if providerCalls != 0 {
		t.Fatalf("providerCalls = %d, want 0", providerCalls)
	}
}

func TestDigiflazzCoordinatorSuccessfulFinishSetsCooldown(t *testing.T) {
	now := time.Date(2026, 8, 4, 1, 0, 0, 0, time.UTC)
	store := &memoryProviderSyncStateStore{}
	coordinator := newTestDigiflazzCoordinator(&now, store)
	lease, err := coordinator.Start("manual")
	if err != nil {
		t.Fatal(err)
	}
	now = now.Add(10 * time.Second)
	if err := coordinator.Finish(lease, nil, true); err != nil {
		t.Fatal(err)
	}
	if store.state.Running || store.state.LastSuccessAt == nil || store.state.CooldownUntil == nil {
		t.Fatalf("state after successful finish = %#v", store.state)
	}
}

func TestDigiflazzCoordinatorProviderRC83SetsErrorAndCooldown(t *testing.T) {
	now := time.Date(2026, 8, 4, 1, 0, 0, 0, time.UTC)
	store := &memoryProviderSyncStateStore{}
	coordinator := newTestDigiflazzCoordinator(&now, store)
	lease, err := coordinator.Start("manual")
	if err != nil {
		t.Fatal(err)
	}
	rc83 := errors.New("Digiflazz menolak price list (RC 83): limitasi pengecekan pricelist")
	if err := coordinator.Finish(lease, rc83, true); err != nil {
		t.Fatal(err)
	}
	if store.state.Running || store.state.LastError != rc83.Error() || store.state.CooldownUntil == nil {
		t.Fatalf("state after RC 83 = %#v", store.state)
	}
}

func TestDigiflazzCoordinatorPreRequestErrorDoesNotStartCooldown(t *testing.T) {
	now := time.Date(2026, 8, 4, 1, 0, 0, 0, time.UTC)
	store := &memoryProviderSyncStateStore{}
	coordinator := newTestDigiflazzCoordinator(&now, store)
	lease, err := coordinator.Start("manual")
	if err != nil {
		t.Fatal(err)
	}
	if err := coordinator.Finish(lease, errors.New("credential kosong"), false); err != nil {
		t.Fatal(err)
	}
	if store.state.CooldownUntil != nil {
		t.Fatalf("CooldownUntil = %v, want nil", store.state.CooldownUntil)
	}
}

func TestDigiflazzCoordinatorResetsStalePersistedRunning(t *testing.T) {
	now := time.Date(2026, 8, 4, 1, 0, 0, 0, time.UTC)
	cooldownUntil := now.Add(2 * time.Minute)
	store := &memoryProviderSyncStateStore{state: models.ProviderSyncState{
		Provider:      digiflazzProvider,
		Running:       true,
		Source:        "cron",
		CooldownUntil: &cooldownUntil,
	}}
	coordinator := newTestDigiflazzCoordinator(&now, store)
	if err := coordinator.ResetStaleRunning(); err != nil {
		t.Fatal(err)
	}
	if store.state.Running || store.state.Source != "" {
		t.Fatalf("stale state was not reset: %#v", store.state)
	}
	if store.state.CooldownUntil == nil || !store.state.CooldownUntil.Equal(cooldownUntil) {
		t.Fatalf("cooldown was not preserved: %#v", store.state)
	}
}

func TestDigiflazzSyncRetryAfterNeverNegative(t *testing.T) {
	now := time.Date(2026, 8, 4, 1, 0, 0, 0, time.UTC)
	past := now.Add(-time.Minute)
	status := syncStatusFromState(models.ProviderSyncState{
		Provider:      digiflazzProvider,
		CooldownUntil: &past,
	}, now)
	if status.RetryAfterSeconds != 0 {
		t.Fatalf("RetryAfterSeconds = %d, want 0", status.RetryAfterSeconds)
	}
}
