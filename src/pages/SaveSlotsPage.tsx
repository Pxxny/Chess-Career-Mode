import { ImportBackup } from "@/features/career/ImportBackup";
import { InstallSuggestion } from "@/features/install/InstallSuggestion";
import { useCallback, useEffect, useState } from "react";
import { LanguageSelector } from "@/i18n/LanguageSelector";
import { CharacterPortrait } from "@/components/game/CharacterPortrait";
import { Button, Card, Modal } from "@/components/ui";
import { GAME_CONFIG } from "@/data/config";
import { getCountry } from "@/data/world/countries";
import { useGameStore } from "@/store/gameStore";
import { slotManager, type SlotState } from "@/store/saveSlots";
import { useSlotUi } from "@/store/slotUi";
import { formatMoney } from "@/utils/format";

/** Shown while no character is open: up to GAME_CONFIG.saveSlots characters, each a separate career. */
export function SaveSlotsPage() {
  const selectSlot = useGameStore((s) => s.selectSlot);
  const deleteSlot = useGameStore((s) => s.deleteSlot);
  const startCreating = useSlotUi((s) => s.startCreating);
  const [slots, setSlots] = useState<SlotState[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<SlotState | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSlots(await slotManager.listSlots());
    } catch {
      setError("The saved characters could not be read from this browser.");
      setSlots([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const open = async (slot: number) => {
    setBusy(slot);
    setError(null);
    const ok = await selectSlot(slot).catch(() => false);
    // On success the game replaces this screen, so only a failure needs the page again.
    if (!ok) {
      setError("This character could not be opened. Its save may be damaged.");
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    const { slot } = toDelete;
    setToDelete(null);
    setBusy(slot);
    setError(null);
    try {
      await deleteSlot(slot);
    } catch {
      setError("The character could not be deleted. Please try again.");
    }
    setBusy(null);
    await refresh();
  };

  const deleteName =
    toDelete?.kind === "character"
      ? toDelete.summary.name
      : `slot ${toDelete?.slot ?? ""}`;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <InstallSuggestion />
      <div className="mb-4 flex justify-end">
        <LanguageSelector />
      </div>
      <p className="font-display text-3xl font-bold text-gold-400">
        {GAME_CONFIG.appName}
      </p>
      <h1 className="mt-1 font-display text-2xl font-bold text-ink">
        Your characters
      </h1>
      <p className="mb-6 mt-1 text-ink-muted">
        Keep up to {GAME_CONFIG.saveSlots} characters. Each one has its own
        career, NPC world and progress, saved automatically in this browser.
      </p>

      <ImportBackup onImported={refresh} />
      {error && (
        <p role="alert" className="mb-4 text-sm text-red-300">
          {error}
        </p>
      )}

      {slots === null ? (
        <p role="status" className="text-sm text-ink-muted">
          Loading your characters…
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {slots.map((state) => (
            <li key={state.slot}>
              <Card aria-label={`Character slot ${state.slot}`}>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                  Slot {state.slot}
                </p>

                {state.kind === "character" && (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-4">
                      <CharacterPortrait
                        appearance={state.summary.appearance}
                        label={`${state.summary.name} portrait`}
                        className="h-16 w-16 shrink-0 border-2 border-gold-500/60"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-display text-lg font-bold text-ink">
                          <span translate="no">{state.summary.name}</span>
                        </p>
                        <p className="truncate text-sm text-ink-muted">
                          <span aria-hidden>
                            {getCountry(state.summary.countryCode)?.flag}
                          </span>{" "}
                          {state.summary.cityName}
                          {getCountry(state.summary.countryCode)
                            ? `, ${getCountry(state.summary.countryCode)?.name}`
                            : ""}
                        </p>
                        <p className="text-sm tabular-nums text-ink-muted">
                          Age {state.summary.age} · Elo{" "}
                          <span className="font-semibold text-gold-400">
                            {state.summary.rating}
                          </span>{" "}
                          (peak {state.summary.peakRating}) ·{" "}
                          {formatMoney(state.summary.money)}
                        </p>
                        <p className="text-xs tabular-nums text-ink-faint">
                          Week {state.summary.week}, {state.summary.year} ·
                          career started {state.summary.startYear}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        onClick={() => open(state.slot)}
                        disabled={busy !== null}
                      >
                        {busy === state.slot ? "Opening…" : "Continue"}
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => setToDelete(state)}
                        disabled={busy !== null}
                        aria-label={`Delete ${state.summary.name}`}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )}

                {state.kind === "empty" && (
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm text-ink-muted">Empty slot</p>
                    <Button
                      onClick={() => startCreating(state.slot)}
                      disabled={busy !== null}
                    >
                      New character
                    </Button>
                  </div>
                )}

                {state.kind === "broken" && (
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm text-red-300">
                      This save could not be read.
                    </p>
                    <Button
                      variant="danger"
                      onClick={() => setToDelete(state)}
                      disabled={busy !== null}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={toDelete !== null}
        title="Delete this character?"
        onClose={() => setToDelete(null)}
      >
        <p className="text-sm text-ink-muted">
          {deleteName} and the whole NPC world of this career will be deleted
          from this browser. This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setToDelete(null)}>
            Keep character
          </Button>
          <Button variant="danger" onClick={remove}>
            Delete character
          </Button>
        </div>
      </Modal>
    </main>
  );
}
