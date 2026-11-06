import { useSyncExternalStore } from 'react';
import { engineManager, type EngineInfo } from '@/game/engine/manager';

/** Live status of the chess engine: loading, Stockfish, or the built-in fallback. */
export const useEngineInfo = (): EngineInfo => useSyncExternalStore(engineManager.subscribe, engineManager.getInfo);
