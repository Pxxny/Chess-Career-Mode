import { useMemo, useState } from "react";
import { useSave } from "@/hooks/useGame";
import { useNpcs } from "@/hooks/useNpcs";
import { careerPrediction } from "@/game/prediction/adapters";
import { playerOpponentId } from "@/game/match/tournament";
import { nextEsportsGame } from "@/game/esports/core";
import type { Npc, PieceColor } from "@/types";
import type { Opponent } from "@/game/play/opponent";
import type { CareerPredictionOptions } from "@/game/prediction/adapters";
import { PredictionPanel } from "./PredictionPanel";

export function CareerPredictionPanel({
  opponent,
  options,
  chooseColor = false,
}: {
  opponent: Npc | Opponent;
  options: Omit<CareerPredictionOptions, "id">;
  chooseColor?: boolean;
}) {
  const save = useSave();
  const [color, setColor] = useState<PieceColor | "unknown">(options.color);
  const actualColor = chooseColor ? color : options.color;
  const prediction = useMemo(
    () =>
      careerPrediction(save, opponent, {
        ...options,
        color: actualColor,
        id: "preview",
      }),
    [
      save,
      opponent,
      options.color,
      options.timeControl,
      options.eventId,
      options.eventName,
      options.round,
      options.rounds,
      options.tournamentType,
      options.importance,
      options.playerElo,
      options.opponentElo,
      options.opening,
      actualColor,
    ],
  );
  return (
    <div>
      {chooseColor && (
        <label className="mb-3 block text-sm text-ink-muted">
          Preview colour
          <select
            aria-label="Prediction preview colour"
            value={color}
            onChange={(e) => setColor(e.target.value as typeof color)}
            className="ml-3 rounded-lg bg-navy-900 p-2 text-ink"
          >
            <option value="unknown">Unknown / neutral</option>
            <option value="white">White</option>
            <option value="black">Black</option>
          </select>
        </label>
      )}
      <PredictionPanel prediction={prediction} preview />
    </div>
  );
}
/** Only announced pairings get a forecast: a registration without pairings never invents an opponent. */
export function UpcomingPredictions({
  circuit = "all",
}: {
  circuit?: "all" | "traditional" | "esports";
}) {
  const save = useSave(),
    npcs = useNpcs(),
    t = save.tournament;
  const next = t ? playerOpponentId(t) : null,
    esports = nextEsportsGame(save);
  const npc = next ? npcs.find((n) => n.id === next.id) : null;
  const enpc = esports ? npcs.find((n) => n.id === esports.opponent.id) : null;
  return (
    <>
      {circuit !== "esports" && t && next && npc && (
        <CareerPredictionPanel
          opponent={npc}
          options={{
            color: next.color,
            timeControl: t.timeControl.category,
            eventId: t.eventId,
            eventName: t.name,
            round: t.round,
            rounds: t.rounds,
            tournamentType: t.details?.category ?? "swiss",
          }}
        />
      )}
      {circuit !== "traditional" && esports && enpc && save.esports?.active && (
        <CareerPredictionPanel
          opponent={enpc}
          options={{
            color: esports.color,
            timeControl: save.esports.active.event.timeControl.category,
            eventId: esports.tournament.id,
            eventName: esports.tournament.name,
            round: esports.tournament.round,
            rounds: 3,
            tournamentType: "esports",
          }}
        />
      )}
      {circuit === "all" && !next && !esports && (
        <p className="my-3 text-sm text-ink-muted">
          No opponent paired yet. Match predictions appear here when a
          tournament round is announced.
        </p>
      )}
    </>
  );
}
