import { CareerPredictionPanel } from "@/features/prediction/CareerPrediction";
import { useMatchRunning } from "@/store/matchLocks";
import { useMemo, useState } from "react";
import { Swords } from "lucide-react";
import { Badge, Button, Card, CardTitle } from "@/components/ui";
import { useSave } from "@/hooks/useGame";
import { useNpcs } from "@/hooks/useNpcs";
import { useOpeningDb } from "@/store/openingStore";
import { buildMatchSetup } from "@/game/match/setup";
import type { MatchSetup, Speed } from "@/game/match/session";
import {
  CATEGORY_LABEL,
  DEFAULT_TIME_CONTROL,
  PRESETS,
  customTimeControl,
  describeTimeControl,
  type TimeCategory,
} from "@/game/match/timeControls";
import { getCountry } from "@/data/world/countries";
import type { MatchTimeControl, Npc, PieceColor } from "@/types";
import { cn } from "@/utils/cn";

const SPEEDS: Array<{ id: Speed; label: string }> = [
  { id: "real", label: "Real time" },
  { id: "brisk", label: "Brisk" },
  { id: "fast", label: "Fast-forward" },
  { id: "max", label: "Instant" },
];

const Choice = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={cn(
      "rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
      active
        ? "border-gold-500 bg-gold-500/15 text-gold-300"
        : "border-white/10 bg-navy-900 text-ink-muted hover:text-ink",
    )}
  >
    {children}
  </button>
);

const npcLine = (n: Npc): string =>
  `${getCountry(n.nationality)?.flag ?? ""} ${n.name} · ${n.currentElo} · ${n.style}`;

