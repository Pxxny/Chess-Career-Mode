import {
  applyMove,
  inCheck,
  legalMoves,
  type Move,
  type Position,
} from "@/game/chess/board";
import { bookDepthFor, type Opponent } from "@/game/play/opponent";
import { normalizeMoves } from "@/game/openings/database";
import { lineScore, strengthFor, type Strength } from "@/game/engine/strength";
import type { Rng } from "@/game/rng";
import { moveToUci, parseUci } from "@/game/chess/rules";
import type {
  Npc,
  Personality,
  PlayStyle,
  Player,
  SkillKey,
  Skills,
  TrainingIntensity,
} from "@/types";
import type { SearchLine } from "@/game/engine/types";
import type { MatchTimeControl } from "@/types";

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

export type Phase = "opening" | "middlegame" | "endgame";

/** Everything that decides how one side plays: rating, skills, style, mood, tiredness and the clock. */
export interface MoveProfile {
  drawUseful?: boolean;
  searchScale?: number;
  earlyDraw?: boolean;
  priorityBook?: boolean;
  name: string;
  /** The rating shown to the players */
  baseElo: number;
  /** The rating this player actually plays at in this game, after morale, form and fatigue */
  effectiveElo: number;
  style: PlayStyle;
  personality: Personality | null;
  /** Skills this player is strong or weak in (an NPC) or skill levels relative to their own average (the player) */
  strengths: SkillKey[];
  weaknesses: SkillKey[];
  skills: Skills | null;
  morale: number;
  form: number;
  /** 0 fresh, 100 exhausted */
  fatigue: number;
  /** Half-moves played from the repertoire */
  bookDepth: number;
  lines: Opponent["lines"];
  /** 0 (loses on time) to 1 (perfect clock use) */
  clockSkill: number;
  /** Multiplier on thinking time: above 1 is slow and careful, below 1 is fast */
  pace: number;
  /** Never resigns */
  stubborn: boolean;
  /** Skill adjustments, centipawn-Elo, for each phase */
  phaseElo: Record<Phase, number>;
  isPlayer: boolean;
}

const INTENSITY_FATIGUE: Record<TrainingIntensity, number> = {
  minimal: 4,
  casual: 8,
  regular: 12,
  intense: 18,
  obsessive: 24,
};

const PERSONALITY_PACE: Partial<Record<Personality, number>> = {
  methodical: 1.15,
  perfectionist: 1.3,
  fiery: 0.8,
  fearless: 0.85,
  calm: 1.0,
  creative: 1.05,
};
const PERSONALITY_CLOCK: Partial<Record<Personality, number>> = {
  perfectionist: -0.18,
  methodical: 0.08,
  calm: 0.06,
  fiery: -0.06,
  creative: -0.04,
};

const PHASE_SKILL: Record<Phase, SkillKey> = {
  opening: "opening",
  middlegame: "middlegame",
  endgame: "endgame",
};

/** The phase of the game, from how much material is left and how many moves were played. */
export function phaseOf(pos: Position, ply: number): Phase {
  let heavy = 0;
  for (const p of pos.board) {
    if (!p) continue;
    const t = p.toUpperCase();
    heavy += t === "Q" ? 9 : t === "R" ? 5 : t === "B" || t === "N" ? 3 : 0;
  }
  if (heavy <= 24) return "endgame";
  return ply < 20 ? "opening" : "middlegame";
}

/**
 * The profile of a computer-controlled NPC. `round` and the training intensity raise fatigue over a tournament;
 * morale and form move the rating a little. All of it is deterministic for a given seed.
 */
