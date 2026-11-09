export interface BoardAnnotation {
  from: number;
  to: number;
  label: "blunder" | "brilliant";
}
export const boardAnnotation = (
  move: { from: number; to: number } | null | undefined,
  label: string | null | undefined,
): BoardAnnotation | null =>
  move && (label === "blunder" || label === "brilliant")
    ? { from: move.from, to: move.to, label }
    : null;
export function MoveAnnotation({
  annotation,
  square,
}: {
  annotation?: BoardAnnotation | null;
  square: number;
}) {
  if (!annotation || (annotation.from !== square && annotation.to !== square))
    return null;
  const bad = annotation.label === "blunder";
  return (
    <>
      <span
        aria-hidden
        data-move-highlight={annotation.label}
        className="pointer-events-none absolute inset-0 z-[1] border-[3px]"
        style={{
          borderColor: bad ? "#991b1b" : "#7dd3fc",
          backgroundColor: bad ? "#991b1b55" : "#7dd3fc55",
        }}
      />
      {square === annotation.to && (
        <span
          role="img"
          aria-label={bad ? "Blunder ??" : "Brilliant !!"}
          data-testid="move-annotation"
          data-judgment={annotation.label}
          className="pointer-events-none absolute right-0 top-0 z-[2] flex h-[40%] min-h-4 w-[40%] min-w-4 items-center justify-center rounded-bl-md text-[clamp(0.65rem,3vw,1.25rem)] font-extrabold leading-none shadow-sm"
          style={{
            color: bad ? "#fff" : "#082f49",
            backgroundColor: bad ? "#991b1b" : "#7dd3fc",
          }}
        >
          {bad ? "??" : "!!"}
        </span>
      )}
    </>
  );
}
