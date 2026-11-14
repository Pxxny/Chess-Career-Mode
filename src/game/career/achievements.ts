import type { GameSave } from '@/types';
import { lifetimeOf } from '@/game/history/lifetime';
export function achievementCatalog(s:GameSave) {
 const life=lifetimeOf(s.history),g=s.history.games,ts=s.history.tournaments;
 const upset=g.reduce((max,g)=>g.outcome==='win'?Math.max(max,g.opponentElo-g.ratingBefore):max,0);
 const rows:Array<{id:string;name:string;description:string;value:number;target:number}>=[];
 const add=(key:string,name:string,value:number,target:number,description:string)=>rows.push({id:`career30-${key}`,name,description,value,target});
 [10,25,50,250,500,1000].forEach((n,i)=>add(`games${n}`,['Getting Started','Club Regular','Seasoned Competitor','Marathon Player','Veteran of the Board','Thousand Battles'][i],life.total.games,n,`Complete ${n} rated games.`));
 [10,25,50,100,250].forEach((n,i)=>add(`wins${n}`,['Winning Habit','Rising Challenger','Victory Collector','Century of Victories','Winning Legacy'][i],life.total.wins,n,`Win ${n} rated games.`));
 [10,50].forEach((n,i)=>add(`draw${n}`,['Holding the Line','Hard to Beat'][i],life.total.draws,n,`Draw ${n} rated games.`));
 add('white','White Initiative',life.white.wins,10,'Win 10 games with White.');add('black','Black Counterattack',life.black.wins,10,'Win 10 games with Black.');
 [300,400,500].forEach((n,i)=>add(`upset${n}`,['Giant Hunter','Titan Breaker','Legend Slayer'][i],upset,n,`Beat a player rated at least ${n} Elo above you.`));
 [5,10].forEach((n,i)=>add(`opening${n}`,['Opening Explorer','Repertoire Collector'][i],new Set(g.map(g=>g.opening).filter(Boolean)).size,n,`Play ${n} different recorded openings.`));
 [3,10].forEach((n,i)=>add(`event${n}`,['On the Circuit','Tournament Traveller'][i],ts.length,n,`Finish ${n} tournaments.`));
 add('podium','Podium Regular',ts.filter(t=>t.rank<=3).length,5,'Finish on the podium five times.');add('champion','Triple Crown',ts.filter(t=>t.rank===1).length,3,'Win three tournaments.');
 [10,50,200].forEach((n,i)=>add(`train${n}`,['Training Routine','Dedicated Student','Training Master'][i],s.training.sessionCounter,n,`Complete ${n} training sessions.`));
 [1,3].forEach((n,i)=>add(`qual${n}`,['Through the Gate','Qualification Specialist'][i],new Set(s.competition?.qualifications.map(q=>q.eventId??`${q.kind}:${q.year}`)).size,n,`Earn ${n} different competition qualifications.`));
 add('national','Flag Bearer',s.expansion?.cups.filter(c=>c.represented).length??0,1,'Represent your national team.');
 return rows.map(r=>({...r,earned:r.value>=r.target||s.history.trophies.some(t=>t.id===r.id)}));
}
export function awardAchievements(s:GameSave):GameSave {
 const added=achievementCatalog(s).filter(a=>a.earned&&!s.history.trophies.some(t=>t.id===a.id));
 if(!added.length)return s;
 return {...s,history:{...s.history,trophies:[...s.history.trophies,...added.map(a=>({id:a.id,name:a.name,description:a.description,category:'special' as const,...s.world.date}))]}};
}
