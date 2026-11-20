import { keresGroupTable, KERES_GROUP_RULES } from "@/game/competition/keres";
import type { ActiveTournament } from "@/types";

export function KeresGroupStandings({ tournament }: { tournament: ActiveTournament }) {
  return <section className="my-4 space-y-2">
    <h3 className="font-semibold">Paul Keres Cup groups</h3>
    <p className="text-xs text-ink-muted">{KERES_GROUP_RULES} Top 2 advance.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      {keresGroupTable(tournament).map((group, groupIndex) => (
        <div key={groupIndex} className="rounded-lg bg-navy-900 p-3">
          <h4 className="mb-2 text-sm font-semibold">Group {String.fromCharCode(65 + groupIndex)}</h4>
          <ol className="space-y-1 text-sm">
            {group.map((player, index) => (
              <li key={player.id} className={`grid grid-cols-[1.5rem_minmax(0,1fr)_auto] gap-2 ${index < 2 ? "text-gold-300" : "text-ink-muted"}`}>
                <span>{index + 1}</span><span className="break-words">{player.name}</span><strong>{player.points} pts</strong>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  </section>;
}
