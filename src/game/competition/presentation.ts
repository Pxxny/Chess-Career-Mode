import type { ScheduledEvent } from '@/game/world/schedule';
import { SPONSORSHIPS, sponsorMarketShare } from '@/data/reputation';
import { hashString } from '@/utils/format';
/** Stable fictional commercial partners; fees, prize pools and qualification rights are unchanged. */
export function withEventPartner(event:ScheduledEvent):ScheduledEvent {
 const d=event.details;if(!d||d.reference||d.historicalSchedule||d.sponsorship)return event;
 const seed=hashString(`event-partner:${event.id}:${event.year}`);
 if(seed%100>=35)return event;
 const prestige=d.prestige??0;
 const pool=SPONSORSHIPS.slice(4).filter(s=>prestige>=70?s.marketWeight>=12:prestige>=40?s.marketWeight>=6&&s.marketWeight<=15:s.marketWeight<=8);
 const partner=pool[Math.floor(seed/100)%pool.length];if(!partner)return event;
 return {...event,details:{...d,sponsorship:{id:partner.id,name:partner.name,marketShare:sponsorMarketShare(partner)}}};
}
export const hasOpeningCeremony=(e:{level?:string;details?:ScheduledEvent['details']})=>!!e.details&&(e.level==='elite'||e.level==='international'||e.details.prestige>=60||e.details.format==='team'||['continental','world'].includes(e.details.qualificationCircuit?.stage??''));
