import { comparisonWinner } from "@/game/prediction/comparison";
import { useId, useState } from 'react';
import { Button } from '@/components/ui';
import type { PredictionActor, PredictionSnapshot } from '@/game/prediction/types';
import { translateUI as t } from '@/i18n/translate';
export const COMPARISON_LABELS: Record<string,string> = { elo:'Elo', peakElo:'Peak Elo', form:'Current form', morale:'Morale', fatigue:'Fatigue', preparation:'Preparation quality', openingFamiliarity:'Opening familiarity', tactics:'Tactics', calculation:'Calculation', opening:'Opening knowledge', positional:'Positional understanding', endgame:'Endgame technique', visualization:'Visualization', timeManagement:'Time management', concentration:'Concentration', mental:'Mental toughness' };

function Repertoire({ actor }: { actor: PredictionActor }) {
  return <div className="min-w-0 rounded-xl bg-navy-900 p-3">
    <h4 className="break-words font-semibold" translate="no">{actor.name}</h4>
    <p className="my-2 text-sm"><span>Playing style</span>: <strong>{t(actor.style ?? 'Not recorded')}</strong></p>
    <p className="text-xs text-ink-muted">{actor.openingUsage?.some(o=>o.source==='played') ? 'Most played openings · recorded sample' : 'Preferred openings · declared repertoire'}</p>
    <ul className="mt-2 space-y-2 text-xs">{actor.openingUsage?.length ? actor.openingUsage.map((o,i)=><li key={`${o.name}:${i}`} className="break-words"><span translate="no">{o.name} {o.eco}</span>{o.source==='played' && <span> · {o.games} <span>recorded games</span></span>}</li>) : <li>Not recorded</li>}</ul>
    <p className="mt-3 text-xs text-ink-faint">{actor.data==='npc-estimate' ? 'NPC skills are estimates; repertoire is declared.' : actor.data==='career' ? 'Career skills and recorded opening experience.' : 'Rating-only opponent; attributes unavailable.'}</p>
  </div>;
}
export function MatchComparison({ prediction: p }: { prediction: PredictionSnapshot }) {
  const [open,setOpen]=useState(false), id=useId();
  const attributes=['elo','peakElo','form','morale','fatigue','preparation','openingFamiliarity'];
  const skills=[...new Set([...Object.keys(p.player.skills??{}),...Object.keys(p.opponent.skills??{})])];
  const rows=[...attributes.map(key=>({key,a:p.player[key as keyof PredictionActor],b:p.opponent[key as keyof PredictionActor]})),...skills.map(key=>({key,a:p.player.skills?.[key as keyof typeof p.player.skills],b:p.opponent.skills?.[key as keyof typeof p.opponent.skills]}))];
  return <div className="mt-4" data-testid="match-comparison">
    <Button variant="secondary" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(!open)}>{open?'Hide player comparison':'Compare players'}</Button>
    {open && <div id={id} className="mt-4 space-y-4">
      <p className="text-xs text-ink-muted">Highlighted values show the stronger attribute. Lower fatigue is better. Style and opening preference have no automatic winner.</p>
      <div className="overflow-x-auto rounded-xl border border-white/10"><table className="w-full text-left text-[10px] sm:text-xs">
        <caption className="sr-only">Player attribute comparison</caption><thead><tr><th className="p-2">Attribute</th><th className="whitespace-nowrap p-2 text-right">Player</th><th className="whitespace-nowrap p-2 text-right">Opponent</th></tr></thead>
        <tbody>{rows.map(({key,a,b})=>{ const winner=comparisonWinner(a,b,key==='fatigue'); return <tr key={key} className="border-t border-white/5" data-comparison-key={key}><th scope="row" className="p-2 font-normal text-ink-muted">{COMPARISON_LABELS[key]??key}</th>{[a,b].map((v,i)=>{const best=winner===(i===0?'player':'opponent');return <td key={i} data-better={best?'true':undefined} className={`whitespace-nowrap p-2 text-right text-[11px] tabular-nums sm:text-xs ${best?'bg-gold-500/15 font-bold text-gold-300':'text-ink-muted'}`}>{best&&<span aria-label={t('Advantage')}>▲ </span>}{typeof v==='number'?v.toFixed(key==='elo'||key==='peakElo'?0:1):t('Not recorded')}</td>;})}</tr>;})}</tbody>
      </table></div>
      <p className="text-xs text-ink-faint"><span>Familiarity basis</span>: <span>{!p.player.openingFamiliarityBasis?'Not recorded':p.player.openingFamiliarityBasis==='planned'?'Planned opening':'Overall repertoire'}</span> · <span>{!p.opponent.openingFamiliarityBasis?'Not recorded':p.opponent.openingFamiliarityBasis==='planned'?'Planned opening':'Overall repertoire'}</span></p>
      <div className="grid gap-3 sm:grid-cols-2"><Repertoire actor={p.player}/><Repertoire actor={p.opponent}/></div>
    </div>}
  </div>;
}
