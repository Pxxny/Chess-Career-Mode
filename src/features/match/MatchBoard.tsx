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
  type PointerEvent as ReactPointerEvent,
} from "react";
import { squareName, type Position } from "@/game/chess/board";
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
const colorOf = (p: string): "white" | "black" =>
  p === p.toUpperCase() ? "white" : "black";
const indexOf = (name: string): number =>
  (8 - Number(name[1])) * 8 + (name.charCodeAt(0) - 97);

export interface MatchBoardProps {
  annotation?: BoardAnnotation | null;
  position: Position;
  perspective: "white" | "black";
  /** Which side's pieces the person may move right now ('both' for a board with two human sides), or null to only look */
  movable: "white" | "black" | "both" | null;
  /** Legal destination squares ("e4") for a piece, from the referee (chess.js) */
  legalTargets: (from: string) => string[];
  /** Called with a UCI move such as "e2e4" or "e7e8q" */
  onMove: (uci: string) => void;
  lastMove: { from: number; to: number } | null;
  /** King square of the side in check, or -1 */
  checkSquare: number;
  /** King of the checkmated side, or -1 */
  mateSquare?: number;
  /** Both kings after a stalemate or a draw */
  drawSquares?: number[];
}

interface Drag {
  from: number;
  x: number;
  y: number;
  moved: boolean;
}

/**
 * The match board. Pieces can be dragged with the mouse, a finger or a pen, or moved by clicking a piece and then
 * a highlighted square, or with the keyboard (arrow keys, Enter). Legal moves come from the referee. The last
 * move, the selected piece, check, checkmate and stalemate are highlighted.
 */
