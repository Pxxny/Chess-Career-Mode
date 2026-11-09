import { ChessPiece } from "@/components/game/ChessPiece";
import {
  MoveAnnotation,
  type BoardAnnotation,
} from "@/components/game/MoveAnnotation";
import { parseFen } from "@/game/chess/board";
import { cn } from "@/utils/cn";

const NAMES: Record<string, string> = {
  K: "king",
  Q: "queen",
  R: "rook",
  B: "bishop",
  N: "knight",
  P: "pawn",
};

interface Props {
  annotation?: BoardAnnotation | null;
  fen: string;
  /** Show the board from this side */
  perspective?: "white" | "black";
  label?: string;
}

const squareName = (i: number): string =>
  `${"abcdefgh"[i % 8]}${8 - Math.floor(i / 8)}`;

/** Draws a position from a FEN. Also describes the pieces in text for screen readers. */
export function PositionBoard({
  annotation,
  fen,
  perspective = "white",
  label = "Chess position",
}: Props) {
  const { board, turn } = parseFen(fen);
  const order = Array.from({ length: 64 }, (_, i) => i);
  const squares = perspective === "white" ? order : [...order].reverse();
  const describe = (color: "white" | "black"): string =>
    board
      .map((p, i) =>
        p && (p === p.toUpperCase()) === (color === "white")
          ? `${NAMES[p.toUpperCase()]} ${squareName(i)}`
          : null,
      )
      .filter(Boolean)
      .join(", ");

  return (
    <figure className="mx-auto w-full max-w-xs">
      <div
        role="img"
        aria-label={`${label}. ${turn === "w" ? "White" : "Black"} to move. White: ${describe("white")}. Black: ${describe("black")}.`}
        className="grid aspect-square w-full grid-cols-8 grid-rows-8 overflow-hidden rounded-lg border border-white/10"
      >
        {squares.map((i) => {
          const piece = board[i];
          const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
          return (
            <div
              key={i}
              aria-hidden
              className={cn(
                "relative flex items-center justify-center text-[clamp(1.1rem,6.5vw,2rem)] leading-none",
                dark ? "bg-[#005542]" : "bg-[#e4e2de]",
              )}
            >
              {piece && <ChessPiece piece={piece} />}
              <MoveAnnotation annotation={annotation} square={i} />
            </div>
          );
        })}
      </div>
      <figcaption className="mt-1 text-center text-xs text-ink-muted">
        {turn === "w" ? "White" : "Black"} to move
      </figcaption>
    </figure>
  );
}
