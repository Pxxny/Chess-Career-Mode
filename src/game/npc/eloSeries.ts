import type {Npc} from '@/types';import type {EloPoint,EloPeriod} from '@/game/history/eloSeries';
export type NpcEloPeriod=EloPeriod|'match';
/** Only saved career results; never invent an official historical rating or intermediate month. */
export function npcEloSeries(npc:Npc,period:NpcEloPeriod,locale='en-GB'):EloPoint[]{
 const games=npc.ratingHistory??[],recent=games.slice(-100);
 if(period==='match')return games.length?[{key:'start',label:'Before first recorded match',elo:recent[0].before},...recent.map((p,i)=>({key:p.id,label:`${p.event} · ${p.year}/W${p.week} · #${i+1}`,elo:p.elo}))]:[];
 const rows=[...npc.tournamentHistory.filter(t=>Number.isFinite(t.ratingAfter)).map((t,i)=>({dated:t.week!==undefined,tournament:true,key:t.eventId??`legacy:${t.year}:${i}`,event:t.event,year:t.year,week:t.week??0,day:7,elo:t.ratingAfter!})),...games.map(p=>({dated:true,tournament:!!p.eventId,key:p.eventId??p.id,event:p.event,year:p.year,week:p.week,day:p.day??1,elo:p.elo}))].sort((a,b)=>a.year-b.year||a.week-b.week||a.day-b.day);
 const grouped=new Map<string,EloPoint>();
 for(const p of rows){if(period==='month'&&!p.dated)continue;let key=p.key,label=p.event;
  if(period!=='tournament'){const d=new Date(Date.UTC(p.year,0,1+(p.week-1)*7+p.day-1));key=period==='year'?String(p.year):`${p.year}-${d.getUTCMonth()+1}`;label=period==='year'?String(p.year):d.toLocaleDateString(locale,{month:'short',year:'numeric',timeZone:'UTC',calendar:'gregory'});}
  else if(!p.tournament)continue;
  grouped.delete(key);grouped.set(key,{key,label,elo:p.elo});
 }
 return [...grouped.values()];
}
