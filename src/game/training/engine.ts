import { awardAchievements } from "@/game/career/achievements";
import { advancePlanning } from "@/game/career/planning";
import { settleSponsors } from "@/game/career/business";
import { advanceYearReview, trackYearActivity } from "@/game/career/yearReview";
import { trainingCoachMultiplier } from "@/game/career/expansion";
import { GAME_CONFIG } from "@/data/config";
import { getSession } from "@/data/trainingSessions";
import { isAttribute, STAT_LABELS } from "@/data/stats";
import { createRng, mixSeed } from "@/game/rng";
import type {
  AttributeKey,
  GameSave,
  SessionGain,
  SessionRecord,
  SkillKey,
  StatKey,
  TrainingSessionDef,
  TrainingState,
} from "@/types";
import { hashString } from "@/utils/format";
import { ageOn } from "@/utils/dates";

const cfg = GAME_CONFIG.sessions;
const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));
const round1 = (v: number): number => Math.round(v * 10) / 10;

export const getStat = (save: GameSave, key: StatKey): number =>
  isAttribute(key) ? save.player.attributes[key] : save.player.skills[key];

export function withStat(
  save: GameSave,
  key: StatKey,
  value: number,
): GameSave {
  return isAttribute(key)
    ? {
        ...save,
        player: {
          ...save.player,
          attributes: {
            ...save.player.attributes,
            [key as AttributeKey]: value,
          },
        },
      }
    : {
        ...save,
        player: {
          ...save.player,
          skills: { ...save.player.skills, [key as SkillKey]: value },
        },
      };
}

/** Experience needed to gain the next point at a given level. */
export const xpNeeded = (value: number): number =>
  Math.round(cfg.xpBase + cfg.xpPerLevel * value);

/** Experience multiplier at a level: close to 1 for beginners, falling towards a floor for experts. */
export const diminishing = (value: number): number =>
  Math.max(
    cfg.minDiminishing,
    1 - (value / GAME_CONFIG.player.maxSkill) ** 1.6,
  );

/** Training effectiveness at a fatigue level. */
export const efficiencyAt = (fatigue: number): number =>
  1 - cfg.fatiguePenalty * (fatigue / cfg.maxFatigue);

export const hoursLeft = (t: TrainingState): number =>
  Math.max(0, cfg.hoursPerDay - t.hoursUsedToday);

/** Fatigue a session adds after stamina has been taken into account. Restful sessions are not scaled. */
export const fatigueGain = (
  def: TrainingSessionDef,
  stamina: number,
): number =>
  def.fatigue > 0 ? def.fatigue * (1 - stamina / 200) : def.fatigue;

export type BlockReason =
  | "exhausted"
  | "hours"
  | "ap"
  | "money"
  | "requirement"
  | "fullDay"
  | "dailyLimit"
  | "noGame";

export interface SessionPreview {
  blocks: Array<{ reason: BlockReason; text: string }>;
  efficiency: number;
  repeatFactor: number;
  fatigue: number;
  hoursLeft: number;
  effects: Array<{
    stat: StatKey;
    label: string;
    value: number;
    expectedXp: number;
    multiplier: number;
    needed: number;
    progress: number;
  }>;
  requirements: Array<{
    stat: StatKey;
    label: string;
    min: number;
    value: number;
    met: boolean;
  }>;
}

