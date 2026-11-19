import {SPONSORSHIPS,sponsorMarketShare} from '@/data/reputation';
import {COUNTRIES} from '@/data/world/countries';
import {hashString} from '@/utils/format';
import type {ScheduledEvent} from '@/game/world/schedule';
/** A shared, bookable calendar: the same IDs and rules are used by humans and NPCs. */
export function sponsorEvents(year:number):ScheduledEvent[]{
 const hosts=COUNTRIES.filter(c=>c.status==='sovereign'&&c.capital&&c.continent!=='Antarctica');
 const opens: ScheduledEvent[] = SPONSORSHIPS.slice(4).flatMap((s,i)=>Array.from({length:12},(_,month)=>{
  const seed=hashString(`${s.id}:${year}:${month}:series`),offset=month*30+7+seed%19,week=1+Math.floor(offset/7),startDay=offset%7+1;
  const stage=i<20?Math.floor(i/5):Math.min(3,Math.floor(s.marketWeight/4)),level=(['local','national','international','elite'] as const)[stage],host=hosts[seed%hosts.length];
  const rematch = (s.id === 'highpro' || s.id === 'powervant') && month === 5;
  const type=month%3,days=type===1?3:1,rounds=type===2?9:7;
  const timeControl=type===1?{id:'sponsor-classical',label:'60+30',base:3600,increment:30,category:'classical' as const}:type===2?{id:'sponsor-blitz',label:'5+3',base:300,increment:3,category:'blitz' as const}:{id:'sponsor-rapid',label:'15+10',base:900,increment:10,category:'rapid' as const};
  const name=`${s.name} ${rematch?'Rematch Cup':type===1?'Classic':type===2?'Blitz Open':'Rapid Open'} · ${year}/${String(month+1).padStart(2,'0')}`;
  const endOffset=offset+days-1,deadline=week-2;
  return {id:`sponsor-open-${s.id}-${year}-${month+1}`,name,year,week,level,fieldSize:rematch?4:[64,96,128,128][stage],entryFee:[10,25,60,120][stage],minElo:[0,1200,1800,2200][stage],minReputation:[0,0,15,35][stage],registrationDeadline:{year:deadline>0?year:year-1,week:deadline>0?deadline:52+deadline},weeksUntilStart:0,weeksUntilDeadline:0,invitational:false,
   details:{category:'Sponsor-hosted Open',location:host.capital!,country:host.code,end:{year,week:1+Math.floor(endOffset/7)},format:rematch?'round-robin-bo3':'swiss',twoGameRematch:rematch,rounds:rematch?9:rounds,timeControl,prize:Math.round([800,2500,10000,25000][stage]*(1+sponsorMarketShare(s,year*12+month)/10)),prestige:[15,35,60,80][stage],provenance:'fictional',localShare:.2,organizer:{name:s.name,status:stage>=2?'Official':'Unofficial',simulated:true,sponsorId:s.id},sponsorship:{id:s.id,name:s.name,marketShare:sponsorMarketShare(s,year*12+month)},agenda:{days,startDay,startMinute:540,slotMinutes:type===1?190:type===2?30:75,exactStart:true}}
  };
 }));
 return [...opens, ...onlineSponsorEvents(year)];
}

function onlineSponsorEvents(year: number): ScheduledEvent[] {
 const sponsors = year <= 2026 ? ['logg'] : ['logg', 'keenly', 'powervant', 'saswell', 'highpro'];
 return sponsors.flatMap((id, index) => {
  const sponsor = SPONSORSHIPS.find(entry => entry.id === id)!;
  const qualifierWeek = 9 + index * 6;
  const finalWeek = qualifierWeek + 3;
  const finalId = `sponsor-hybrid-${id}-${year}-final`;
  const name = `${sponsor.name} Online-to-Board Cup`;
  const finalName = `${name} — Live Finals`;
  const common = {
   category: 'Online Qualification',
   country: sponsor.headquarters.country,
   format: 'swiss' as const,
   timeControl: { id: 'online-rapid', label: '10+5', base: 600, increment: 5, category: 'rapid' as const },
   provenance: 'fictional' as const,
   organizer: { name: sponsor.name, status: 'Unofficial' as const, simulated: true, sponsorId: id },
  };
  return [false, true].map(final => {
   const week = final ? finalWeek : qualifierWeek;
   return { id: final ? finalId : `sponsor-hybrid-${id}-${year}-online`, name: final ? finalName : `${name} — Online Qualifier`,
    year, week, level: 'international', fieldSize: final ? 8 : 48, entryFee: 0, minElo: 0, minReputation: 0, invitational: final,
    registrationDeadline: { year, week: week - 1 }, weeksUntilStart: 0, weeksUntilDeadline: 0,
    details: { ...common, location: final ? sponsor.headquarters.city : 'Online', end: { year, week },
     rounds: final ? 3 : 5, prize: final ? 1800 : 0, prestige: final ? 32 : 12,
     host: { mode: final ? 'rotation' : 'online' },
     agenda: { days: 1, startDay: 5, startMinute: 540, slotMinutes: 45, exactStart: true },
     qualification: final ? 'circuit-world' : undefined,
     qualificationCircuit: { seriesId: `sponsor-hybrid-${id}`, sponsor: sponsor.name, stage: final ? 'world' : 'local', season: year,
      worldFinalId: finalId, worldFinalName: finalName,
      ...(final ? {} : { advanceTop: 8, advanceKind: 'circuit-world', targetEventId: finalId }),
     },
    },
   };
  });
 });
}
