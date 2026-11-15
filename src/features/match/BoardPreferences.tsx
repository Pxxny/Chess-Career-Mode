import { unlockedBoardThemes } from "@/game/career/achievements";
import { usePreferences } from '@/store/preferences';
import { useGameStore } from '@/store/gameStore';
export function BoardPreferences() {
  const prefs = usePreferences();
  const save = useGameStore(s=>s.save);
  const trophies = save?.history.trophies ?? [];
  const unlocked=unlockedBoardThemes(save);
  const wins = save?.history.tournaments.filter(t=>t.rank === 1).length ?? 0;
  const boards = [{id:'green',name:'Tournament Green',unlocked:true},{id:'wood',name:'Wood',unlocked:true},{id:'ice',name:'Icy Blue',unlocked:unlocked.includes("ice"),requirement:'10 rated games'},{id:'royal',name:'Royal',unlocked:unlocked.includes("royal"),requirement:'Win a tournament'}] as const;
  return <details className="board-options rounded-xl bg-navy-900/60 p-3"><summary className="cursor-pointer text-sm font-semibold">Board & pieces</summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm">Board theme<select aria-label="Board theme" className="mt-1 w-full rounded-lg bg-navy-800 p-2" value={boards.some(b=>b.id===prefs.board&&b.unlocked)?prefs.board:'green'} onChange={e=>prefs.setBoard(e.target.value as typeof prefs.board)}>{boards.map(b=><option key={b.id} value={b.id} disabled={!b.unlocked}>{b.name}{!b.unlocked?` · ${b.requirement}`:''}</option>)}</select></label><label className="text-sm">Piece style<select aria-label="Piece style" className="mt-1 w-full rounded-lg bg-navy-800 p-2" value={prefs.pieces} onChange={e=>prefs.setPieces(e.target.value as typeof prefs.pieces)}><option value="classic">Classic</option><option value="ivory">Ivory & walnut</option><option value="midnight">Silver & midnight</option><option value="geometric">Geometric</option></select></label></div></details>;
}