export function previewSession(
  save: GameSave,
  def: TrainingSessionDef,
): SessionPreview {
  const { player, training } = save;
  const efficiency = efficiencyAt(training.fatigue);
  const repeats = training.todayCounts[def.id] ?? 0;
  const repeatFactor = cfg.repeatFactor ** repeats;
  const requirements = def.requires.map((r) => ({
    stat: r.stat,
    label: STAT_LABELS[r.stat],
    min: r.min,
    value: getStat(save, r.stat),
    met: getStat(save, r.stat) >= r.min,
  }));
  const blocks: SessionPreview["blocks"] = [];
  if (training.fatigue >= cfg.exhaustedAt)
    blocks.push({
      reason: "exhausted",
      text: "Too exhausted to train. Rest first.",
    });
  if (def.needsFullDay && training.hoursUsedToday > 0)
    blocks.push({
      reason: "fullDay",
      text: "Needs a full day. Start it on a fresh day.",
    });
  else if (def.hours > hoursLeft(training))
    blocks.push({
      reason: "hours",
      text: `Needs ${def.hours} h, only ${hoursLeft(training)} h left today.`,
    });
  if (player.ap.current < def.ap)
    blocks.push({
      reason: "ap",
      text: `Needs ${def.ap} AP, you have ${player.ap.current}.`,
    });
  if (player.money < def.money)
    blocks.push({
      reason: "money",
      text: `Costs $${def.money}, you have $${player.money}.`,
    });
  for (const r of requirements)
    if (!r.met)
      blocks.push({
        reason: "requirement",
        text: `Needs ${r.label} ${r.min}+ (you have ${r.value}).`,
      });
  if (def.dailyLimit && repeats >= def.dailyLimit)
    blocks.push({
      reason: "dailyLimit",
      text: `Already done ${repeats} time${repeats === 1 ? "" : "s"} today (limit ${def.dailyLimit}).`,
    });
  if (def.needsGame && training.unanalyzedGames < 1)
    blocks.push({
      reason: "noGame",
      text: "No game to analyse. Play a rated or thematic game first.",
    });
  const effects = def.effects.map((e) => {
    const value = getStat(save, e.stat);
    const multiplier = diminishing(value);
    return {
      stat: e.stat,
      label: STAT_LABELS[e.stat],
      value,
      expectedXp: round1(
        e.xp *
          cfg.xpGain *
          trainingCoachMultiplier(save) *
          efficiency *
          repeatFactor *
          multiplier,
      ),
      multiplier,
      needed: xpNeeded(value),
      progress: training.xp[e.stat] ?? 0,
    };
  });
  return {
    blocks,
    efficiency,
    repeatFactor,
    fatigue: round1(fatigueGain(def, player.attributes.stamina)),
    hoursLeft: hoursLeft(training),
    effects,
    requirements,
  };
}

export interface SessionOptions {
  /** 0 to 1, from an interactive exercise such as thematic games */
  score?: number;
  openingId?: string;
  openingName?: string;
  color?: "white" | "black";
  opponent?: { id: string; name: string; elo: number };
  event?: { id: string; name: string };
  /** A master game to study and the stat their style trains */
  master?: { name: string; stat: StatKey };
}

export interface SessionOutcome {
  record: SessionRecord;
  levelUps: Array<{ stat: StatKey; label: string; from: number; to: number }>;
}

export type SessionResult =
  | { ok: true; save: GameSave; outcome: SessionOutcome }
  | { ok: false; error: string };

export const qualityLabel = (q: number): string =>
  q >= 1.25 ? "Excellent" : q >= 1.05 ? "Good" : q >= 0.85 ? "Solid" : "Poor";

const advanceStamp = (save: GameSave, weeks: number) => {
  const total = save.world.date.year * 52 + (save.world.date.week - 1) + weeks;
  return { year: Math.floor(total / 52), week: (total % 52) + 1 };
};

