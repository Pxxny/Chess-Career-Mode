import { ChessPiece } from "@/components/game/ChessPiece";
import {
  MoveAnnotation,
  type BoardAnnotation,
} from "@/components/game/MoveAnnotation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  inCheck,
  legalMoves,
  squareName,
  type Move,
  type Position,
} from "@/game/chess/board";
import { moveToUci } from "@/game/chess/rules";
import { cn } from "@/utils/cn";
import { useBoardSounds } from "@/audio/useBoardSounds";

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
  position: Position;
  perspective: "white" | "black";
  /** The colour the player may move, or null when the board is only for viewing */
  playerColor: "white" | "black" | null;
  /** True while it is the player's turn and moves are accepted */
  canMove: boolean;
  lastMove?: { from: number; to: number } | null;
  /** A suggested move (UCI) to draw */
  hint?: string | null;
  onMove: (move: Move) => void;
}

const colorOf = (p: string): "white" | "black" =>
  p === p.toUpperCase() ? "white" : "black";

/**
 * An interactive board: click a piece, then a highlighted square. Squares are buttons, so the board works with
 * the keyboard too: arrow keys move the focus, Enter or Space selects. Promotions open a small picker.
 */
export function PlayBoard({
  annotation,
  position,
  perspective,
  playerColor,
  canMove,
  lastMove,
  hint,
  onMove,
}: Props) {
  useBoardSounds(position);
  const [selected, setSelected] = useState<number | null>(null);
  const [promotion, setPromotion] = useState<Move[] | null>(null);
  const [focus, setFocus] = useState<number>(perspective === "white" ? 60 : 4);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const legal = useMemo(() => legalMoves(position), [position]);
  const targets = useMemo(
    () => (selected === null ? [] : legal.filter((m) => m.from === selected)),
    [legal, selected],
  );
  const checkedKing = useMemo(
    () =>
      inCheck(position)
        ? position.board.findIndex(
            (p) => p === (position.turn === "w" ? "K" : "k"),
          )
        : -1,
    [position],
  );

  // A new position (a move was played, or undone) clears any half-made move.
  useEffect(() => {
    setSelected(null);
    setPromotion(null);
  }, [position]);

  const order = useMemo(() => {
    const all = Array.from({ length: 64 }, (_, i) => i);
    return perspective === "white" ? all : all.reverse();
  }, [perspective]);

  const mine = (i: number): boolean => {
    const p = position.board[i];
    return (
      !!p &&
      playerColor !== null &&
      colorOf(p) === playerColor &&
      (position.turn === "w") === (playerColor === "white")
    );
  };

  const choose = (i: number) => {
    if (!canMove || playerColor === null) return;
    if (selected !== null && selected !== i) {
      // Castling shortcut: king and its rook, selected in either order.
      const a = position.board[selected],
        b = position.board[i];
      if (a && b && colorOf(a) === colorOf(b)) {
        const pair = `${a.toUpperCase()}${b.toUpperCase()}`;
        if (
          (pair === "KR" || pair === "RK") &&
          Math.floor(selected / 8) === Math.floor(i / 8)
        ) {
          const king = pair === "KR" ? selected : i,
            rook = pair === "KR" ? i : selected,
            to = rook % 8 > king % 8 ? king + 2 : king - 2;
          const castle = legal.find((m) => m.from === king && m.to === to);
          if (castle && mine(king)) return onMove(castle);
        }
      }
    }
    if (selected !== null) {
      const options = legal.filter((m) => m.from === selected && m.to === i);
      if (options.length === 1) return onMove(options[0]);
      if (options.length > 1) return setPromotion(options);
    }
    setSelected(mine(i) && i !== selected ? i : null);
  };

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const col = focus % 8;
    const row = Math.floor(focus / 8);
    const flip = perspective === "white" ? 1 : -1;
    let next = focus;
    if (event.key === "ArrowRight")
      next = row * 8 + Math.min(7, Math.max(0, col + flip));
    else if (event.key === "ArrowLeft")
      next = row * 8 + Math.min(7, Math.max(0, col - flip));
    else if (event.key === "ArrowDown")
      next = Math.min(7, Math.max(0, row + flip)) * 8 + col;
    else if (event.key === "ArrowUp")
      next = Math.min(7, Math.max(0, row - flip)) * 8 + col;
    else if (event.key === "Escape") {
      setSelected(null);
      setPromotion(null);
      return;
    } else return;
    event.preventDefault();
    setFocus(next);
    refs.current[next]?.focus();
  };

  const hintFrom = hint ? hint.slice(0, 2) : null;
  const hintTo = hint ? hint.slice(2, 4) : null;
  const describe = (i: number): string => {
    const p = position.board[i];
    const parts = [
      squareName(i),
      p ? `${colorOf(p)} ${NAMES[p.toUpperCase()]}` : "empty",
    ];
    if (i === selected) parts.push("selected");
    const t = targets.find((m) => m.to === i);
    if (t) parts.push(t.capture ? "capture available" : "move available");
    if (i === checkedKing) parts.push("in check");
    return parts.join(", ");
  };

  return (
    <div className="relative mx-auto w-full max-w-[34rem]">
      <div
        role="grid"
        aria-label="Chess board"
        onKeyDown={onKey}
        className="grid aspect-square w-full grid-cols-8 grid-rows-8 overflow-hidden rounded-lg border border-white/10 select-none"
      >
        {order.map((i) => {
          const piece = position.board[i];
          const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
          const target = targets.find((m) => m.to === i);
          const isLast = lastMove && (lastMove.from === i || lastMove.to === i);
          const isHint = hintFrom === squareName(i) || hintTo === squareName(i);
          const file = i % 8;
          const rank = Math.floor(i / 8);
          const showFile = perspective === "white" ? rank === 7 : rank === 0;
          const showRank = perspective === "white" ? file === 0 : file === 7;
          return (
            <button
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="gridcell"
              tabIndex={focus === i ? 0 : -1}
              aria-label={describe(i)}
              aria-selected={i === selected}
              onFocus={() => setFocus(i)}
              onClick={() => choose(i)}
              className={cn(
                "relative flex items-center justify-center text-[clamp(1.4rem,8.2vw,3.1rem)] leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold-400",
                dark ? "bg-[#005542]" : "bg-[#e4e2de]",
                isLast && (dark ? "bg-yellow-600/70" : "bg-yellow-300/90"),
                isHint && "ring-2 ring-inset ring-sky-400",
                i === selected && "bg-gold-500/80",
                i === checkedKing && "bg-red-500/80",
              )}
            >
              {showFile && (
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute bottom-0 right-0.5 text-[0.55rem] font-bold",
                    dark ? "text-stone-200" : "text-emerald-800",
                  )}
                >
                  {"abcdefgh"[file]}
                </span>
              )}
              {showRank && (
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute left-0.5 top-0 text-[0.55rem] font-bold",
                    dark ? "text-stone-200" : "text-emerald-800",
                  )}
                >
                  {8 - rank}
                </span>
              )}
              {piece && <ChessPiece piece={piece} />}
              <MoveAnnotation annotation={annotation} square={i} />
              {target && (
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute rounded-full bg-black/35",
                    target.capture
                      ? "inset-1 border-4 border-black/35 bg-transparent"
                      : "h-1/4 w-1/4",
                  )}
                />
              )}
            </button>
          );
        })}
      </div>

      {promotion && (
        <div
          role="dialog"
          aria-label="Choose a promotion piece"
          className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-navy-950/80"
        >
          <div className="w-full max-w-[18rem] rounded-xl border border-white/10 bg-navy-800 p-2 text-center sm:p-4">
            <p className="mb-3 text-sm font-semibold text-ink">Promote to</p>
            <div className="grid grid-cols-4 gap-1 sm:gap-2">
              {promotion.map((m) => (
                <button
                  key={moveToUci(m)}
                  type="button"
                  autoFocus={m.promotion?.toUpperCase() === "Q"}
                  aria-label={`Promote to ${NAMES[(m.promotion ?? "Q").toUpperCase()]}`}
                  onClick={() => onMove(m)}
                  className="flex aspect-square w-full items-center justify-center rounded-lg bg-stone-200 text-3xl text-black hover:bg-gold-400 sm:text-4xl"
                >
                  <ChessPiece
                    piece={
                      position.turn === "w"
                        ? (m.promotion ?? "Q")
                        : (m.promotion ?? "Q").toLowerCase()
                    }
                  />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPromotion(null)}
              className="mt-3 text-xs text-ink-muted underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
