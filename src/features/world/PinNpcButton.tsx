import { useContext } from "react";
import { LanguageContext } from "@/i18n/context";
import { Bookmark,BookmarkCheck } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { watchlistIds } from '@/game/social/directory';
import { translateUI as t } from '@/i18n/translate';
export function PinNpcButton({npc}:{npc:{id:string;name:string}}) {
 useContext(LanguageContext);
 const count=useGameStore(s=>s.save?watchlistIds(s.save).length:0);
 const pinned=useGameStore(s=>!!s.save&&watchlistIds(s.save).includes(npc.id)),toggle=useGameStore(s=>s.toggleNpcWatchlist);
 return <button type="button" data-testid="pin-npc" aria-label={`${t(pinned?'Unpin NPC':'Pin NPC')}: ${npc.name}`} aria-pressed={pinned} disabled={!pinned&&count>=500} title={t(!pinned&&count>=500?"Watchlist limit reached":pinned?'Remove from watchlist':'Add to watchlist')} onClick={()=>toggle(npc.id)} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border ${pinned?'border-gold-500/40 bg-gold-500/10 text-gold-300':'border-white/10 text-ink-faint hover:text-gold-300'}`}>{pinned?<BookmarkCheck size={17}/>:<Bookmark size={17}/>}</button>;
}
