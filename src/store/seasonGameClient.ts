import { create } from "zustand";
import {
  playSeasonGame,
  type SeasonGameInput,
  type SeasonGameFinish,
} from "@/game/career/seasonGame";
export const useSeasonGameStatus = create<{
  started: number | null;
  ply: number;
}>(() => ({ started: null, ply: 0 }));
export function createSeasonGameClient() {
  const worker =
    typeof Worker === "undefined"
      ? null
      : new Worker(
          new URL("../game/career/seasonGame.worker.ts", import.meta.url),
          { type: "module" },
        );
  let rejectPending: ((e: Error) => void) | null = null;
  return {
    play: async (input: SeasonGameInput): Promise<SeasonGameFinish> => {
      const started = performance.now();
      useSeasonGameStatus.setState({ started, ply: 0 });
      try {
        if (!worker) {
          const f = await playSeasonGame(input, (ply) =>
            useSeasonGameStatus.setState({ ply }),
          );
          f.recording.roundTripMs = performance.now() - started;
          return f;
        }
        return await new Promise<SeasonGameFinish>((resolve, reject) => {
          rejectPending = reject;
          worker.onmessage = (e) => {
            if (e.data.type === "progress")
              useSeasonGameStatus.setState({ ply: e.data.ply });
            else if (e.data.type === "done") {
              rejectPending = null;
              e.data.finish.recording.roundTripMs = performance.now() - started;
              resolve(e.data.finish);
            } else {
              rejectPending = null;
              reject(new Error(e.data.message));
            }
          };
          worker.onerror = () => {
            rejectPending = null;
            reject(new Error("The season game worker could not run."));
          };
          const save = input.save;
          worker.postMessage({
            ...input,
            save: {
              ...save,
              calendarTournaments: undefined,
              tournamentArchivePending: undefined,
              matchArchivePending: undefined,
              matches: [],
              seasonSimulation: undefined,
              history: {
                ...save.history,
                tournaments: [],
                trophies: [],
                news: [],
                training: [],
                sessions: [],
                ledger: [],
                ratingHistory: [],
              },
              competition: save.competition
                ? { ...save.competition, archive: [] }
                : undefined,
            },
          });
        });
      } finally {
        useSeasonGameStatus.setState({ started: null, ply: 0 });
      }
    },
    dispose: () => {
      worker?.terminate();
      rejectPending?.(new Error("Season game stopped."));
      useSeasonGameStatus.setState({ started: null, ply: 0 });
    },
  };
}
