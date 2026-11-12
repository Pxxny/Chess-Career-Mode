import type { CareerRecord } from "@/types";
export const PLAYER_DATABASES = [
  {
    id: "small",
    label: "Small",
    range: "500–1,000",
    fictionalCount: 750,
    estimate: [1, 8],
  },
  {
    id: "medium",
    label: "Medium",
    range: "1,500–2,900",
    fictionalCount: 2000,
    estimate: [2, 15],
  },
  {
    id: "large",
    label: "Large",
    range: "4,000–6,000",
    fictionalCount: 4000,
    estimate: [4, 30],
  },
  {
    id: "extra-large",
    label: "Extra Large",
    range: "10,000–20,000",
    fictionalCount: 15000,
    estimate: [15, 90],
  },
  {
    id: "real",
    label: "Real Player",
    range: "",
    fictionalCount: 0,
    estimate: [1, 8],
  },
] as const;
export type PlayerDatabaseSize = (typeof PLAYER_DATABASES)[number]["id"];
export const DEFAULT_PLAYER_DATABASE: PlayerDatabaseSize = "large";
export const validDatabaseSize = (
  value: unknown,
): value is PlayerDatabaseSize => PLAYER_DATABASES.some((o) => o.id === value);
export const databaseChoice = (size?: PlayerDatabaseSize) =>
  PLAYER_DATABASES.find((o) => o.id === size) ?? PLAYER_DATABASES[2];
export const fictionalCountFor = (
  career: Pick<CareerRecord, "playerDatabase">,
) => databaseChoice(career.playerDatabase).fictionalCount;
export const realOnly = (career: Pick<CareerRecord, "playerDatabase">) =>
  career.playerDatabase === "real";
export interface CreationProgress {
  phase: "building" | "saving";
  done: number;
  total: number;
}
