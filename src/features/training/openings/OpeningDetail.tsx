import { useMemo, useState } from "react";
import { Badge, Button, Card } from "@/components/ui";
import { toFen } from "@/game/chess/board";
import { gameFromSans } from "@/game/chess/rules";
import { numbered, type OpeningDatabase } from "@/game/openings/database";
import { SITUATIONS, fitsSituation } from "@/game/openings/situations";
import { collectOpeningGames, perfForEntry } from "@/game/openings/stats";
import { ERA_LABELS, type OpeningEntry } from "@/game/openings/types";
import { useSave } from "@/hooks/useGame";
import { useGameStore } from "@/store/gameStore";
import type { SituationId } from "@/types";
import { PositionBoard } from "../PositionBoard";

const DIFFICULTY = ["", "Very easy", "Easy", "Moderate", "Hard", "Very hard"];
const POPULARITY = [
  "",
  "Rare",
  "Uncommon",
  "Played",
  "Popular",
  "Very popular",
];

/** Five-step meter with text, so the value is never shown by the bar alone */
export function Meter({
  value,
  max = 5,
  label,
  text,
}: {
  value: number;
  max?: number;
  label: string;
  text: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-ink-muted">
        <span>{label}</span>
        <span className="font-semibold text-ink">{text}</span>
      </div>
      <div
        role="img"
        aria-label={`${label}: ${text}`}
        className="mt-1 flex gap-1"
      >
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className={`h-2 flex-1 rounded-full ${i < value ? "bg-gold-500" : "bg-navy-600"}`}
          />
        ))}
      </div>
    </div>
  );
}

