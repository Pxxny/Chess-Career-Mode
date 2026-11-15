import dataset from '../../../public/data/venue-cities.json' with { type: 'json' };
import type { EventRegistration, GameSave } from '@/types';
import type { ScheduledEvent } from '@/game/world/schedule';
import { getCountry } from '@/data/world/countries';
import { normalizeText } from '@/utils/text';
import { bookedStart,bookedEnd,gameDay } from './agenda';
import { systemsOf } from '@/game/career/systems';
export type VenueCity=[string,number,number,number];
export interface TravelQuote {from:{city:string;country:string;day:number};to:{city:string;country:string};km:number|null;cost:number;jetlag:number;consecutive:boolean;travelClass:"economy"|"business";}
const cities=dataset as unknown as Record<string,VenueCity[]>;
const cache=new Map<string,VenueCity|null>();
export function venueCity(country:string,name:string) {
 const key=`${country}:${name}`;if(cache.has(key))return cache.get(key)!;
 const normalized=normalizeText(name),row=(cities[country]??[]).find(c=>normalizeText(c[0])===normalized)??null;
 cache.set(key,row);return row;
}
export const venueCities=(country:string):VenueCity[]=>cities[country]??[];
export function distanceKm(a:{lat:number;lon:number},b:{lat:number;lon:number}) {
 const rad=(n:number)=>n*Math.PI/180,dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon);
 const h=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;
 return Math.round(12742*Math.asin(Math.sqrt(Math.min(1,h))));
}
export function travelQuote(save:GameSave,event:Pick<ScheduledEvent,'id'|'details'|'year'|'week'>,travelClass=systemsOf(save).travelClass):TravelQuote {
 const booked=save.registrations.find(r=>r.eventId===event.id);
 if(booked?.travel)return booked.travel;
 const state=systemsOf(save),start=bookedStart(event),prior=[...save.registrations].filter(r=>r.eventId!==event.id&&bookedStart(r)>=gameDay(save)&&bookedEnd(r)<start&&r.details?.host?.mode!=='online').sort((a,b)=>bookedEnd(b)-bookedEnd(a))[0];
 const origin=prior?{city:prior.details?.location??'',country:prior.details?.country??save.player.country,day:bookedEnd(prior)}:state.location??{city:save.player.city.name,country:save.player.country,day:gameDay(save)-7};
 const destination={city:event.details?.location??'',country:event.details?.country??save.player.country};
 const a=venueCity(origin.country,origin.city),b=venueCity(destination.country,destination.city),online=event.details?.host?.mode==='online';
 const km=online?0:a&&b?distanceKm({lat:a[3],lon:a[2]},{lat:b[3],lon:b[2]}):null;
 const intercontinental=!online&&getCountry(origin.country)?.continent!==getCountry(destination.country)?.continent;
 const consecutive=intercontinental&&start-origin.day<4;
 const base=online?0:km===null?event.details?.travelCost??0:km<40?0:Math.round(10+km*.055+(intercontinental?65:0));
 const calculatedCost=Math.round(base*(consecutive?1.3:1)*(travelClass==='business'?2.2:1));
 const cost=booked?(booked.travelCost??calculatedCost):calculatedCost;
 const jetlag=online||km===null||travelClass==='business'?0:Math.min(3,Math.floor(km/3500)+(consecutive?1:0));
 return {from:origin,to:destination,km,cost,jetlag,consecutive,travelClass};
}
export function arriveForEvent(save:GameSave,entry:EventRegistration):GameSave {
 if(entry.details?.host?.mode==='online')return save;
 const state=systemsOf(save),travel=entry.travel??{...travelQuote(save,{...entry,id:entry.eventId}),jetlag:0};
 const penalty=travel.jetlag;
 return {...save,careerSystems:{...state,location:{city:entry.details?.location??'',country:entry.details?.country??save.player.country,day:gameDay(save)},...(penalty?{jetlag:{until:gameDay(save)+2,penalty}}:{jetlag:undefined})},player:penalty?{...save.player,ap:{...save.player.ap,current:Math.max(0,save.player.ap.current-penalty)}}:save.player};
}
export function applyJetlag(save:GameSave):GameSave {
 const state=systemsOf(save);if(!state.jetlag)return save;
 if(gameDay(save)>=state.jetlag.until)return {...save,careerSystems:{...state,jetlag:undefined}};
 return {...save,player:{...save.player,ap:{...save.player.ap,current:Math.min(save.player.ap.current,Math.max(1,save.player.ap.max-state.jetlag.penalty))}}};
}
