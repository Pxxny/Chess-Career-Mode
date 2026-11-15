import type { Qualification } from './types';
/** The same result rules drive awarded qualifications and the route diagram. */
export const CHAMPIONSHIP_ADVANCEMENTS:ReadonlyArray<{category:string;top:number;kind:Qualification}> = [
 {category:'Open Tournaments',top:1,kind:'grand-swiss'},
 {category:'National Championships',top:3,kind:'continental'},
 {category:'Continental Championships',top:3,kind:'world-cup'},
 {category:'Continental Championships',top:3,kind:'grand-swiss'},
 {category:'World Cup',top:2,kind:'candidates'},
 {category:'Grand Swiss',top:2,kind:'candidates'},
 {category:'Candidates Tournament',top:1,kind:'world-championship'},
 {category:'World Chess Championship',top:1,kind:'world-championship'},
];
export const standardQualificationGrants=(category:string|undefined,rank:number):Qualification[]=>
 CHAMPIONSHIP_ADVANCEMENTS.filter(rule=>rule.category===category&&rank>=1&&rank<=rule.top).map(rule=>rule.kind);