/** Set up a game against any player of the world: colour, time control, rated or friendly, play or simulate. */
export function MatchSetupPanel({
  onStart,
}: {
  onStart: (setup: MatchSetup) => void;
}) {
  const save = useSave();
  const db = useOpeningDb();
  const running = useMatchRunning(save.career.id);
  const npcs = useNpcs();
  const [query, setQuery] = useState("");
  const [npcId, setNpcId] = useState<string | null>(null);
  const [color, setColor] = useState<"white" | "black" | "random">("random");
  const [category, setCategory] = useState<TimeCategory>("rapid");
  const [tc, setTc] = useState<MatchTimeControl>(DEFAULT_TIME_CONTROL);
  const [minutes, setMinutes] = useState("10");
  const [increment, setIncrement] = useState("5");
  const [rated, setRated] = useState(true);
  const [mode, setMode] = useState<"play" | "simulate">("play");
  const [speed, setSpeed] = useState<Speed>("brisk");

  const nearby = useMemo(
    () =>
      [...npcs]
        .filter((n) => n.careerStatus === "active")
        .sort(
          (a, b) =>
            Math.abs(a.currentElo - save.player.rating) -
            Math.abs(b.currentElo - save.player.rating),
        )
        .slice(0, 8),
    [npcs, save.player.rating],
  );
  const found = useMemo(
    () =>
      query.trim().length >= 2
        ? npcs
            .filter((n) =>
              n.name.toLowerCase().includes(query.trim().toLowerCase()),
            )
            .slice(0, 6)
        : [],
    [npcs, query],
  );
  const chosen = npcs.find((n) => n.id === npcId) ?? nearby[0] ?? null;

  const applyCustom = (m: string, i: string) => {
    const mm = Number(m);
    const ii = Number(i);
    if (
      Number.isFinite(mm) &&
      mm >= 0.25 &&
      mm <= 240 &&
      Number.isFinite(ii) &&
      ii >= 0 &&
      ii <= 180
    )
      setTc(customTimeControl(mm, ii));
  };

  const start = () => {
    if (!chosen || running) return;
    const playerColor: PieceColor =
      color === "random" ? (Math.random() < 0.5 ? "white" : "black") : color;
    onStart(
      buildMatchSetup({
        save,
        npc: chosen,
        playerColor,
        timeControl: tc,
        rated,
        mode,
        speed:
          mode === "simulate" ? (speed === "brisk" ? "fast" : speed) : speed,
        tournament: null,
        seed: Math.floor(Math.random() * 2 ** 31),
        db,
      }),
    );
  };

  return (
    <Card>
      <CardTitle>New game</CardTitle>
      <div className="space-y-5">
        <section>
          <h3 className="mb-2 text-sm font-semibold text-ink">Opponent</h3>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Opponents near your rating"
          >
            {nearby.map((n) => (
              <Choice
                key={n.id}
                active={chosen?.id === n.id}
                onClick={() => setNpcId(n.id)}
              >
                {npcLine(n)}
              </Choice>
            ))}
          </div>
          <input
            type="search"
            aria-label="Search players"
            placeholder="Search any player by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mt-3 w-full rounded-lg border border-white/10 bg-navy-900 px-3 py-2 text-sm text-ink placeholder:text-ink-faint"
          />
          {found.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {found.map((n) => (
                <Choice
                  key={n.id}
                  active={chosen?.id === n.id}
                  onClick={() => {
                    setNpcId(n.id);
                    setQuery("");
                  }}
                >
                  {npcLine(n)}
                </Choice>
              ))}
            </div>
          )}
          {chosen && (
            <p className="mt-2 text-xs text-ink-muted">
              Playing style: {chosen.style}. Strong in{" "}
              {chosen.strengths.join(", ") || "–"}; weak in{" "}
              {chosen.weaknesses.join(", ") || "–"}. Mood {chosen.morale}/100,
              form {chosen.form}/100.
            </p>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-ink">Colour</h3>
          <div className="flex gap-2">
            {(["white", "black", "random"] as const).map((c) => (
              <Choice key={c} active={color === c} onClick={() => setColor(c)}>
                {c === "random" ? "Random" : c === "white" ? "White" : "Black"}
              </Choice>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-ink">
            Time control{" "}
            <span className="font-normal text-ink-muted">
              · {describeTimeControl(tc)}
            </span>
          </h3>
          <div className="mb-2 flex flex-wrap gap-2">
            {(Object.keys(PRESETS) as TimeCategory[]).map((c) => (
              <Choice
                key={c}
                active={category === c}
                onClick={() => {
                  setCategory(c);
                  setTc(PRESETS[c][Math.min(1, PRESETS[c].length - 1)]);
                }}
              >
                {CATEGORY_LABEL[c]}
              </Choice>
            ))}
          </div>
          <div
            className="mb-3 flex flex-wrap gap-2"
            role="group"
            aria-label="Time control presets"
          >
            {PRESETS[category].map((p) => (
              <Choice
                key={p.id}
                active={tc.id === p.id}
                onClick={() => setTc(p)}
              >
                {describeTimeControl(p)}
              </Choice>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-ink-muted">
              Minutes
              <input
                data-testid="custom-minutes"
                type="number"
                min={0.25}
                max={240}
                step={0.25}
                value={minutes}
                onChange={(e) => {
                  setMinutes(e.target.value);
                  applyCustom(e.target.value, increment);
                }}
                className="mt-1 block w-24 rounded-lg border border-white/10 bg-navy-900 px-3 py-2 text-sm text-ink"
              />
            </label>
            <label className="text-xs text-ink-muted">
              Increment (s)
              <input
                data-testid="custom-increment"
                type="number"
                min={0}
                max={180}
                value={increment}
                onChange={(e) => {
                  setIncrement(e.target.value);
                  applyCustom(minutes, e.target.value);
                }}
                className="mt-1 block w-24 rounded-lg border border-white/10 bg-navy-900 px-3 py-2 text-sm text-ink"
              />
            </label>
            <Badge>
              {
                CATEGORY_LABEL[
                  (tc.category === "none"
                    ? "rapid"
                    : tc.category) as TimeCategory
                ]
              }
            </Badge>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Game type</h3>
            <div className="flex gap-2">
              <Choice active={rated} onClick={() => setRated(true)}>
                Rated
              </Choice>
              <Choice active={!rated} onClick={() => setRated(false)}>
                Friendly
              </Choice>
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">
              Who moves for you
            </h3>
            <div className="flex gap-2">
              <Choice active={mode === "play"} onClick={() => setMode("play")}>
                I play
              </Choice>
              <Choice
                active={mode === "simulate"}
                onClick={() => setMode("simulate")}
              >
                Simulate
              </Choice>
            </div>
          </div>
        </section>

        {mode === "simulate" && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink">
              Simulation speed
            </h3>
            <div className="flex flex-wrap gap-2">
              {SPEEDS.map((s) => (
                <Choice
                  key={s.id}
                  active={(speed === "brisk" ? "fast" : speed) === s.id}
                  onClick={() => setSpeed(s.id)}
                >
                  {s.label}
                </Choice>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-muted">
              The simulator plays your side at your rating, skills, mood and
              fatigue. You can take control at any moment.
            </p>
          </section>
        )}

        {chosen && (
          <CareerPredictionPanel
            opponent={chosen}
            options={{
              color: color === "random" ? "unknown" : color,
              timeControl: tc.category,
              tournamentType: rated ? "rated" : "friendly",
            }}
          />
        )}
        <Button
          onClick={start}
          disabled={!chosen || running}
          data-testid="start-game"
        >
          <Swords className="h-4 w-4" aria-hidden /> Start game
        </Button>
      </div>
    </Card>
  );
}
