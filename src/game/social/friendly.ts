import { gameDay } from "@/game/competition/agenda";
import { buildMatchSetup } from "@/game/match/setup";
import { PRESETS } from "@/game/match/timeControls";
import type { MatchSetup, Speed } from "@/game/match/session";
import type { OpeningDatabase } from "@/game/openings/database";
import type { GameSave, Npc, PieceColor } from "@/types";
import { socialActionIssue } from "./relationships";

export const FRIENDLY_CONTROLS = [
  PRESETS.blitz[3],
  PRESETS.rapid[1],
  PRESETS.rapid[2],
];
export interface FriendlyOptions {
  color: PieceColor;
  timeControlId: string;
  speed: "brisk" | "fast";
}
export function beginFriendly(
  save: GameSave,
  npc: Npc,
  options: FriendlyOptions,
  db: OpeningDatabase,
):
  | { ok: false; error: string }
  | { ok: true; save: GameSave; setup: MatchSetup } {
  const p = save.social?.pending;
  if (
    !p ||
    p.npcId !== npc.id ||
    p.careerId !== save.career.id ||
    p.day !== gameDay(save)
  )
    return {
      ok: false,
      error: "This invitation has expired. Send a new invitation.",
    };
  if (p.started)
    return { ok: false, error: "This friendly game has already started." };
  const error = socialActionIssue(save, npc, "play", true);
  if (error) return { ok: false, error };
  const tc = FRIENDLY_CONTROLS.find((t) => t.id === options.timeControlId);
  if (
    !tc ||
    !["white", "black"].includes(options.color) ||
    !["brisk", "fast"].includes(options.speed)
  )
    return { ok: false, error: "Choose a valid time control and colour." };
  const next: GameSave = {
    ...save,
    player: {
      ...save.player,
      ap: { ...save.player.ap, current: save.player.ap.current - 1 },
    },
    training: {
      ...save.training,
      hoursUsedToday: save.training.hoursUsedToday + 1,
    },
    social: { ...save.social!, pending: { ...p, started: true } },
  };
  const setup = buildMatchSetup({
    save: next,
    npc,
    playerColor: options.color,
    timeControl: tc,
    rated: false,
    mode: "play",
    speed: options.speed as Speed,
    tournament: null,
    seed: save.social!.sequence,
    db,
  });
  return {
    ok: true,
    save: next,
    setup: {
      ...setup,
      social: { requestId: p.id, npcId: npc.id, careerId: save.career.id },
    },
  };
}
