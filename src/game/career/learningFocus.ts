import type { StatKey } from "@/types/training";

export const LEARNING_FOCUSES = [
  { id: "tactics", label: "Tactics", detail: "Combinations and pattern recognition", stats: ["tactics", "patternRecognition"] },
  { id: "calculation", label: "Calculation", detail: "Deeper lines and visualization", stats: ["calculation", "visualization"] },
  { id: "opening", label: "Openings", detail: "Repertoire and opening preparation", stats: ["opening", "openingPreparation"] },
  { id: "middlegame", label: "Middlegame & strategy", detail: "Plans, structures and positional play", stats: ["middlegame", "strategy", "positionalUnderstanding"] },
  { id: "endgame", label: "Endgames", detail: "Technique and converting advantages", stats: ["endgame"] },
  { id: "clock", label: "Time management", detail: "Faster decisions under pressure", stats: ["timeManagement", "pressure"] },
  { id: "mind", label: "Mental strength", detail: "Focus, confidence and resilience", stats: ["psychology", "concentration", "mentalStability", "resilience"] },
  { id: "fitness", label: "Fitness & stamina", detail: "Energy for long tournaments", stats: ["stamina", "physicalFitness"] },
] as const satisfies readonly { id: string; label: string; detail: string; stats: readonly StatKey[] }[];

export type LearningFocus = (typeof LEARNING_FOCUSES)[number]["id"];
export function normalizeLearningFocus(value: readonly string[] = []): LearningFocus[] {
  return LEARNING_FOCUSES.filter((f) => value.includes(f.id)).map((f) => f.id);
}
