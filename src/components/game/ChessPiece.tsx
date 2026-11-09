import { cn } from "@/utils/cn";
/** The same local SVG source is used by live, replay, opening and promotion boards on every OS. */
export function ChessPiece({
  piece,
  className,
}: {
  piece: string;
  className?: string;
}) {
  if (!/^[KQRBNPkqrbnp]$/.test(piece)) return null;
  const name = `${piece === piece.toUpperCase() ? "w" : "b"}${piece.toUpperCase()}`;
  return (
    <img
      data-piece={name}
      src={`${import.meta.env?.BASE_URL ?? "/"}pieces/cburnett/${name}.svg`}
      alt=""
      aria-hidden
      draggable={false}
      width={45}
      height={45}
      className={cn(
        "pointer-events-none h-[88%] w-[88%] select-none object-contain",
        className,
      )}
    />
  );
}