export function MatchBoard({
  annotation,
  position,
  perspective,
  movable,
  legalTargets,
  onMove,
  lastMove,
  checkSquare,
  mateSquare = -1,
  drawSquares = [],
}: MatchBoardProps) {
  useBoardSounds(position);
  const [selected, setSelected] = useState<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [promotion, setPromotion] = useState<{
    from: number;
    to: number;
  } | null>(null);
  const [focus, setFocus] = useState<number>(perspective === "white" ? 60 : 4);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const dragRef = useRef<Drag | null>(null);

  const order = useMemo(() => {
    const all = Array.from({ length: 64 }, (_, i) => i);
    return perspective === "white" ? all : all.reverse();
  }, [perspective]);

  const targets = useMemo(
    () =>
      selected === null ? [] : legalTargets(squareName(selected)).map(indexOf),
    [selected, legalTargets, position],
  );

  // A new position (a move was played or the view changed) clears any half-made move.
  useEffect(() => {
    setSelected(null);
    setPromotion(null);
    dragRef.current = null;
    setDrag(null);
  }, [position]);

  const canPick = (i: number): boolean => {
    const p = position.board[i];
    if (!p || movable === null) return false;
    if ((position.turn === "w") !== (colorOf(p) === "white")) return false;
    return movable === "both" || movable === colorOf(p);
  };

  const squareAt = (clientX: number, clientY: number): number | null => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const col = Math.floor(((clientX - rect.left) / rect.width) * 8);
    const row = Math.floor(((clientY - rect.top) / rect.height) * 8);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    return perspective === "white" ? row * 8 + col : 63 - (row * 8 + col);
  };

  const attempt = (from: number, to: number): boolean => {
    if (from === to) return false;
    const legal = legalTargets(squareName(from));
    if (!legal.includes(squareName(to))) return false;
    const piece = position.board[from];
    const lastRank = Math.floor(to / 8) === 0 || Math.floor(to / 8) === 7;
    if (piece && piece.toUpperCase() === "P" && lastRank) {
      setPromotion({ from, to });
      return true;
    }
    onMove(squareName(from) + squareName(to));
    return true;
  };

  /** Castling shortcut: the king and the rook it castles with, selected in either order. */
  const castleMove = (a: number, b: number): { from: number; to: number } | null => {
    const pa = position.board[a],
      pb = position.board[b];
    if (!pa || !pb) return null;
    let king = a,
      rook = b;
    if (pa.toUpperCase() === "R" && pb.toUpperCase() === "K") {
      king = b;
      rook = a;
    } else if (!(pa.toUpperCase() === "K" && pb.toUpperCase() === "R"))
      return null;
    if (
      colorOf(pa) !== colorOf(pb) ||
      Math.floor(king / 8) !== Math.floor(rook / 8) ||
      !canPick(king)
    )
      return null;
    const to = rook % 8 > king % 8 ? king + 2 : king - 2;
    return legalTargets(squareName(king)).includes(squareName(to))
      ? { from: king, to }
      : null;
  };

  /** Click or keyboard selection of a square. */
  const choose = (i: number) => {
    if (selected !== null && selected !== i) {
      const castle = castleMove(selected, i);
      if (castle) {
        attempt(castle.from, castle.to);
        setSelected(null);
        return;
      }
    }
    if (selected !== null && selected !== i && attempt(selected, i)) {
      setSelected(null);
      return;
    }
    setSelected(canPick(i) && i !== selected ? i : null);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    if (promotion) return;
    const i = squareAt(event.clientX, event.clientY);
    if (i === null) return;
    if (selected !== null && selected !== i && targets.includes(i)) {
      choose(i);
      return;
    }
    if (selected !== null && selected !== i) {
      const castle = castleMove(selected, i);
      if (castle) {
        attempt(castle.from, castle.to);
        setSelected(null);
        event.preventDefault();
        return;
      }
    }
    if (canPick(i)) {
      setSelected(i);
      const d = { from: i, x: event.clientX, y: event.clientY, moved: false };
      dragRef.current = d;
      setDrag(d);
      boardRef.current?.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    } else {
      setSelected(null);
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const moved =
      d.moved || Math.hypot(event.clientX - d.x, event.clientY - d.y) > 5;
    const next = {
      ...d,
      moved,
      x: moved ? event.clientX : d.x,
      y: moved ? event.clientY : d.y,
    };
    dragRef.current = next;
    setDrag(next);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d) return;
    boardRef.current?.releasePointerCapture?.(event.pointerId);
    if (!d.moved) return; // a click: the piece stays selected and shows its moves
    const to = squareAt(event.clientX, event.clientY);
    if (to !== null && attempt(d.from, to)) setSelected(null);
  };

  const onPointerCancel = () => {
    dragRef.current = null;
    setDrag(null);
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
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(focus);
      return;
    } else if (event.key === "Escape") {
      setSelected(null);
      setPromotion(null);
      return;
    } else return;
    event.preventDefault();
    setFocus(next);
    refs.current[next]?.focus();
  };

  const describe = (i: number): string => {
    const p = position.board[i];
    const parts = [
      squareName(i),
      p ? `${colorOf(p)} ${NAMES[p.toUpperCase()]}` : "empty",
    ];
    if (i === selected) parts.push("selected");
    if (targets.includes(i))
      parts.push(position.board[i] ? "capture available" : "move available");
    if (i === checkSquare) parts.push("in check");
    if (i === mateSquare) parts.push("checkmated");
    if (annotation?.to === i) parts.push(annotation.label);
    return parts.join(", ");
  };

  const dragging = drag?.moved ? drag : null;
  const draggedPiece = dragging ? position.board[dragging.from] : null;
  const rect = boardRef.current?.getBoundingClientRect();
  const cell = rect ? rect.width / 8 : 48;
  const promoPieces = ["Q", "R", "B", "N"];

  return (
    <div
      className="relative mx-auto w-full max-w-[40rem]"
      data-testid="match-board"
    >
      <div
        ref={boardRef}
        role="grid"
        aria-label="Chess board"
        onKeyDown={onKey}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        className="grid aspect-square w-full touch-none grid-cols-8 grid-rows-8 overflow-hidden rounded-lg border border-white/10 select-none"
      >
        {order.map((i) => {
          const piece = position.board[i];
          const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
          const isTarget = targets.includes(i);
          const isLast = lastMove && (lastMove.from === i || lastMove.to === i);
          const file = i % 8;
          const rank = Math.floor(i / 8);
          const showFile = perspective === "white" ? rank === 7 : rank === 0;
          const showRank = perspective === "white" ? file === 0 : file === 7;
          const hidden = dragging && dragging.from === i;
          return (
            <button
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="gridcell"
              data-square={squareName(i)}
              data-selected={i === selected ? "true" : undefined}
              data-target={isTarget ? "true" : undefined}
              data-last={isLast ? "true" : undefined}
              data-check={i === checkSquare ? "true" : undefined}
              tabIndex={focus === i ? 0 : -1}
              aria-label={describe(i)}
              aria-selected={i === selected}
              onFocus={() => setFocus(i)}
              className={cn(
                "relative flex items-center justify-center text-[clamp(1.6rem,8.6vw,3.6rem)] leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold-400",
                dark ? "bg-[#005542]" : "bg-[#e4e2de]",
                isLast && (dark ? "bg-yellow-600/70" : "bg-yellow-300/90"),
                i === selected && "bg-gold-500/80",
                drawSquares.includes(i) && "bg-sky-400/70",
                i === checkSquare && "bg-red-500/80",
                i === mateSquare && "bg-red-600",
                isTarget && !piece && "cursor-pointer",
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
              {piece && (
                <ChessPiece
                  piece={piece}
                  className={hidden ? "opacity-30" : undefined}
                />
              )}
              <MoveAnnotation annotation={annotation} square={i} />
              {isTarget && (
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute rounded-full",
                    piece
                      ? "inset-1 border-4 border-black/35"
                      : "h-1/4 w-1/4 bg-black/35",
                  )}
                />
              )}
            </button>
          );
        })}
      </div>

      {dragging && draggedPiece && (
        <span
          aria-hidden
          data-testid="drag-ghost"
          className={cn(
            "pointer-events-none fixed z-40 flex items-center justify-center leading-none",
            draggedPiece === draggedPiece.toUpperCase()
              ? "text-white [text-shadow:0_0_2px_#000,0_0_2px_#000,0_0_3px_#000]"
              : "text-black",
          )}
          style={{
            left: dragging.x - cell / 2,
            top: dragging.y - cell / 2,
            width: cell,
            height: cell,
            fontSize: cell * 0.8,
          }}
        >
          <ChessPiece piece={draggedPiece} />
        </span>
      )}

      {promotion && (
        <div
          role="dialog"
          aria-label="Choose a promotion piece"
          className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-navy-950/80"
        >
          <div className="w-full max-w-[18rem] rounded-xl border border-white/10 bg-navy-800 p-2 text-center sm:p-4">
            <p className="mb-3 text-sm font-semibold text-ink">Promote to</p>
            <div className="grid grid-cols-4 gap-1 sm:gap-2">
              {promoPieces.map((p) => (
                <button
                  key={p}
                  type="button"
                  autoFocus={p === "Q"}
                  data-promote={p.toLowerCase()}
                  aria-label={`Promote to ${NAMES[p]}`}
                  onClick={() => {
                    onMove(
                      squareName(promotion.from) +
                        squareName(promotion.to) +
                        p.toLowerCase(),
                    );
                    setPromotion(null);
                  }}
                  className="flex aspect-square w-full items-center justify-center rounded-lg bg-stone-200 text-3xl text-black hover:bg-gold-400 sm:text-4xl"
                >
                  <ChessPiece
                    piece={position.turn === "w" ? p : p.toLowerCase()}
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
