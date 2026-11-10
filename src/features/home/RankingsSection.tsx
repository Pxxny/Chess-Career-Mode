import { useMemo, useState } from "react";
import { Button, Card, CardTitle } from "@/components/ui";
import { getCountry } from "@/data/world/countries";
import type { Npc, Player } from "@/types";

type Scope = "world" | "national" | "city";
const SCOPES: { id: Scope; label: string }[] = [
  { id: "world", label: "World" },
  { id: "national", label: "National" },
  { id: "city", label: "City" },
];
const PAGE = 20;

interface Props {
  player: Player;
  /** Every NPC, strongest first */
  ranked: Npc[];
  onSelect: (npc: Npc) => void;
}

/** Ranking lists (world, national, city) with the player placed among the NPCs; tap a name to open their profile. */
export function RankingsSection({ player, ranked, onSelect }: Props) {
  const [scope, setScope] = useState<Scope>("world");
  const [shown, setShown] = useState(PAGE);
  const rows = useMemo(() => {
    const pool = ranked.filter(
      (n) =>
        (n.careerStatus === "active" || n.careerStatus === "semi-retired") &&
        (scope === "world" ||
          (scope === "national"
            ? n.nationality === player.country
            : n.nationality === player.country &&
              n.city.trim().toLowerCase() ===
                player.city.name.trim().toLowerCase())),
    );
    const list: { npc: Npc | null; elo: number }[] = pool.map((npc) => ({
      npc,
      elo: npc.currentElo,
    }));
    list.push({ npc: null, elo: player.rating });
    return list.sort((a, b) => b.elo - a.elo);
  }, [ranked, scope, player.country, player.city.name, player.rating]);
  const me = rows.findIndex((r) => r.npc === null);
  const visible = rows.slice(0, shown);
  const meHidden = me >= shown;
  const line = (
    r: { npc: Npc | null; elo: number },
    rank: number,
    key: string,
  ) => (
    <tr
      key={key}
      className={
        r.npc
          ? "border-b border-white/5 last:border-0"
          : "border-b border-white/5 bg-gold-500/10 last:border-0"
      }
    >
      <td className="w-12 py-2.5 pr-2 tabular-nums text-ink-muted">{rank}</td>
      <td className="py-2.5 pr-2 font-semibold text-ink">
        {r.npc ? (
          <button
            type="button"
            onClick={() => onSelect(r.npc!)}
            className="text-left underline-offset-2 hover:text-gold-300 hover:underline"
          >
            <span translate="no">{r.npc.name}</span>
          </button>
        ) : (
          <span translate="no">{player.name}</span>
        )}
        {r.npc && r.npc.title !== "none" && (
          <span className="ml-2 text-xs font-medium text-gold-500">
            {r.npc.title}
          </span>
        )}
        {!r.npc && (
          <span className="ml-2 text-xs font-medium text-gold-300">YOU</span>
        )}
        {r.npc?.kind === "legend" && (
          <span className="ml-2 text-xs font-medium text-ink-faint">
            Real player
          </span>
        )}
      </td>
      <td className="py-2.5 pr-2 text-ink-muted">
        {r.npc ? (
          <>
            <span aria-hidden>{getCountry(r.npc.nationality)?.flag}</span>{" "}
            {getCountry(r.npc.nationality)?.name ?? r.npc.nationality}
          </>
        ) : (
          <>
            <span aria-hidden>{getCountry(player.country)?.flag}</span>{" "}
            {getCountry(player.country)?.name ?? player.country}
          </>
        )}
      </td>
      <td className="py-2.5 text-right font-semibold tabular-nums text-gold-400">
        {r.elo}
      </td>
    </tr>
  );
  return (
    <Card className="mb-4">
      <CardTitle>Rankings</CardTitle>
      <div role="tablist" aria-label="Ranking scope" className="mb-3 flex gap-2">
        {SCOPES.map((s) => (
          <Button
            key={s.id}
            role="tab"
            aria-selected={scope === s.id}
            variant={scope === s.id ? "primary" : "secondary"}
            onClick={() => {
              setScope(s.id);
              setShown(PAGE);
            }}
          >
            {s.label}
          </Button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-ink-faint">
            <tr className="border-b border-white/5">
              <th className="w-12 py-2 pr-2 font-medium">Rank</th>
              <th className="py-2 pr-2 font-medium">Player</th>
              <th className="py-2 pr-2 font-medium">Country</th>
              <th className="py-2 text-right font-medium">Elo</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => line(r, i + 1, r.npc?.id ?? "player"))}
            {meHidden && line(rows[me], me + 1, "player-row")}
          </tbody>
        </table>
      </div>
      {rows.length > shown && (
        <Button
          className="mt-3"
          variant="secondary"
          onClick={() => setShown(shown + PAGE)}
        >
          Show more
        </Button>
      )}
    </Card>
  );
}
