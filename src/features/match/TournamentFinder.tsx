import { TOURNAMENT_CONTINENTS } from "@/game/competition/venues";
import { useState } from "react";
import { Button, Modal } from "@/components/ui";
import type { TournamentSearch } from "@/game/competition/finder";
export function TournamentFinder({
  initial,
  continent = "all",
  qualification = "all",
  rating,
  onApply,
  onClose,
}: {
  initial: TournamentSearch | null;
  continent?: string;
  qualification?: TournamentSearch["qualification"];
  rating: number;
  onApply: (search: TournamentSearch) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState<TournamentSearch>(
    initial ?? {
      fromWeek: 0,
      toWeek: 12,
      minElo: 0,
      maxElo: rating,
      continent,
      qualification,
      minPlayers: 2,
      maxPlayers: 256,
      availableOnly: true,
    },
  );
  const [error, setError] = useState("");
  const number = (
    key: keyof TournamentSearch,
    label: string,
    min: number,
    max: number,
  ) => (
    <label className="text-sm text-ink-muted">
      {label}
      <input
        type="number"
        aria-label={label}
        min={min}
        max={max}
        required
        value={
          typeof search[key] === "number" && Number.isNaN(search[key])
            ? ""
            : String(search[key])
        }
        onChange={(e) =>
          setSearch({
            ...search,
            [key]: e.target.value === "" ? NaN : Number(e.target.value),
          })
        }
        className="mt-1 w-full rounded-lg bg-navy-900 p-3 text-ink"
      />
    </label>
  );
  return (
    <Modal open title="Find a suitable tournament" onClose={onClose} size="lg">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (
            [
              search.fromWeek,
              search.toWeek,
              search.minElo,
              search.maxElo,
              search.minPlayers,
              search.maxPlayers,
            ].some((n) => !Number.isInteger(n)) ||
            search.fromWeek > search.toWeek ||
            search.minElo > search.maxElo ||
            search.minPlayers > search.maxPlayers
          ) {
            setError("Enter valid ranges: minimum must not exceed maximum.");
            return;
          }
          onApply(search);
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-3">
          {number("fromWeek", "Starts in at least (weeks)", 0, 52)}
          {number("toWeek", "Starts within (weeks)", 0, 52)}
          {number("minElo", "Minimum entry Elo from", 0, 3500)}
          {number("maxElo", "Minimum entry Elo up to", 0, 3500)}
          {number("minPlayers", "Participant limit from", 2, 256)}
          {number("maxPlayers", "Participant limit up to", 2, 256)}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm text-ink-muted">
            Organizer status
            <select
              aria-label="Organizer status"
              value={search.organizer ?? "all"}
              onChange={(e) =>
                setSearch({
                  ...search,
                  organizer: e.target.value as TournamentSearch["organizer"],
                })
              }
              className="mt-1 w-full rounded-lg bg-navy-900 p-3 text-ink"
            >
              <option value="all">Official & Unofficial</option>
              <option>Official</option>
              <option>Unofficial</option>
            </select>
          </label>
          <label className="text-sm text-ink-muted">
            Duration
            <select
              aria-label="Tournament duration"
              value={search.duration ?? "all"}
              onChange={(e) =>
                setSearch({
                  ...search,
                  duration: e.target.value as TournamentSearch["duration"],
                })
              }
              className="mt-1 w-full rounded-lg bg-navy-900 p-3 text-ink"
            >
              <option value="all">Any duration</option>
              <option value="single">Single day</option>
              <option value="multi">Multiple days</option>
              <option value="3">3 days</option>
              <option value="7">7 days</option>
            </select>
          </label>
          <label className="text-sm text-ink-muted">
            Pairing
            <select
              aria-label="Tournament pairing"
              value={search.pairing ?? "all"}
              onChange={(e) =>
                setSearch({
                  ...search,
                  pairing: e.target.value as TournamentSearch["pairing"],
                })
              }
              className="mt-1 w-full rounded-lg bg-navy-900 p-3 text-ink"
            >
              <option value="all">Any format</option>
              <option value="rotation">All-player rotation</option>
              <option value="bo3">BO3 per opponent</option>
            </select>
          </label>
        </div>
        <label className="block text-sm text-ink-muted">
          Continent
          <select
            aria-label="Tournament continent"
            value={search.continent}
            onChange={(e) =>
              setSearch({ ...search, continent: e.target.value })
            }
            className="mt-1 w-full rounded-lg bg-navy-900 p-3 text-ink"
          >
            {["all", ...TOURNAMENT_CONTINENTS].map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "All continents" : c}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-ink-muted">Qualification entry
          <select aria-label="Qualification entry" value={search.qualification ?? "all"} onChange={(e) => setSearch({ ...search, qualification: e.target.value as TournamentSearch["qualification"], availableOnly: false })} className="mt-1 w-full rounded-lg bg-navy-900 p-3 text-ink">
            <option value="all">All entry types</option><option value="required">Qualification required</option><option value="qualifier">Awards qualification</option><option value="circuit">Local → National → Continental → World</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={search.availableOnly}
            onChange={(e) =>
              setSearch({ ...search, availableOnly: e.target.checked })
            }
          />
          Only events I can enter now
        </label>
        <p className="text-xs text-ink-faint">Continent means the host country, not the player's nationality or the event name.</p>
        <p className="text-xs text-ink-faint">
          Elo range filters the published minimum entry requirement, not the
          opponents’ ratings. Availability includes seats, deadline,
          qualifications, funds and schedule conflicts.
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit">Find tournaments</Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
