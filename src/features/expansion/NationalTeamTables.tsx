import { PinNpcButton } from "@/features/world/PinNpcButton";

type Player = { id: string; name: string; elo: number };
export type TeamTable = {
  board: number;
  white?: Player;
  black?: Player;
  assigned?: Player;
  score?: number | null;
};

export function NationalTeamTables({ tables }: { tables: TeamTable[] }) {
  return (
    <ol className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4" data-testid="national-team-tables">
      {tables.map(({ board, white, black, assigned, score }) => {
        const yours = [white, black, assigned].some((player) => player?.id === "player");
        return (
          <li key={board} className={`min-w-0 rounded-xl border p-2 text-center sm:p-3 ${yours ? "border-gold-500 bg-gold-500/10" : "border-white/10 bg-navy-900"}`}>
            <p className="mb-2 text-xs font-semibold text-gold-300">Table {board}</p>
            <div
              aria-hidden="true"
              className="mx-auto aspect-square w-full max-w-24 rounded-sm border-4 border-amber-950 bg-[#ead9ad]"
              style={{ backgroundImage: "repeating-conic-gradient(#79573c 0% 25%, #ead9ad 0% 50%)", backgroundSize: "25% 25%" }}
            />
            {assigned ? <Seat player={assigned} /> : white || black ? (
              <>
                <Seat player={white} color="White" />
                <Seat player={black} color="Black" />
                {score != null && <p className="mt-1 font-bold tabular-nums">{score === 1 ? "1–0" : score === 0 ? "0–1" : "½–½"}</p>}
              </>
            ) : <p className="mt-2 text-sm text-ink-muted">Vacant board</p>}
          </li>
        );
      })}
    </ol>
  );
}

function Seat({ player, color }: { player?: Player; color?: "White" | "Black" }) {
  return (
    <div className="mt-2 border-t border-white/10 pt-2">
      {color && <p className="text-xs text-ink-muted">{color}</p>}
      {player ? (
        <>
          <p className="break-words text-sm font-semibold text-ink" translate="no">{player.name}</p>
          <p className="text-xs tabular-nums text-ink-muted">Elo {player.elo}</p>
          {player.id === "player" ? <p className="text-xs text-gold-300">Your board</p> : <PinNpcButton npc={player} />}
        </>
      ) : <p className="text-xs text-ink-muted">Vacant board</p>}
    </div>
  );
}
