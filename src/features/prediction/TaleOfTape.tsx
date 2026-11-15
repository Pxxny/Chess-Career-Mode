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
export function TaleOfTape({prediction:input,onClose,onStart}:{prediction:PredictionSnapshot;onClose:()=>void;onStart?:()=>void}) {
  const save=useSave(),npcs=useNpcs(),npc=npcs.find(n=>n.name===input.opponent.name);
  const p=useMemo(()=>npc?careerPrediction(save,npc,{...input.conditions,id:input.id}):input,[save,npc,input]);
  const keys=['tactics','opening','endgame','calculation','timeManagement'] as const;
  return <Modal open title="Tale of the tape" onClose={onClose} size="lg" footer={onStart?<Button onClick={onStart}>Begin match</Button>:undefined}>
    <div data-testid="tale-of-tape" className="space-y-4"><div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 text-center"><div className="min-w-0"><CharacterPortrait appearance={save.player.appearance} age={save.player.age} gender={save.player.gender} className="mx-auto w-24 border-2 border-gold-500"/><p className="mt-2 break-words font-semibold" translate="no">{p.player.name}</p><p className="text-sm text-gold-400">{p.player.elo} Elo</p></div><strong className="text-ink-faint">VS</strong><div className="min-w-0">{npc?<span className="tape-portrait"><NpcAvatar npc={npc} size="lg"/></span>:<div className="text-4xl">♟</div>}<p className="mt-2 break-words font-semibold" translate="no">{p.opponent.name}</p><p className="text-sm text-gold-400">{p.opponent.elo} Elo</p></div></div>
    <div className="space-y-2">{keys.map(key=>{const a=p.player.skills?.[key],b=p.opponent.skills?.[key];if(a==null||b==null)return null;return <div key={key} className="grid grid-cols-[1fr_7.5rem_1fr] items-center gap-2 text-xs"><div className="flex items-center justify-end gap-2"><span className={a>b?'font-bold text-gold-300':''}>{Math.round(a)}</span><span className="h-2 w-20 overflow-hidden rounded-full bg-navy-900"><span style={{width:`${a}%`}} className={`ml-auto block h-full ${a>b?'bg-gold-500':'bg-navy-600'}`}/></span></div><span className="text-center capitalize text-ink-muted">{key==='timeManagement'?'Time management':key}</span><div className="flex items-center gap-2"><span className="h-2 w-20 overflow-hidden rounded-full bg-navy-900"><span style={{width:`${b}%`}} className={`block h-full ${b>a?'bg-gold-500':'bg-navy-600'}`}/></span><span className={b>a?'font-bold text-gold-300':''}>{Math.round(b)}</span></div></div>})}</div>
    {npc&&save.tournament&&<PressConference npcId={npc.id} eventId={save.tournament.eventId} id={String(save.tournament.round)} phase="pre"/>}
    <PredictionPanel prediction={p} preview/>
    </div></Modal>;
}
