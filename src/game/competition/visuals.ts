import type { EventDetails } from './types';
export function eventAccent(details?:EventDetails,level?:string) {
  if(details?.format==='team')return {color:'#70a6da',label:'National teams'};
  if(details?.qualificationCircuit)return {color:'#c29be8',label:'Qualification'};
  if(details?.qualification||level==='elite')return {color:'#d6b65b',label:'Elite'};
  if(details?.organizer?.sponsorId)return {color:'#e29b70',label:'Sponsor'};
  if(details?.maxAge)return {color:'#64cbb5',label:'Junior'};
  if(level==='international')return {color:'#7aa6d1',label:'International'};
  if(level==='national')return {color:'#b0b96d',label:'National'};
  return {color:'#8eaa84',label:'Open'};
}
