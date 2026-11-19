import { useSave } from "@/hooks/useGame";
import { useState } from 'react';
import { teamStandings, teamName } from '@/game/competition/teamTournament';
import { getCountry } from '@/data/world/countries';
import type { ActiveTournament } from '@/types';

export function TeamTournamentStandings({t}:{t:ActiveTournament}) {
  const teams=teamStandings(t);
  return <div className="max-h-[32rem] overflow-auto" data-testid="team-standings"><table className="w-full min-w-[440px] text-left text-sm"><thead className="sticky top-0 bg-navy-800 text-xs text-ink-muted"><tr>{['#','National team','Match points','Board points'].map(label=><th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{teams.map((team,index)=><tr key={team.country} className={team.country===t.team!.country?'bg-gold-500/10 text-gold-300':'border-b border-white/5 text-ink-muted'}><td className="p-2">{index+1}</td><td className="p-2"><span aria-hidden>{getCountry(team.country)?.flag}</span> {teamName(team.country)}{team.country===t.team!.country&&<span className="ml-2 text-xs">Your team</span>}<details className="mt-1 text-xs"><summary className="cursor-pointer">Team roster</summary><ul className="my-2 space-y-1">{team.players.map(p=><li key={p.id} translate="no">{p.name} · {p.elo}</li>)}</ul></details></td><td className="p-2 font-semibold tabular-nums">{team.points}</td><td className="p-2 tabular-nums">{team.boardPoints}</td></tr>)}</tbody></table></div>;
}

export function TeamRoundBoards({t}:{t:ActiveTournament}) {
  const [chosen,setChosen]=useState<number|null>(null);
  const round=chosen===null? t.round-1:Math.min(chosen,t.pairings.length-1);
  const save = useSave();
  const targets = save.teamCamps?.[t.eventId]?.goals;
  const pairings=(t.pairings[round]??[]).filter(p=>p.teamMatch?.a===t.team!.country||p.teamMatch?.b===t.team!.country);
  const players=new Map(t.players.map(p=>[p.id,p])), match=pairings[0]?.teamMatch;
  const rival=match?(match.a===t.team!.country?match.b:match.a):null;
  const ready=pairings.length>0&&pairings.every(p=>p.result!==null), score=pairings.reduce((sum,p)=>sum+(p.result===null?0:players.get(p.white)?.countryCode===t.team!.country?p.result:1-p.result),0);
  return <section className="mt-4 rounded-xl bg-navy-900 p-4" data-testid="team-round-boards"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">National team boards</h3><select aria-label="National team round" className="rounded-lg bg-navy-800 p-2 text-sm" value={round} onChange={e=>setChosen(Number(e.target.value))}>{t.pairings.map((_,index)=><option key={index} value={index}>Round {index+1}</option>)}</select></div><div className="my-3 flex flex-wrap justify-between gap-2 text-sm"><p><span aria-hidden>{getCountry(t.team!.country)?.flag}</span> {teamName(t.team!.country)} <span>vs</span> {rival?teamName(rival):'Bye'}</p><strong className="text-gold-300">{rival===null?(t.team!.format==='round-robin'?'Rest round':'Team bye'):ready?`${score} – ${t.team!.info.boards-score}`:'Awaiting your board'}</strong></div><ul className="space-y-2">{pairings.map(p=>{const mine=p.white==='player'||p.black==='player';return <li key={p.teamMatch!.board} className={`rounded-xl border p-3 ${mine?'border-gold-500/50 bg-gold-500/5':'border-white/10'}`}><p className="mb-2 text-xs text-ink-muted"><span>Board {p.teamMatch!.board}</span>{mine&&<span className="ml-2 font-semibold text-gold-300">Your board</span>}{targets?.[p.teamMatch!.board - 1] && <span className="ml-2">Target · {targets[p.teamMatch!.board - 1]}</span>}</p><div className="grid gap-1 text-sm sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"><span translate="no" className="min-w-0 break-words">♔ {players.get(p.white)?.name}</span><strong className="text-gold-300">{p.black==='bye'?'Bye':p.result===null?'Upcoming':`${p.result} – ${1-p.result}`}</strong><span translate="no" className="min-w-0 break-words">{p.black==='bye'?'':'♚ '+players.get(p.black)?.name}</span></div></li>;})}</ul><p className="mt-3 text-xs text-ink-muted">Team win: 2 match points · draw: 1 · loss: 0</p></section>;
}