export function buildNpcProfile(
  npc: Npc,
  opponentLines: Opponent["lines"],
  options: { rng: Rng; round?: number; baseEloOverride?: number },
): MoveProfile {
  const { rng } = options;
  const round = options.round ?? 1;
  const base = options.baseEloOverride ?? npc.currentElo;
  const ageFatigue = npc.age > 55 ? (npc.age - 55) * 0.4 : 0;
  const fatigue = clamp(
    INTENSITY_FATIGUE[npc.training.intensity] +
      (round - 1) * 4.5 +
      ageFatigue +
      rng.normal(0, 3),
    0,
    90,
  );
  const moraleAdj = (npc.morale - 50) * 0.45;
  const formAdj = (npc.form - 50) * 0.55;
  const fatigueAdj = -fatigue * 0.65;
  const personalityAdj =
    npc.personality === "fearless"
      ? 6
      : npc.personality === "ambitious"
        ? 4
        : 0;
  const effectiveElo = Math.round(
    clamp(
      base + moraleAdj + formAdj + fatigueAdj + personalityAdj,
      base - 150,
      base + 120,
    ),
  );
  const prep = npc.strengths.includes("opening")
    ? 4
    : npc.weaknesses.includes("opening")
      ? -4
      : 0;
  const clockSkill = clamp(
    0.55 +
      (npc.strengths.includes("timeManagement") ? 0.25 : 0) -
      (npc.weaknesses.includes("timeManagement") ? 0.25 : 0) +
      (PERSONALITY_CLOCK[npc.personality] ?? 0) +
      rng.normal(0, 0.05),
    0.1,
    1,
  );
  const phaseElo = { opening: 0, middlegame: 0, endgame: 0 } as Record<
    Phase,
    number
  >;
  for (const phase of ["opening", "middlegame", "endgame"] as Phase[]) {
    const skill = PHASE_SKILL[phase];
    phaseElo[phase] =
      (npc.strengths.includes(skill) ? 45 : 0) -
      (npc.weaknesses.includes(skill) ? 45 : 0);
  }
  return {
    name: npc.name,
    baseElo: npc.currentElo,
    effectiveElo,
    style: npc.style,
    personality: npc.personality,
    strengths: npc.strengths,
    weaknesses: npc.weaknesses,
    skills: null,
    morale: npc.morale,
    form: npc.form,
    fatigue: Math.round(fatigue),
    bookDepth: Math.max(4, bookDepthFor(effectiveElo) + prep),
    lines: opponentLines,
    clockSkill,
    pace: (PERSONALITY_PACE[npc.personality] ?? 1) * (npc.age > 60 ? 1.1 : 1),
    stubborn: npc.personality === "stubborn" || npc.personality === "fearless",
    phaseElo,
    isPlayer: false,
  };
}

/**
 * The profile used when the simulator plays the player's side. Skills above or below the player's own average
 * shift the strength in each phase; morale and fatigue from the career move the rating.
 */
export function buildPlayerProfile(
  player: Player,
  fatigue: number,
  lines: Opponent["lines"],
): MoveProfile {
  const values = Object.values(player.skills);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const moraleAdj = (player.morale - 50) * 0.45;
  const fatigueAdj = -fatigue * 0.65;
  const effectiveElo = Math.round(
    clamp(
      player.rating + moraleAdj + fatigueAdj,
      player.rating - 150,
      player.rating + 100,
    ),
  );
  const phaseElo = { opening: 0, middlegame: 0, endgame: 0 } as Record<
    Phase,
    number
  >;
  for (const phase of ["opening", "middlegame", "endgame"] as Phase[])
    phaseElo[phase] = clamp(
      (player.skills[PHASE_SKILL[phase]] - avg) * 1.1,
      -60,
      60,
    );
  const style: PlayStyle =
    player.tendencies.aggression >= 65
      ? "attacking"
      : player.tendencies.aggression <= 35
        ? "solid"
        : player.tendencies.complexity >= 65
          ? "dynamic"
          : "universal";
  const tm = player.skills.timeManagement;
  return {
    name: player.name,
    baseElo: player.rating,
    effectiveElo,
    style,
    personality: null,
    strengths: (Object.keys(player.skills) as SkillKey[]).filter(
      (k) => player.skills[k] >= avg + 8,
    ),
    weaknesses: (Object.keys(player.skills) as SkillKey[]).filter(
      (k) => player.skills[k] <= avg - 8,
    ),
    skills: player.skills,
    morale: player.morale,
    form: 50,
    fatigue: Math.round(fatigue),
    bookDepth: Math.max(
      4,
      bookDepthFor(effectiveElo) +
        Math.round((player.skills.opening - avg) / 6),
    ),
    lines,
    clockSkill: clamp(0.35 + tm / 160, 0.15, 0.95),
    pace: clamp(1.15 - tm / 300, 0.8, 1.2),
    stubborn: true,
    phaseElo,
    isPlayer: true,
  };
}

