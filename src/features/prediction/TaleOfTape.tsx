import { rivalryBonus, rivalryEventId } from "@/game/career/rivalryEvent";
import { getCountry } from "@/data/world/countries";
import { highestTitle } from "@/game/match/setup";
import { useRankedNpcs } from "@/hooks/useNpcs";
import { computeRankings } from "@/game/world/standings";
import { npcDirectoryRank } from "@/game/social/directory";
import type { MatchSetup } from "@/game/match/session";
import { useMemo } from "react";
import { careerPrediction } from "@/game/prediction/adapters";
import { PressConference } from "@/features/career/systems/PressConference";
import { CharacterPortrait } from '@/components/game/CharacterPortrait';
import { NpcAvatar } from '@/components/game/NpcAvatar';
import { useSave } from '@/hooks/useGame';
import { useNpcs } from '@/hooks/useNpcs';
import { Button, Modal } from '@/components/ui';
import { PredictionPanel } from './PredictionPanel';
import type { PredictionSnapshot } from '@/game/prediction/types';
export function TaleOfTape({prediction:input,onClose,onStart,setup}:{prediction:PredictionSnapshot;onClose:()=>void;onStart?:()=>void;setup?:MatchSetup}) {
  const save=useSave(),npcs=useNpcs(),npc=npcs.find(n=>n.id===input.opponent.id) ?? npcs.find(n=>n.name===input.opponent.name);
  const p=useMemo(()=>npc?careerPrediction(save,npc,{...input.conditions,id:input.id}):input,[save,npc,input]);
  const ranked = useRankedNpcs();
  const playerRank = computeRankings(save.player, ranked).world.rank;
  const opponentRank = npc ? npcDirectoryRank(npc, playerRank) : null;
  const meetings = save.history.games.filter(game => game.opponentId === npc?.id);
  const wins = meetings.filter(game => game.outcome === "win").length;
  const draws = meetings.filter(game => game.outcome === "draw").length;
  const keys=['tactics','opening','endgame','calculation','timeManagement'] as const;
  return <Modal open title="Tale of the tape" onClose={onClose} size="lg" footer={onStart?<Button onClick={onStart}>Begin match</Button>:undefined}>
    <div data-testid="tale-of-tape" className="space-y-4">
    <div className="elite-hero rounded-2xl border p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-gold-300">{setup?.tournament?.name ?? "Matchday"}</p>
      <h2 className="font-display text-2xl">Matchday · Versus</h2>
      {setup && <p className="text-xs text-ink-muted">{setup.tournament && `Round ${setup.tournament.round} · `}{setup.timeControl.label} · {setup.rated ? "Rated" : "Friendly"}</p>}
    </div>
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-2 text-center"><div className="elite-matchup min-w-0 p-2 sm:p-4"><CharacterPortrait appearance={save.player.appearance} age={save.player.age} gender={save.player.gender} className="mx-auto w-full max-w-[6rem] border-2 border-gold-500"/><p className="mt-2 break-words font-semibold" translate="no">{p.player.name}</p><p className="text-sm text-gold-400">{p.player.elo} Elo</p><p className="text-xs text-ink-muted">{getCountry(save.player.country)?.name} · #{playerRank}</p><p className="text-xs text-gold-300">{highestTitle(save) !== "none" && highestTitle(save)}</p></div><strong className="self-center font-display text-xl text-gold-300">VS</strong><div className="elite-matchup min-w-0 p-2 sm:p-4">{npc?<span className="tape-portrait"><NpcAvatar npc={npc} size="lg"/></span>:<div className="text-4xl">♟</div>}<p className="mt-2 break-words font-semibold" translate="no">{p.opponent.name}</p><p className="text-sm text-gold-400">{p.opponent.elo} Elo</p>{npc && <p className="text-xs text-ink-muted">{getCountry(npc.nationality)?.name}{opponentRank ? ` · #${opponentRank}` : ""}</p>}{npc && npc.title !== "none" && <p className="text-xs text-gold-300">{npc.title}</p>}</div></div>
    {meetings.length > 0 && <div className="elite-matchup p-3"><p className="text-xs uppercase tracking-wider text-ink-muted">Head-to-head</p><p className="font-semibold text-gold-300">{wins}W · {draws}D · {meetings.length - wins - draws}L</p></div>}
    <div className="space-y-2">{keys.map(key=>{const a=p.player.skills?.[key],b=p.opponent.skills?.[key];if(a==null||b==null)return null;return <div key={key} className="grid grid-cols-[minmax(0,1fr)_minmax(4.5rem,7.5rem)_minmax(0,1fr)] items-center gap-2 text-xs"><div className="flex items-center justify-end gap-2"><span className={a>b?'font-bold text-gold-300':''}>{Math.round(a)}</span><span className="h-2 w-20 overflow-hidden rounded-full bg-navy-900"><span style={{width:`${a}%`}} className={`ml-auto block h-full ${a>b?'bg-gold-500':'bg-navy-600'}`}/></span></div><span className="text-center capitalize text-ink-muted">{key==='timeManagement'?'Time management':key}</span><div className="flex items-center gap-2"><span className="h-2 w-20 overflow-hidden rounded-full bg-navy-900"><span style={{width:`${b}%`}} className={`block h-full ${b>a?'bg-gold-500':'bg-navy-600'}`}/></span><span className={b>a?'font-bold text-gold-300':''}>{Math.round(b)}</span></div></div>})}</div>
    {npc&&save.tournament&&<PressConference npcId={npc.id} eventId={save.tournament.eventId} id={String(save.tournament.round)} phase="pre"/>}
    {setup?.rated && npc && rivalryEventId(save, npc.id) && <p className="rounded-xl border border-gold-500/40 bg-navy-700 p-3 text-sm text-gold-300">Rivalry match · ${rivalryBonus} for a win · morale at stake</p>}
    <PredictionPanel prediction={p} preview/>
    </div></Modal>;
}