/** Runs one training session. Pure: returns a new save. Nothing is changed when the session is blocked. */
export function performSession(
  save: GameSave,
  sessionId: string,
  options: SessionOptions = {},
): SessionResult {
  const def = getSession(sessionId);
  if (!def) return { ok: false, error: "Unknown training session." };
  const preview = previewSession(save, def);
  if (preview.blocks.length)
    return { ok: false, error: preview.blocks[0].text };
  if (def.choice === "opening" && !options.openingId)
    return { ok: false, error: "Choose an opening first." };
  if (def.choice === "opponent" && !options.opponent)
    return { ok: false, error: "Choose an opponent first." };
  if (def.choice === "tournament" && !options.event)
    return { ok: false, error: "Choose a tournament first." };
  if (def.choice === "master" && !options.master)
    return { ok: false, error: "Choose a master first." };

  const { player, training, world } = save;
  const rng = createRng(
    mixSeed(
      world.seed ^ hashString(save.career.id),
      training.sessionCounter + 1,
    ),
  );
  let quality = clamp(
    rng.normal(1 + (player.attributes.concentration - 10) / 300, 0.18),
    0.55,
    1.5,
  );
  if (options.score !== undefined)
    quality = clamp(
      quality + (clamp(options.score, 0, 1) - 0.5) * 0.5,
      0.5,
      1.6,
    );

  const effects = def.effects.map((e) => ({ ...e }));
  if (options.master && !effects.some((e) => e.stat === options.master!.stat))
    effects.push({ stat: options.master.stat, xp: 14 });
  else if (options.master)
    effects.find((e) => e.stat === options.master!.stat)!.xp += 14;

  let next: GameSave = save;
  const xp = { ...training.xp };
  const gains: SessionGain[] = [];
  const levelUps: SessionOutcome["levelUps"] = [];
  for (const e of effects) {
    const start = getStat(next, e.stat);
    let value = start;
    const gained = round1(
      e.xp *
        cfg.xpGain *
        trainingCoachMultiplier(save) *
        quality *
        preview.efficiency *
        preview.repeatFactor *
        diminishing(start),
    );
    let pool = (xp[e.stat] ?? 0) + gained;
    while (value < GAME_CONFIG.player.maxSkill && pool >= xpNeeded(value)) {
      pool -= xpNeeded(value);
      value += 1;
    }
    xp[e.stat] = value >= GAME_CONFIG.player.maxSkill ? 0 : round1(pool);
    if (value !== start) {
      next = withStat(next, e.stat, value);
      levelUps.push({
        stat: e.stat,
        label: STAT_LABELS[e.stat],
        from: start,
        to: value,
      });
    }
    gains.push({ stat: e.stat, xp: gained, levels: value - start, value });
  }

  const fatigue = clamp(
    round1(training.fatigue + fatigueGain(def, player.attributes.stamina)),
    0,
    cfg.maxFatigue,
  );
  const moraleDelta = def.morale + (quality < 0.8 ? -1 : quality > 1.2 ? 1 : 0);
  const stamp = { ...world.date };
  const detail = options.openingName
    ? `${options.openingName} as ${options.color ?? "white"}${options.score !== undefined ? `, ${Math.round(options.score * 100)}% correct` : ""}`
    : options.opponent
      ? `Scouted ${options.opponent.name}`
      : options.event
        ? options.event.name
        : options.master
          ? `Studied ${options.master.name}`
          : undefined;
  const record: SessionRecord = {
    ...stamp,
    day: world.day,
    sessionId: def.id,
    name: def.name,
    quality: round1(quality * 100) / 100,
    qualityLabel: qualityLabel(quality),
    gains,
    fatigueAfter: fatigue,
    moraleDelta,
    detail,
  };

  const analysed = def.id === "analyze-game" ? 1 : 0;
  const played = def.id === "thematic-games" ? 1 : 0;
  const nextTraining: TrainingState = {
    ...training,
    xp,
    fatigue,
    hoursUsedToday: def.needsFullDay
      ? cfg.hoursPerDay
      : training.hoursUsedToday + def.hours,
    todayCounts: {
      ...training.todayCounts,
      [def.id]: (training.todayCounts[def.id] ?? 0) + 1,
    },
    sessionCounter: training.sessionCounter + 1,
    unanalyzedGames: training.unanalyzedGames - analysed + played,
    scouting: options.opponent
      ? {
          ...advanceStamp(save, 0),
          opponentId: options.opponent.id,
          opponentName: options.opponent.name,
          opponentElo: options.opponent.elo,
        }
      : training.scouting,
    tournamentPrep: options.event
      ? {
          ...advanceStamp(save, 0),
          eventId: options.event.id,
          name: options.event.name,
        }
      : training.tournamentPrep,
  };

  next = {
    ...next,
    player: {
      ...next.player,
      ap: { ...next.player.ap, current: player.ap.current - def.ap },
      money: player.money - def.money,
      morale: clamp(player.morale + moraleDelta, 0, 100),
    },
    training: nextTraining,
    history: {
      ...next.history,
      sessions: [...next.history.sessions, record].slice(-cfg.maxHistory),
    },
  };
  return {
    ok: true,
    save: trackYearActivity(save, next, "session"),
    outcome: { record, levelUps },
  };
}

