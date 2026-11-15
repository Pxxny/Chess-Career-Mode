import type { GameSave, PlayStyle, SkillKey } from '@/types';
export type TeamStrategy = 'balanced'|'anchor'|'attack';
export interface CareerSystems {
  travelClass:'economy'|'business';
  location?:{city:string;country:string;day:number};
  jetlag?:{until:number;penalty:number};
  captain:Record<string,{order:string[];strategy:TeamStrategy}>;
  press:Record<string,string>;
  academy?:{name:string;city:string;country:string;founded:number;income:number;students:Array<{id:string;joined:number;lastLesson:number;lessons?:number;focus:SkillKey;style:PlayStyle;seenPrizes:string[]}>};
  queue:Array<{eventId:string;name:string;status:'waiting'|'registered'|'blocked'|'expired';reason?:string}>;
  contracts:Array<{npcId:string;start:number;end:number;fee:number;salary:number;paidWeek:number}>;
  transferLog:Array<{day:number;name:string;fee:number;salary:number}>;
}
export const systemsOf=(save:GameSave):CareerSystems=>({travelClass:'economy',captain:{},press:{},queue:[],contracts:[],transferLog:[],...save.careerSystems});
