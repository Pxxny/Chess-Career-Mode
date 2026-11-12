import { Chess } from "chess.js";
import { registerChessJs } from "@/game/match/referee";
import { playSeasonGame, type SeasonGameInput } from "./seasonGame";
registerChessJs(Chess);
self.onmessage = async (event: MessageEvent<SeasonGameInput>) => {
  try {
    const finish = await playSeasonGame(event.data, (ply) =>
      self.postMessage({ type: "progress", ply }),
    );
    self.postMessage({ type: "done", finish });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Season game failed",
    });
  }
};
