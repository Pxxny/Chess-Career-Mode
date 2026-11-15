import { useEffect,useMemo,useRef,useSyncExternalStore } from 'react';
import { ChessPiece } from '@/components/game/ChessPiece';
import { useNpcs } from '@/hooks/useNpcs';
import { useGameStore } from '@/store/gameStore';
import { useOpeningDb } from '@/store/openingStore';
import { engineManager } from '@/game/engine/manager';
import { MatchSession,type MatchSetup } from '@/game/match/session';
import { buildNpcProfile } from '@/game/match/npcProfile';
import { opponentFromNpc } from '@/game/play/opponent';
import { sideForNpc } from '@/game/match/setup';
import { createRng,mixSeed } from '@/game/rng';
import { hashString } from '@/utils/format';
import type {ActiveTournament} from '@/types';
import type {BroadcastContext} from '@/game/competition/broadcast';
export function RoundBroadcast({t,context}:{t:ActiveTournament;context:BroadcastContext}) {
 const population=useNpcs(),pairs=t.pairings[context.round-1]??[];
 const live=useGameStore(s=>s.save?.tournament?.eventId===t.eventId?s.save.tournament:s.save?.calendarTournaments?.active.find(e=>e.eventId===t.eventId))??t;
 const playerMap=new Map(t.players.map(p=>[p.id,p]));
 const best=[...pairs.entries()].filter(([,p])=>p.black!=='bye'&&p.white!=='player'&&p.black!=='player').sort(([,a],[,b])=>(playerMap.get(b.white)?.elo??0)+(playerMap.get(b.black)?.elo??0)-(playerMap.get(a.white)?.elo??0)-(playerMap.get(a.black)?.elo??0)).slice(0,4);
 return <section className="mt-5" data-testid="round-broadcast"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Round {context.round} · live boards</h3><span className="text-xs text-gold-300">★ Top board</span></div><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{best.map(([index],rank)=>{
 const pair=live.pairings[context.round-1]?.[index];if(!pair)return null;
 const white=population.find(n=>n.id===pair.white),black=population.find(n=>n.id===pair.black);if(!white||!black)return null;
 const ctx={...context,board:index,white:white.id,black:black.id};
 return <div key={`${t.eventId}:${context.round}:${index}`} className={`min-w-0 rounded-xl border-2 p-2 ${rank===0?'border-amber-400/75 shadow-[0_0_20px_#d8b85a18]':'border-white/10'}`}><p className="mb-2 truncate text-[10px] font-semibold">{rank===0?'★ ':''}{white.name} — {black.name}</p>{index===context.board?<SavedMini pair={pair}/>:<MiniLive setup={{white:sideForNpc(white),black:sideForNpc(black),playerColor:'white',timeControl:t.timeControl,rated:false,tournament:null,accuracyBonus:0,seed:mixSeed(t.seed,hashString(`${context.round}:${pair.white}:${pair.black}`)),mode:'simulate',speed:'fast',profiles:{white:buildNpcProfile(white,opponentFromNpc(white).lines,{rng:createRng(t.seed),round:context.round}),black:buildNpcProfile(black,opponentFromNpc(black).lines,{rng:createRng(t.seed+1),round:context.round})}}} pair={pair} context={ctx}/>}</div>;
 })}</div></section>;
}
import { createGame,currentPosition,parseUci,makeMove } from '@/game/chess/rules';
import type { Position } from '@/game/chess/board';
function MiniPosition({position}:{position:Position}) {return <div className="grid aspect-square grid-cols-8 overflow-hidden rounded-md" aria-hidden>{position.board.map((piece,i)=><span key={i} className={`flex aspect-square items-center justify-center ${(Math.floor(i/8)+i%8)%2?'board-square-dark':'board-square-light'}`}>{piece&&<ChessPiece piece={piece}/>}</span>)}</div>;}
function SavedMini({pair}:{pair:ActiveTournament['pairings'][number][number]}) {
 let game=createGame();for(const uci of pair.broadcast?.ucis??[]){const move=parseUci(currentPosition(game),uci);if(!move)break;game=makeMove(game,move);}
 return <><MiniPosition position={currentPosition(game)}/><p className="mt-1 text-[10px] text-ink-muted">{pair.result===null?'Live':pair.result===.5?'½–½':pair.result===1?'1–0':'0–1'} · {game.ucis.length} plies</p></>;
}
function MiniLive({setup,pair,context}:{setup:MatchSetup;pair:ActiveTournament['pairings'][number][number];context:BroadcastContext}) {
 const db=useOpeningDb(),active=useRef(false);
 const session=useMemo(()=>new MatchSession({setup,db,engine:engineManager,autoAnalyze:false,liveEval:false,initialState:pair.broadcast}),[]);
 const snap=useSyncExternalStore(session.subscribe,session.getSnapshot);
 useEffect(()=>{active.current=true;if(pair.result!==null)return;let previous=-1;
 const persist=()=>{const snapshot=session.getSnapshot();if(snapshot.game.ucis.length===previous&&!snapshot.finish)return;previous=snapshot.game.ucis.length;useGameStore.getState().broadcastCheckpoint(context,session.broadcastState());};
 const unsubscribe=session.subscribe(persist);session.start();return()=>{unsubscribe();active.current=false;queueMicrotask(()=>{if(active.current)return;session.pause();useGameStore.getState().broadcastCheckpoint(context,session.broadcastState());session.dispose();});};
 },[session]);
 if(pair.result!==null&&snap.status==='ready')return <SavedMini pair={pair}/>;
 return <><MiniPosition position={snap.position}/><p className="mt-1 text-[10px] text-ink-muted">{snap.status==='over'?'Finished':'Live'} · {snap.game.ucis.length} plies</p></>;
}