/** The rating a profile plays at in the current phase and clock situation. */
export function eloNow(
  profile: MoveProfile,
  phase: Phase,
  timePressure: number,
): number {
  const trouble = timePressure * (50 + (1 - profile.clockSkill) * 230);
  return Math.round(
    clamp(profile.effectiveElo + profile.phaseElo[phase] - trouble, 400, 3200),
  );
}

/**
 * 0 when there is plenty of time, up to 1 in desperate time trouble. Based on the share of the starting time
 * and on a floor of seconds, so a 1-minute game is not "in trouble" from the first move.
 */
export function timePressure(
  remainingMs: number,
  tc: MatchTimeControl,
): number {
  if (tc.category === "none") return 0;
  const floor = Math.max(8000, tc.base * 1000 * 0.08);
  if (remainingMs >= floor) return 0;
  return clamp(1 - remainingMs / floor, 0, 1);
}

/** Engine settings for this move. Time pressure and phase make the same player stronger or weaker. */
export function strengthForMove(
  profile: MoveProfile,
  phase: Phase,
  pressure: number,
  speedScale: number,
): Strength {
  const s = strengthFor(eloNow(profile, phase, pressure));
  return {
    ...s,
    multiPv: Math.max(s.multiPv, 3),
    movetime: Math.max(
      60,
      Math.round(s.movetime * speedScale * (profile.searchScale ?? 1)),
    ),
    temperature: s.temperature + Math.round(pressure * 40),
  };
}

// ---- style

interface Features {
  capture: boolean;
  check: boolean;
  castle: boolean;
  pawnPush: boolean;
  quiet: boolean;
  retreat: boolean;
}

function featuresOf(pos: Position, move: Move): Features {
  const next = applyMove(pos, move);
  const forward = pos.turn === "w" ? -1 : 1;
  const rankFrom = Math.floor(move.from / 8);
  const rankTo = Math.floor(move.to / 8);
  const check = inCheck(next);
  const capture = move.capture || !!move.enPassant;
  const isPawn = move.piece.toUpperCase() === "P";
  return {
    capture,
    check,
    castle: !!move.castle,
    pawnPush: isPawn && !capture,
    quiet: !capture && !check && !move.castle,
    retreat: !isPawn && (rankTo - rankFrom) * forward < 0,
  };
}

/** Centipawn bonuses each style gives to the kinds of move it likes. Small: they only break ties between good moves. */
const STYLE_WEIGHTS: Record<
  PlayStyle,
  Partial<Record<keyof Features, number>>
> = {
  attacking: { capture: 12, check: 16, pawnPush: 6, castle: -2, retreat: -8 },
  tactical: { capture: 10, check: 14 },
  dynamic: { pawnPush: 8, capture: 6, retreat: -4 },
  positional: { quiet: 7, pawnPush: 2, capture: -2 },
  defensive: { castle: 12, quiet: 6, retreat: 6, capture: -4, check: -6 },
  solid: { castle: 10, quiet: 6, retreat: 3, check: -4 },
  prophylactic: { quiet: 8, retreat: 8, castle: 6, check: -6 },
  universal: {},
};

export const styleBonus = (
  pos: Position,
  move: Move,
  style: PlayStyle,
): number => {
  const f = featuresOf(pos, move);
  const w = STYLE_WEIGHTS[style];
  let total = 0;
  for (const key of Object.keys(w) as Array<keyof Features>)
    if (f[key]) total += w[key] ?? 0;
  return total;
};

/**
 * Chooses between the engine's candidate lines. Weaker settings (higher temperature) sometimes pick a worse
 * move; the style bonus then favours the moves this player likes among the near-best ones.
 */
