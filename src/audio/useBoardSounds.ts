import { useEffect, useRef } from "react";
import type { Position } from "@/game/chess/board";
import { playSound } from "./sound";

/** Plays a move or capture sound whenever the displayed position changes (not on first render). */
export function useBoardSounds(position: Position): void {
  const previous = useRef<Position | null>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = position;
    if (!before || before === position) return;
    const count = (p: Position) => p.board.filter(Boolean).length;
    const a = count(before),
      b = count(position);
    if (a === b && before.board.every((p, i) => p === position.board[i]))
      return;
    playSound(b < a ? "capture" : "move");
  }, [position]);
}
