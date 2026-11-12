import { sharedMemories, rivalryLabel } from "@/game/social/memories";
import { dayLabel } from "@/game/competition/agenda";
import type { GameSave } from "@/types";
export function SharedMemories({
  save,
  npcId,
}: {
  save: GameSave;
  npcId: string;
}) {
  const memories = sharedMemories(save, npcId),
    r = save.social?.relationships[npcId];
  return (
    <section
      data-testid="shared-memories"
      className="mt-4 rounded-lg border border-white/10 p-3"
    >
      <h3 className="font-semibold">Shared memories</h3>
      <p className="mt-1 text-sm text-gold-300">{rivalryLabel(save, npcId)}</p>
      {r && (
        <p className="text-xs text-ink-muted">
          {r.ratedGames} rated meetings · {r.wins}W {r.draws}D {r.losses}L
        </p>
      )}
      <p className="mt-1 text-xs text-ink-muted">
        Competition builds a rivalry; friendship grows through social time
        together.
      </p>
      {r?.firstRatedMemory && (
        <p className="mt-2 text-xs text-ink-muted">
          First rated meeting: {dayLabel(r.firstRatedMemory.day).slice(0, 10)}
        </p>
      )}
      {memories.length ? (
        <ul className="mt-2 space-y-2 text-sm">
          {memories.map((m) => (
            <li key={m.id}>
              <span className="text-xs text-ink-muted">
                {dayLabel(m.day).slice(0, 10)}
              </span>
              <p>
                {m.kind === "rated" ? (
                  <>
                    <span>
                      {m.outcome === "win"
                        ? "You won"
                        : m.outcome === "draw"
                          ? "You drew"
                          : "You lost"}
                    </span>
                    {m.event && (
                      <>
                        {" "}
                        · <span translate="no">{m.event}</span>
                      </>
                    )}
                  </>
                ) : m.kind === "talk" ? (
                  "Talked together"
                ) : m.kind === "study" ? (
                  "Studied together"
                ) : (
                  "Played a friendly game together."
                )}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-ink-muted">No shared memories yet.</p>
      )}
    </section>
  );
}