export function OpeningDetail({
  db,
  entry,
  onSelect,
}: {
  db: OpeningDatabase;
  entry: OpeningEntry;
  onSelect: (id: string) => void;
}) {
  const save = useSave();
  const setPreference = useGameStore((s) => s.setPreference);
  const [ply, setPly] = useState(entry.moves.length);
  const [situation, setSituation] = useState<SituationId>(
    entry.side === "white" ? "white" : "black",
  );
  const [lastEntry, setLastEntry] = useState(entry.id);
  if (lastEntry !== entry.id) {
    setLastEntry(entry.id);
    setPly(entry.moves.length);
  }

  const game = useMemo(() => gameFromSans(entry.moves), [entry]);
  const family = db.familyByName.get(entry.family);
  const main = family ? db.byId.get(family.mainLineId) : null;
  const children = db.children(entry.id);
  const perf = useMemo(
    () => perfForEntry(db, collectOpeningGames(save, db), entry),
    [db, save, entry],
  );
  const fits = SITUATIONS.filter((s) => fitsSituation(s, entry));
  const chosen = fits.find((s) => s.id === situation) ?? fits[0];
  const already = chosen
    ? save.repertoire.preferences[chosen.id]?.includes(entry.id)
    : false;
  const position = game.positions[Math.min(ply, game.positions.length - 1)];

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold tracking-wide text-gold-400">
            {entry.eco}
            {entry.source === "custom" ? " · IMPORTED" : ""}
          </p>
          <h3 className="font-display text-xl font-bold text-ink">
            <span translate="no">{entry.name}</span>
          </h3>
        </div>
        <Badge tone="gold">
          {entry.side === "white" ? "Played by White" : "Played by Black"}
        </Badge>
      </div>
      <p className="mt-2 text-sm text-ink-muted">{entry.description}</p>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        <div>
          <PositionBoard
            fen={toFen(position)}
            perspective={entry.side}
            label={`${entry.name} after ${ply} half-moves`}
          />
          <div className="mt-2 flex justify-center gap-2">
            {(
              [
                ["⏮", "Start", () => setPly(0)],
                ["◀", "Back", () => setPly(Math.max(0, ply - 1))],
                [
                  "▶",
                  "Forward",
                  () => setPly(Math.min(entry.moves.length, ply + 1)),
                ],
                ["⏭", "End", () => setPly(entry.moves.length)],
              ] as const
            ).map(([g, l, f]) => (
              <button
                key={l}
                type="button"
                aria-label={l}
                onClick={f}
                className="h-10 w-10 rounded-lg border border-white/10 bg-navy-700 text-ink hover:bg-navy-600"
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
              Move sequence
            </p>
            <p className="font-mono text-sm text-ink">
              {numbered(entry.moves, 40)}
            </p>
          </div>
          {main && main.id !== entry.id && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
                Main line of the {entry.family}
              </p>
              <button
                type="button"
                onClick={() => onSelect(main.id)}
                className="text-left text-sm text-gold-300 hover:underline"
              >
                {main.name}:{" "}
                <span className="font-mono">{numbered(main.moves, 20)}</span>
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Meter
              value={entry.difficulty}
              label="Difficulty"
              text={DIFFICULTY[entry.difficulty]}
            />
            <Meter
              value={entry.popularity}
              label="Popularity"
              text={POPULARITY[entry.popularity]}
            />
          </div>
          <p className="text-xs text-ink-faint">
            {entry.estimated
              ? "Popularity, difficulty and eras are editorial estimates. Import a game collection in the Import tab to replace popularity with real counts."
              : `Popularity counted from ${entry.usage?.source}.`}
          </p>

          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-muted">
              Historical usage{entry.estimated ? " (estimated)" : ""}
            </p>
            <ul className="space-y-1">
              {ERA_LABELS.map((era, i) => (
                <li
                  key={era}
                  className="flex items-center gap-2 text-xs text-ink-muted"
                >
                  <span className="w-24 shrink-0">{era}</span>
                  <span
                    role="img"
                    aria-label={`${entry.eras[i]} out of 5`}
                    className="flex h-2 flex-1 overflow-hidden rounded-full bg-navy-600"
                  >
                    <span
                      className="bg-gold-500"
                      style={{ width: `${(entry.eras[i] / 5) * 100}%` }}
                    />
                  </span>
                  <span className="w-8 text-right tabular-nums">
                    {entry.eras[i]}/5
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {entry.usage && (
            <p className="text-sm text-ink-muted">
              In {entry.usage.source}: {entry.usage.games.toLocaleString()}{" "}
              games · White {entry.usage.whiteWins.toLocaleString()} · draws{" "}
              {entry.usage.draws.toLocaleString()} · Black{" "}
              {entry.usage.blackWins.toLocaleString()}.
            </p>
          )}
          <p className="text-sm text-ink-muted">
            Your games:{" "}
            {perf.games === 0
              ? "none yet"
              : `${perf.games} (${perf.wins}W ${perf.draws}D ${perf.losses}L, ${perf.winRate}% wins)`}
            .
          </p>
        </div>
      </div>

      {children.length > 0 && (
        <div className="mt-4">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-muted">
            Variations ({children.length})
          </p>
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {children.slice(0, 24).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className="w-full truncate rounded px-2 py-1 text-left text-sm text-ink hover:bg-white/5"
                >
                  {c.eco} · {c.variation ?? c.name}
                </button>
              </li>
            ))}
          </ul>
          {children.length > 24 && (
            <p className="mt-1 text-xs text-ink-faint">
              And {children.length - 24} more. Search the family list to find
              them.
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-white/5 pt-4">
        <div className="min-w-0 max-w-full">
          <label
            htmlFor="pref-situation"
            className="mb-1 block text-xs font-semibold text-ink-muted"
          >
            Add to repertoire situation
          </label>
          <select
            id="pref-situation"
            value={chosen?.id ?? ""}
            onChange={(e) => setSituation(e.target.value as SituationId)}
            className="min-h-11 w-full max-w-full rounded-lg border border-white/10 bg-navy-900 px-3 text-sm text-ink"
          >
            {fits.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <Button
          disabled={!chosen || already}
          onClick={() =>
            chosen &&
            setPreference(chosen.id, [
              ...(save.repertoire.preferences[chosen.id] ?? []),
              entry.id,
            ])
          }
        >
          {already ? "Already preferred" : "Add to preferences"}
        </Button>
      </div>
    </Card>
  );
}
