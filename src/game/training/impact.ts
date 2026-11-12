import type { Player, StatKey } from "@/types";
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
/** Shared numerical effects for the player simulator and its training explanation. Display Elo is unchanged. */
export function trainingImpact(p: Player) {
  const s = p.skills,
    a = p.attributes;
  const technique =
    (s.tactics +
      s.calculation +
      s.strategy +
      s.middlegame +
      s.endgame +
      s.opening) /
    6;
  const skillBonus = Math.round(
    clamp(
      (technique - 10) * 1.6 +
        (a.patternRecognition +
          a.visualization +
          a.positionalUnderstanding -
          30) *
          0.3,
      -30,
      220,
    ),
  );
  return {
    skillBonus,
    phase: {
      opening: clamp(
        (s.opening - technique) * 1.1 + (a.openingPreparation - 10) * 0.35,
        -60,
        60,
      ),
      middlegame: clamp(
        (s.middlegame - technique) * 1.1 +
          (a.positionalUnderstanding - 10) * 0.35,
        -60,
        60,
      ),
      endgame: clamp(
        (s.endgame - technique) * 1.1 + (s.calculation - 10) * 0.25,
        -60,
        60,
      ),
    },
    extraBookPlies: Math.round(
      (s.opening - 10) / 10 + (a.openingPreparation - 10) / 12,
    ),
    clockSkill: clamp(
      0.35 + s.timeManagement / 160 + (a.concentration - 10) / 600,
      0.15,
      0.98,
    ),
    fatigueFactor: clamp(0.65 - (a.stamina - 10) / 500, 0.4, 0.75),
    moraleFactor: clamp(0.45 - (a.mentalStability - 10) / 400, 0.2, 0.5),
  };
}
export const STAT_EFFECTS: Record<StatKey, string> = {
  opening: "Improves opening strength and prepared book depth.",
  middlegame: "Improves middlegame strength and general technique.",
  endgame: "Improves endgame strength and general technique.",
  tactics: "Improves general technique and tactical move selection.",
  calculation: "Improves general technique, endgame strength and calculation.",
  strategy: "Improves general technique and positional move selection.",
  timeManagement: "Improves the simulator’s clock use and thinking pace.",
  psychology: "Supports mental resilience in match forecasts.",
  patternRecognition: "Improves the simulator’s general technique.",
  visualization: "Improves general technique and match forecasts.",
  concentration: "Improves clock use and match forecasts.",
  openingPreparation: "Adds opening strength and prepared book depth.",
  positionalUnderstanding: "Adds general technique and middlegame strength.",
  mentalStability: "Reduces the effect of low morale on simulated strength.",
  stamina: "Reduces training fatigue and its effect on simulated play.",
  physicalFitness: "Improves overnight fatigue recovery.",
  resilience: "Supports mental resilience in match forecasts.",
  pressure: "Supports performance under pressure in match forecasts.",
};
