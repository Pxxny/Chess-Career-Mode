import { findRivals } from "@/game/history/stats";
import { PinNpcButton } from "./PinNpcButton";
import { watchlistIds,watchlistEntries,npcWatchSummary } from "@/game/social/directory";
import { useWonderkids } from "./WonderkidTags";
import { useMemo, useState } from "react";
import { Avatar, Badge, Button, Card } from "@/components/ui";
import { NpcAvatar } from "@/components/game/NpcAvatar";
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
  const [category, setCategory] = useState("all");
  const wonderkids = useWonderkids();
  const [watchOnly,setWatchOnly]=useState(false);
  const pinned=watchlistIds(save);
  const [includeUnranked, setIncludeUnranked] = useState(false),
    [visible, setVisible] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<Npc | null>(null),
    [showPlayer, setShowPlayer] = useState(false);
  const entries = useMemo(() => directoryEntries(save, npcs), [save, npcs]);
  const player = playerDirectoryEntry(save, npcs);
  const rivalryIds = useMemo(() => new Set(findRivals(save.history).map(rival => rival.key)), [save.history]);
  const results = useMemo(() => {
    const q = normalizeText(query);
    return (watchOnly?watchlistEntries(save,entries):entries)
      .filter((n) => watchOnly || includeUnranked || n.worldRank !== null)
      .filter((n) => {
        if (category === "all") return true;
        if (category === "elite") return n.worldRank !== null && n.worldRank <= 100;
        if (category === "wonderkid") {
          const tag = wonderkids?.tags.get(n.kind === "player" ? "player" : n.id);
          return Boolean(tag?.groups.length || tag?.overall);
        }
        return n.kind === "npc" && rivalryIds.has(n.id);
      })
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
  }, [entries, query, tier, includeUnranked,watchOnly,save.npcWatchlist,category,wonderkids,rivalryIds]);
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
      <div className="mb-3 flex flex-wrap gap-2"><Button variant={!watchOnly?"primary":"secondary"} aria-pressed={!watchOnly} onClick={()=>{setWatchOnly(false);setVisible(PAGE_SIZE);}}>All players</Button><Button variant={watchOnly?"primary":"secondary"} aria-pressed={watchOnly} onClick={()=>{setWatchOnly(true);setQuery("");setTier("all");setVisible(PAGE_SIZE);}}>Watchlist ({pinned.length})</Button></div>
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
      <div role="group" aria-label="Player categories" className="mb-4 flex flex-wrap gap-2">
        {[["all", "All"], ["rival", "Rivals"], ["elite", "Top 100"], ["wonderkid", "Wonderkids"]].map(([id, label]) =>
          <button key={id} className="section-tab bg-navy-700" aria-pressed={category === id} onClick={() => { setCategory(id); setVisible(PAGE_SIZE); }}>{label}</button>)}
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
      <div className="grid gap-3 xl:grid-cols-2" role="group" aria-label="Player directory">
        {results.slice(0, visible).map((n) => {
          const country = getCountry(n.nationality);
          const tag = wonderkids?.tags.get(n.kind === "player" ? "player" : n.id);
          return <Card key={`${n.kind}:${n.id}`} className="bg-navy-900/65 p-4">
            <div className="flex items-start gap-3">
              {n.kind === "npc" ? <NpcAvatar npc={n.npc} decorative /> : <Avatar name={save.player.name} seed={save.player.avatarSeed} appearance={save.player.appearance} size="sm" />}
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => n.kind === "npc" ? setSelected(n.npc) : setShowPlayer(true)} className="min-h-8 break-words text-left font-display text-lg hover:text-gold-300 hover:underline" translate="no">{n.name}</button>
                <p className="text-xs text-ink-muted">{country?.flag} {country?.name ?? n.nationality} · {n.worldRank ? `#${n.worldRank}` : "Unranked"}</p>
              </div>
              {n.kind === "npc" && <PinNpcButton npc={n.npc} />}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <strong className="mr-auto text-xl tabular-nums text-gold-300">{n.currentElo} Elo</strong>
              {n.title !== "none" && <Badge>{n.title}</Badge>}
              {rivalryIds.has(n.id) && <Badge>Rival</Badge>}
              {n.worldRank !== null && n.worldRank <= 100 && <Badge>Top 100</Badge>}
              {(tag?.groups.length || tag?.overall) ? <Badge>Wonderkid</Badge> : null}
              {tag?.hot && <Badge>{tag.hot}</Badge>}
            </div>
            {n.kind === "npc" && <div className="mt-2"><p className="text-xs text-ink-muted">{relationshipLabel(relationshipAt(save, n.id))}</p><WatchActivity npc={n.npc} /></div>}
          </Card>;
        })}
      </div>
      {!results.length && (
        <p className="py-4 text-sm text-ink-faint">
          {watchOnly&&pinned.length===0?"Pin players to follow their Elo, form and tournament results here.":"No players match these filters."}
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

function WatchActivity({npc}:{npc:Npc}) {
 const {latest,recent}=npcWatchSummary(npc);
 return <div className="mt-1 max-w-[20rem] text-[10px] font-normal text-ink-muted"><span>{npc.careerStatus==='active'?'Active':npc.careerStatus}</span>{recent.length>0&&<span className="ml-2 inline-flex gap-1">{recent.map((r,i)=><span key={i} className={r==='win'?'text-emerald-300':r==='loss'?'text-rose-300':'text-ink-muted'}>{r==='win'?'W':r==='loss'?'L':'D'}</span>)}</span>}{latest&&<p className="mt-1 truncate" title={latest.event}><span translate="no">{latest.event}</span> · #{latest.rank} · {latest.year}</p>}</div>;
}
