import {useMemo} from 'react';import {useGameStore} from '@/store/gameStore';import {useNpcStore} from '@/store/npcStore';import {wonderkids} from '@/game/npc/wonderkids';
export function useWonderkids(){const save=useGameStore(s=>s.save),npcs=useNpcStore(s=>s.npcs);return useMemo(()=>save?wonderkids(save,npcs):null,[save,npcs]);}
export function WonderkidTags({id}:{id:string}){const model=useWonderkids(),tag=model?.tags.get(id);if(!tag||(!tag.groups.length&&!tag.overall&&!tag.hot))return null;return <span className="mt-1 flex flex-wrap gap-1" data-testid="wonderkid-tags">
 {(tag.groups.length>0||tag.overall)&&<span title={tag.groups.map(g=>`U${g.age} #${g.rank}`).join(' · ')} className="rounded-full border border-gold-500/25 bg-gold-500/10 px-2 py-0.5 text-[10px] font-semibold text-gold-300">Wonderkid{tag.overall?` · Top ${tag.overall}`:''}</span>}
 {tag.hot&&<span title="Based on the latest five rated games and current form" className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tag.hot==='Hot Kid'?'bg-orange-500/15 text-orange-300':'bg-sky-500/15 text-sky-300'}`}>{tag.hot}</span>}
 </span>;}