export type RestKind = "break" | "nap";
const REST = {
  break: { hours: 1, recovery: 8, limit: 3, label: "Short break" },
  nap: { hours: 2, recovery: 18, limit: 1, label: "Power nap" },
} as const;

export const restInfo = (kind: RestKind) => REST[kind];

export function restBlock(save: GameSave, kind: RestKind): string | null {
  const r = REST[kind];
  if (save.training.fatigue <= 0) return "You are already fully rested.";
  if (r.hours > hoursLeft(save.training))
    return `Needs ${r.hours} h, only ${hoursLeft(save.training)} h left today.`;
  if ((save.training.todayCounts[`rest-${kind}`] ?? 0) >= r.limit)
    return `Limit reached today (${r.limit}).`;
  return null;
}

/** Uses training hours to recover some fatigue during the day. */
export function takeRest(
  save: GameSave,
  kind: RestKind,
):
  | { ok: true; save: GameSave; recovered: number }
  | { ok: false; error: string } {
  const block = restBlock(save, kind);
  if (block) return { ok: false, error: block };
  const r = REST[kind];
  const recovered = Math.min(
    save.training.fatigue,
    round1(r.recovery + save.player.attributes.physicalFitness / 20),
  );
  return {
    ok: true,
    recovered,
    save: {
      ...save,
      training: {
        ...save.training,
        fatigue: round1(save.training.fatigue - recovered),
        hoursUsedToday: save.training.hoursUsedToday + r.hours,
        todayCounts: {
          ...save.training.todayCounts,
          [`rest-${kind}`]:
            (save.training.todayCounts[`rest-${kind}`] ?? 0) + 1,
        },
      },
    },
  };
}

export interface NightReport {
  recovered: number;
  restDay: boolean;
  fatigueAfter: number;
  newDay: { year: number; week: number; day: number };
  newWeek: boolean;
  moraleDelta: number;
}

/** Sleep and move to the next day. Recovers fatigue, restores AP, advances the calendar. */
function endDayBase(save: GameSave): {
  save: GameSave;
  report: NightReport;
} {
  const { training, player, world } = save;
  const restDay = training.hoursUsedToday === 0;
  const recovered = Math.min(
    training.fatigue,
    round1(
      cfg.nightRecovery +
        player.attributes.physicalFitness / 10 +
        (restDay ? cfg.restDayBonus : 0),
    ),
  );
  const fatigue = round1(training.fatigue - recovered);
  const moraleDelta =
    (restDay ? 2 : 0) + (fatigue >= 70 ? -2 : fatigue <= 20 ? 1 : 0);

  let { year, week } = world.date;
  let day = world.day + 1;
  let newWeek = false;
  if (day > 7) {
    day = 1;
    newWeek = true;
    week += 1;
    if (week > 52) {
      week = 1;
      year += 1;
    }
  }

  const expired = (prep: { year: number; week: number } | null): boolean =>
    prep !== null &&
    (year - prep.year) * 52 + (week - prep.week) > cfg.prepWeeks;
  const next: GameSave = {
    ...save,
    world: { ...world, date: { year, week }, day },
    player: {
      ...player,
      ap: { ...player.ap, current: player.ap.max },
      morale: clamp(player.morale + moraleDelta, 0, 100),
      age: ageOn(player.dateOfBirth, year, week),
    },
    training: {
      ...training,
      fatigue,
      hoursUsedToday: 0,
      todayCounts: {},
      scouting: expired(training.scouting) ? null : training.scouting,
      tournamentPrep: expired(training.tournamentPrep)
        ? null
        : training.tournamentPrep,
    },
  };
  return {
    save: settleSponsors(advancePlanning(save, advanceYearReview(save, next))),
    report: {
      recovered,
      restDay,
      fatigueAfter: fatigue,
      newDay: { year, week, day },
      newWeek,
      moraleDelta,
    },
  };
}

export function endDay(save:GameSave) { const result=endDayBase(save);return {...result,save:awardAchievements(result.save)}; }