export function pickStyled(
  lines: SearchLine[],
  pos: Position,
  profile: MoveProfile,
  temperature: number,
  rng: Rng,
): SearchLine {
  if (lines.length <= 1) return lines[0];
  const legal = legalMoves(pos);
  const best = lineScore(lines[0]);
  const window = Math.max(25, temperature * 1.2);
  const pool = lines.filter(
    (l) => best - lineScore(l) <= window && parseUci(pos, l.uci, legal),
  );
  if (pool.length <= 1) return lines[0];
  const bonus = (l: SearchLine): number => {
    const move = parseUci(pos, l.uci, legal);
    return move ? styleBonus(pos, move, profile.style) : 0;
  };
  const noise = Math.max(8, temperature);
  return rng.weighted(pool, (l) =>
    Math.exp((lineScore(l) + bonus(l) - best) / noise),
  );
}

// ---- opening book and time

/** The next move of the NPC's repertoire (SAN), or null when out of book. */
export function bookMoveFor(
  profile: MoveProfile,
  color: "white" | "black",
  played: readonly string[],
  rng: Rng,
): string | null {
  const ply = played.length;
  if (ply >= profile.bookDepth) return null;
  const sans = normalizeMoves(played);
  const matching = profile.lines[color].filter(
    (line) =>
      line.length > ply &&
      normalizeMoves(line.slice(0, ply)).every((m, i) => m === sans[i]),
  );
  if (matching.length === 0) return null;
  return (profile.priorityBook ? matching[0] : rng.pick(matching))[ply];
}

/**
 * How long this move takes, in milliseconds of game time. Depends on the clock, the move number, whether it is
 * a book move, how careful the player is (pace) and how well they manage their clock.
 */
export function thinkTimeMs(
  profile: MoveProfile,
  rng: Rng,
  input: {
    remainingMs: number;
    incrementMs: number;
    ply: number;
    fromBook: boolean;
    tc: MatchTimeControl;
    complexity?: number;
  },
): number {
  const { remainingMs, incrementMs, ply, fromBook, tc } = input;
  if (tc.category === "none") return Math.round(rng.float(300, 1800));
  const movesLeft = Math.max(18, 44 - ply / 2);
  const typical = Math.max(250, remainingMs / movesLeft + incrementMs * 0.75);
  const phase = ply < 16 ? 0.65 : ply < 60 ? 1.15 : 0.95;
  // Weak clock managers spend too much early and then rush; strong ones keep a steady pace.
  const early = ply < 40 ? 1 + (1 - profile.clockSkill) * 0.55 : 1;
  const pressure = timePressure(remainingMs, tc);
  const rush = 1 - pressure * (0.55 + profile.clockSkill * 0.3);
  const complexity = input.complexity ?? 1;
  const t =
    typical *
    phase *
    early *
    rush *
    profile.pace *
    complexity *
    rng.float(0.3, 1.8) *
    (fromBook ? 0.15 : 1);
  const cap = Math.max(14000, tc.base * 1000 * 0.05);
  // A move can take everything that is left only for a player who is already in serious time trouble.
  const ceiling =
    pressure > 0.6 && profile.clockSkill < 0.4
      ? remainingMs
      : remainingMs * 0.4;
  return Math.round(clamp(t, 120, Math.min(cap, Math.max(120, ceiling))));
}

/** Whether a computer opponent resigns. Only a clearly lost position late in the game, and not for stubborn players. */
export function wouldResign(
  profile: MoveProfile,
  rng: Rng,
  input: { evalCp: number; previousEvalCp: number | null; ply: number },
): boolean {
  if (profile.isPlayer || profile.stubborn) return false;
  if (input.ply < 30) return false;
  if (input.evalCp > -900 || (input.previousEvalCp ?? 0) > -700) return false;
  return rng.chance(0.4);
}

/** Moves of the profile's colour that the engine could pick, as UCI. */
export const uciOf = (m: Move): string => moveToUci(m);
