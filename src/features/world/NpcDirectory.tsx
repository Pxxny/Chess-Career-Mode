import { useMemo, useState } from "react";
import { Badge, Button } from "@/components/ui";
import { TIERS } from "@/data/chess/tiers";
import { getCountry } from "@/data/world/countries";
import { useNpcs } from "@/hooks/useNpcs";
import { useSave } from "@/hooks/useGame";
import type { Npc, SkillTier } from "@/types";
import { normalizeText } from "@/utils/text";
import { translateUI } from "@/i18n/translate";
import {
  directoryEntries,
  playerDirectoryEntry,
} from "@/game/social/directory";
import { relationshipAt, relationshipLabel } from "@/game/social/relationships";
import { NpcProfileModal } from "./NpcProfileModal";
import { PlayerProfileModal } from "./PlayerProfileModal";

const PAGE_SIZE = 20;
export function NpcDirectory() {
  const npcs = useNpcs(),
    save = useSave();
  const [query, setQuery] = useState(""),
    [tier, setTier] = useState<SkillTier | "all">("all");
  const [includeUnranked, setIncludeUnranked] = useState(false),
    [visible, setVisible] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<Npc | null>(null),
    [showPlayer, setShowPlayer] = useState(false);
  const entries = useMemo(() => directoryEntries(save, npcs), [save, npcs]);
  const player = playerDirectoryEntry(save, npcs);
  const results = useMemo(() => {
    const q = normalizeText(query);
    return entries
      .filter((n) => includeUnranked || n.worldRank !== null)
      .filter((n) => tier === "all" || n.tier === tier)
      .filter(
        (n) =>
          !q ||
          normalizeText(n.name).includes(q) ||
          normalizeText(n.city).includes(q) ||
          normalizeText(getCountry(n.nationality)?.name ?? "").includes(q) ||
          normalizeText(
            translateUI(getCountry(n.nationality)?.name ?? "", "th"),
          ).includes(q),
      );
  }, [entries, query, tier, includeUnranked]);
  const field =
    "rounded-lg border border-white/10 bg-navy-900 px-3 py-2.5 text-sm text-ink outline-none focus:border-gold-500";
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold-500/20 bg-navy-900 p-3">
        <div>
          <p className="text-xs text-ink-muted">
            Your player · #{player.worldRank}
          </p>
          <button
            type="button"
            aria-label="Open your directory profile"
            className="mt-1 text-left font-semibold text-gold-300 underline underline-offset-2"
            onClick={() => setShowPlayer(true)}
          >
            <span translate="no">{player.name}</span>
          </button>
          <span className="ml-2 text-sm tabular-nums text-ink-muted">
            {player.currentElo} Elo
          </span>
        </div>
        <Badge tone="gold">You</Badge>
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          type="search"
          aria-label="Search players by name, city or country"
          placeholder="Search by name, city or country"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setVisible(PAGE_SIZE);
          }}
          className={field}
        />
        <select
          aria-label="Filter by tier"
          value={tier}
          onChange={(e) => {
            setTier(e.target.value as SkillTier | "all");
            setVisible(PAGE_SIZE);
          }}
          className={field}
        >
          <option value="all">All tiers</option>
          {TIERS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <label className="mb-4 flex items-center gap-2 text-sm text-ink-muted">
        <input
          type="checkbox"
          checked={includeUnranked}
          onChange={(e) => setIncludeUnranked(e.target.checked)}
          className="h-4 w-4 accent-[#d4a94a]"
        />
        Include retired and historical players
      </label>
      <p className="mb-2 text-sm text-ink-faint" aria-live="polite">
        {results.length} players
      </p>
      <div className="overflow-x-auto">
        <table
          className="w-full text-left text-sm"
          aria-label="Player directory"
        >
          <thead className="text-ink-faint">
            <tr className="border-b border-white/5">
              <th className="py-2 pr-2 font-medium">Rank</th>
              <th className="py-2 pr-2 font-medium">Player</th>
              <th className="py-2 pr-2 font-medium">Country</th>
              <th className="py-2 pr-2 text-right font-medium">Elo</th>
              <th className="py-2 pl-3 font-medium">Relationship</th>
            </tr>
          </thead>
          <tbody>
            {results.slice(0, visible).map((n) => (
              <tr
                key={`${n.kind}:${n.id}`}
                className={`border-b border-white/5 ${n.kind === "player" ? "bg-gold-500/5" : ""}`}
              >
                <td className="py-2.5 pr-2 tabular-nums text-ink-muted">
                  {n.worldRank ?? "–"}
                </td>
                <td className="py-2.5 pr-2 font-semibold text-ink">
                  <button
                    type="button"
                    onClick={() =>
                      n.kind === "player"
                        ? setShowPlayer(true)
                        : setSelected(n.npc)
                    }
                    className="text-left underline-offset-2 hover:text-gold-300 hover:underline"
                  >
                    <span translate="no">{n.name}</span>
                  </button>
                  {n.kind === "player" && (
                    <span className="ml-2 text-xs text-gold-400">You</span>
                  )}
                  {n.title !== "none" && (
                    <span className="ml-2 text-xs text-gold-500">
                      {n.title}
                    </span>
                  )}
                </td>
                <td className="py-2.5 pr-2 text-ink-muted">
                  <span aria-hidden>{getCountry(n.nationality)?.flag}</span>{" "}
                  {getCountry(n.nationality)?.name ?? n.nationality}
                </td>
                <td className="py-2.5 pr-2 text-right font-semibold tabular-nums text-gold-400">
                  {n.currentElo}
                </td>
                <td className="py-2.5 pl-3 text-xs text-ink-muted">
                  {n.kind === "player"
                    ? "Your character"
                    : relationshipLabel(relationshipAt(save, n.id))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!results.length && (
        <p className="py-4 text-sm text-ink-faint">
          No players match these filters.
        </p>
      )}
      {visible < results.length && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="secondary"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
          >
            Show more players
          </Button>
        </div>
      )}
      <NpcProfileModal npc={selected} onClose={() => setSelected(null)} />
      <PlayerProfileModal
        open={showPlayer}
        onClose={() => setShowPlayer(false)}
      />
    </div>
  );
}
