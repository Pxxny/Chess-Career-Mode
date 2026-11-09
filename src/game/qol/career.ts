import { getLanguage } from "@/i18n/language";
import type { GameSave } from "@/types";
import { getCountry } from "@/data/world/countries";
import { performSession } from "@/game/training/engine";
import { TRAINING_SESSIONS } from "@/data/trainingSessions";
export const careerDay = (save: GameSave): number =>
  (save.world.date.year * 52 + save.world.date.week - 1) * 7 +
  save.world.day -
  1;
export function calendarDate(save: GameSave): Date {
  return new Date(
    Date.UTC(
      save.world.date.year,
      0,
      1 + (save.world.date.week - 1) * 7 + save.world.day - 1,
    ),
  );
}
export const calendarLabel = (save: GameSave): string =>
  calendarDate(save).toLocaleDateString(
    getLanguage() === "th" ? "th-TH" : "en-GB",
    {
      calendar: "gregory",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    },
  );
export interface FederationMove {
  from: string;
  to: string;
  day: number;
}
export interface TransferRequest {
  country: string;
  requested: number;
  ready: number;
  fee: number;
}
export interface QolState {
  birthCountry: string;
  jobDay: number;
  jobs: string[];
  transfer: TransferRequest | null;
  moves: FederationMove[];
}
export const emptyQol = (country: string): QolState => ({
  birthCountry: country,
  jobDay: -1,
  jobs: [],
  transfer: null,
  moves: [],
});
export const qolOf = (save: GameSave): QolState => ({
  ...emptyQol(save.career.countryCode),
  ...save.qol,
});
type Result = { ok: true; save: GameSave } | { ok: false; error: string };
export interface CareerJob {
  id: string;
  name: string;
  description: string;
  hours: number;
  ap: number;
  pay: number;
  elo: number;
  reputation: number;
  fatigue: number;
}
export const CAREER_JOBS: CareerJob[] = [
  {
    id: "club-assistant",
    name: "Club assistant",
    description: "Set up boards, welcome members and help run a club evening.",
    hours: 2,
    ap: 1,
    pay: 30,
    elo: 0,
    reputation: 0,
    fatigue: 8,
  },
  {
    id: "chess-writer",
    name: "Chess columnist",
    description: "Write an annotated chess article for a local publication.",
    hours: 2,
    ap: 1,
    pay: 55,
    elo: 1400,
    reputation: 0,
    fatigue: 6,
  },
  {
    id: "private-lesson",
    name: "Private chess lesson",
    description: "Teach an improving player in a scheduled lesson.",
    hours: 3,
    ap: 2,
    pay: 100,
    elo: 1800,
    reputation: 5,
    fatigue: 10,
  },
  {
    id: "simul-host",
    name: "Simultaneous exhibition",
    description: "Host a public exhibition for a community chess club.",
    hours: 4,
    ap: 3,
    pay: 180,
    elo: 2200,
    reputation: 20,
    fatigue: 18,
  },
];
export function jobIssue(save: GameSave, job: CareerJob): string | null {
  const state = qolOf(save),
    today = state.jobDay === careerDay(save) ? state.jobs : [];
  if (save.pendingMatch) return "Finish the running game first.";
  if (today.length >= 2) return "Two paid jobs per day. Come back tomorrow.";
  if (today.includes(job.id)) return "This job is already completed today.";
  if (save.player.rating < job.elo || save.player.reputation < job.reputation)
    return `Requires ${job.elo}+ Elo and reputation ${job.reputation}+.`;
  if (save.player.ap.current < job.ap) return `Requires ${job.ap} AP.`;
  if (save.training.hoursUsedToday + job.hours > 8)
    return "Not enough hours left today.";
  if (save.training.fatigue >= 90) return "Rest before taking another job.";
  return null;
}
export function workJob(save: GameSave, id: string): Result {
  const job = CAREER_JOBS.find((j) => j.id === id);
  if (!job) return { ok: false, error: "Unknown job." };
  const error = jobIssue(save, job);
  if (error) return { ok: false, error };
  const day = careerDay(save),
    state = qolOf(save),
    jobs = state.jobDay === day ? state.jobs : [];
  return {
    ok: true,
    save: {
      ...save,
      qol: { ...state, jobDay: day, jobs: [...jobs, id] },
      player: {
        ...save.player,
        money: save.player.money + job.pay,
        ap: { ...save.player.ap, current: save.player.ap.current - job.ap },
      },
      training: {
        ...save.training,
        hoursUsedToday: save.training.hoursUsedToday + job.hours,
        fatigue: Math.min(100, save.training.fatigue + job.fatigue),
      },
      history: {
        ...save.history,
        ledger: [
          ...save.history.ledger,
          {
            id: `work-${day}-${id}`,
            kind: "other" as const,
            label: job.name,
            amount: job.pay,
            ...save.world.date,
          },
        ].slice(-200),
      },
    },
  };
}
export function transferIssue(save: GameSave): string | null {
  const state = qolOf(save),
    last = state.moves.at(-1);
  if (state.transfer)
    return "A federation transfer is already being processed.";
  if (save.player.rating < 1800 || save.player.ratedGames < 25)
    return "Unlocks at 1800 Elo and 25 rated career games.";
  if (last && careerDay(save) - last.day < 364)
    return "Wait one game year between federation transfers.";
  if (save.player.money < 250) return "The processing fee is $250.";
  if (save.pendingMatch || save.tournament?.status === "playing")
    return "Finish the current game and tournament first.";
  return null;
}
export function requestTransfer(save: GameSave, country: string): Result {
  if (!getCountry(country) || country === save.player.country)
    return { ok: false, error: "Choose a different federation." };
  const error = transferIssue(save);
  if (error) return { ok: false, error };
  const state = qolOf(save),
    day = careerDay(save);
  return {
    ok: true,
    save: {
      ...save,
      qol: {
        ...state,
        transfer: { country, requested: day, ready: day + 30, fee: 250 },
      },
      player: { ...save.player, money: save.player.money - 250 },
      history: {
        ...save.history,
        ledger: [
          ...save.history.ledger,
          {
            id: `transfer-${day}`,
            kind: "expense" as const,
            label: `Federation transfer application: ${country}`,
            amount: -250,
            ...save.world.date,
          },
        ].slice(-200),
      },
    },
  };
}
/** Completes after 30 game days, outside a running tournament; old national entries are refunded atomically. */
export function settleTransfer(save: GameSave): GameSave {
  const state = qolOf(save),
    request = state.transfer;
  if (
    !request ||
    careerDay(save) < request.ready ||
    save.pendingMatch ||
    save.tournament?.status === "playing"
  )
    return save;
  const country = getCountry(request.country);
  if (!country) return save;
  const invalid = save.registrations.filter(
    (r) =>
      (r.details?.nationality && r.details.nationality !== request.country) ||
      (r.details?.federation && r.details.country !== request.country),
  );
  const refund = invalid.reduce(
      (s, r) => s + r.entryFee + (r.travelCost ?? 0),
      0,
    ),
    old = save.player.country;
  return {
    ...save,
    player: {
      ...save.player,
      country: country.code,
      city: { name: country.capital ?? country.name, custom: false },
      money: save.player.money + refund,
    },
    qol: {
      ...state,
      transfer: null,
      moves: [
        ...state.moves,
        { from: old, to: country.code, day: careerDay(save) },
      ],
    },
    expansion: save.expansion
      ? { ...save.expansion, membershipYear: null }
      : save.expansion,
    registrations: save.registrations.filter((r) => !invalid.includes(r)),
    history: {
      ...save.history,
      ledger: [
        ...save.history.ledger,
        ...(refund
          ? [
              {
                id: `transfer-refund-${careerDay(save)}`,
                kind: "other" as const,
                label: "Refund: former federation entries",
                amount: refund,
                ...save.world.date,
              },
            ]
          : []),
      ].slice(-200),
      news: [
        ...save.history.news,
        {
          id: `federation-move-${careerDay(save)}`,
          kind: "milestone" as const,
          headline: `${save.player.name} now represents ${country.name}`,
          detail: `Transfer from ${getCountry(old)?.name ?? old}. Former national entries refunded: $${refund}.`,
          ...save.world.date,
        },
      ].slice(-80),
    },
  };
}
export const AUTO_TRAINING = TRAINING_SESSIONS.filter((d) => !d.choice);
export interface TrainingDay {
  save: GameSave;
  completed: string[];
  skipped: { name: string; reason: string }[];
}
export function plannedTrainingDay(
  save: GameSave,
  ids: readonly string[],
): TrainingDay {
  let next = save;
  const completed: string[] = [],
    skipped: TrainingDay["skipped"] = [];
  for (const id of [...new Set(ids)]) {
    const def = AUTO_TRAINING.find((d) => d.id === id);
    if (!def) {
      skipped.push({
        name: id,
        reason: "Needs manual setup or is not available for auto-training.",
      });
      continue;
    }
    const result = performSession(next, id);
    if (result.ok) {
      next = result.save;
      completed.push(def.name);
    } else skipped.push({ name: def.name, reason: result.error });
  }
  return { save: next, completed, skipped };
}
export interface CalendarAdvanceReport {
  days: number;
  trained: number;
  skipped: number;
  stoppedFor: string;
  cancelled: boolean;
  notes: string[];
}
