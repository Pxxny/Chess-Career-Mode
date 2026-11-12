import type { MatchRecord } from "@/types";
import { dayLabel } from "@/game/competition/agenda";
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
export function matchPgn(m: MatchRecord) {
  const result =
    m.result === "draw" ? "1/2-1/2" : m.result === "white" ? "1-0" : "0-1";
  const date =
    m.day === undefined
      ? `${m.year}.??.??`
      : dayLabel((m.year * 52 + m.week - 1) * 7 + (m.day ?? 1) - 1)
          .slice(0, 10)
          .replace(/-/g, ".");
  const tags: Record<string, string> = {
    Event: m.setup.tournament?.name ?? "Career match",
    Site: "Chess Career Mode",
    Date: date,
    Round: String(m.setup.tournament?.round ?? "-"),
    White: m.setup.white.name,
    Black: m.setup.black.name,
    Result: result,
    WhiteElo: String(m.setup.white.elo),
    BlackElo: String(m.setup.black.elo),
    TimeControl:
      m.setup.timeControl.base > 0
        ? `${m.setup.timeControl.base}+${m.setup.timeControl.increment}`
        : "-",
    Termination: m.termination,
  };
  if (m.openingEco) tags.ECO = m.openingEco;
  if (m.openingName) tags.Opening = m.openingName;
  const moves = m.moves
    .map((san, i) => {
      const c = m.recording?.clocks[i + 1]?.[i % 2 ? "black" : "white"];
      return `${i % 2 === 0 ? `${i / 2 + 1}. ` : ""}${san}${typeof c === "number" ? ` {[%clk ${clock(c)}]}` : ""}`;
    })
    .join(" ");
  return (
    Object.entries(tags)
      .map(([k, v]) => `[${k} "${esc(v)}"]`)
      .join("\n") +
    "\n\n" +
    moves +
    " " +
    result +
    "\n"
  );
}
export function downloadPgn(m: MatchRecord) {
  const a = document.createElement("a"),
    url = URL.createObjectURL(
      new Blob([matchPgn(m)], {
        type: "application/x-chess-pgn;charset=utf-8",
      }),
    );
  a.href = url;
  a.download = `Chess-Career-${m.year}-${m.week}-${m.setup.tournament?.round ?? 1}.pgn`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
