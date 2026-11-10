import { TH_MESSAGES } from "./th";
import { getLanguage, type Language } from "./language";

export const normalizeMessage = (text: string): string =>
  text.replace(/\s+/g, " ").trim();
const exact = new Map(
  Object.entries(TH_MESSAGES)
    .filter(([key]) => !key.includes("{{"))
    .map(([key, value]) => [normalizeMessage(key), value]),
);
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Only these captures contain interface labels. Other captures may be player names,
// city names, openings, SAN or custom team names and must keep their original spelling.
const labelCaptures: Record<string, number[]> = {
  "{{0}} skill": [0],
  "{{0}}: progress to next level": [0],
  "{{0}} style": [0],
  "{{0}} style · Elo {{1}}": [0],
  "Elo {{0}} · {{1}} style": [1],
  "{{0}} · the opponent plays at human speed": [0],
  "Train: {{0}}": [0],
  "Promote to {{0}}": [0],
  "{{0}} clock": [0],
  "{{0}} probability": [0],
  "{{0}} draw multiplier": [0],
  "· Actual: {{0}}": [0],
  "Search cities in {{0}}": [0],
  "Needs {{0}} {{1}}+ (you have {{2}}).": [0],
  "Shared tactics; focus on {{0}}.": [0],
  "{{0}} XP in {{1}}. Your game result and rating are unchanged.": [1],
  "{{0}} is not available for {{1}} today. No AP or hours were spent.": [1],
  "{{0}} league": [0],
  "{{0}} nationality": [0],
  "{{0}} now represents {{1}}": [1],
  "{{0}} {{1}} hair": [0, 1],
  "{{0}} eyes": [0],
  "{{0}} face, {{1}} skin": [0, 1],
  "{{0}} glasses": [0],
  "{{0}} · Week {{1}}, day {{2}}": [0],
  "{{0}}. {{1}} to move. White: {{2}}. Black: {{3}}.": [0, 1],
  "{{0}} after {{1}} half-moves": [0],
  "Step {{0}} of {{1}}: {{2}}": [2],
  "{{0}} retained training sessions in the last 8 weeks{{1}}.": [1],
  "Region: {{0}}": [0],
  "{{0}} (automatic)": [0],
  "Not eligible as a player: {{0}}.": [0],
  "{{0}} teams, {{1}} board games. Your country finished #{{2}}. {{3}}": [3],
};
const templates = Object.entries(TH_MESSAGES)
  .filter(([key]) => key.includes("{{"))
  .map(([key, value]) => {
    const groups: number[] = [];
    const source = normalizeMessage(key)
      .split(/(\{\{\d+\}\})/g)
      .map((piece) => {
        const match = piece.match(/^\{\{(\d+)\}\}$/);
        if (match) {
          groups.push(Number(match[1]));
          return "([\\s\\S]+?)";
        }
        return escape(piece);
      })
      .join("");
    return {
      pattern: new RegExp(`^${source}$`),
      groups,
      value,
      labels: labelCaptures[key] ?? [],
      specificity: normalizeMessage(key).replace(/\{\{\d+\}\}/g, "").length,
    };
  })
  .sort((a, b) => b.specificity - a.specificity);
const cache = new Map<string, string>();

function thaiMessage(key: string, depth = 0): string {
  const literal = exact.get(key);
  if (literal !== undefined) return literal;
  for (const t of templates) {
    const match = key.match(t.pattern);
    if (!match) continue;
    const values = new Map(
      t.groups.map((group, i) => [
        group,
        depth < 3 && t.labels.includes(group)
          ? thaiMessage(match[i + 1], depth + 1)
          : match[i + 1],
      ]),
    );
    return t.value.replace(
      /\{\{(\d+)\}\}/g,
      (_, index) => values.get(Number(index)) ?? "",
    );
  }
  if (depth < 3) {
    if (key.includes(" · "))
      return key
        .split(" · ")
        .map((part) => thaiMessage(part, depth + 1))
        .join(" · ");
    if (key.includes("; "))
      return key
        .split("; ")
        .map((part) => thaiMessage(part, depth + 1))
        .join("; ");
    // Saved profile skill summaries contain canonical English labels and numeric levels.
    const skill = key.match(/^([A-Za-z][A-Za-z ]*) (\d+(?:\.\d+)?)$/);
    if (skill && exact.has(skill[1]))
      return `${exact.get(skill[1])} ${skill[2]}`;
    if (
      key.includes(", ") &&
      key
        .split(", ")
        .every((part) => exact.has(part) || /^[A-Za-z ]+ \d+$/.test(part))
    )
      return key
        .split(", ")
        .map((part) => thaiMessage(part, depth + 1))
        .join(", ");
  }
  return key;
}

/** Presentation only: never rewrite identifiers, input values, SAN, URLs or stored names. */
export function translateUI(
  text: string,
  language: Language = getLanguage(),
): string {
  if (language === "en" || !/[A-Za-z]/.test(text)) return text;
  const key = normalizeMessage(text);
  let translated = cache.get(key);
  if (translated === undefined) {
    translated = thaiMessage(key);
    if (cache.size >= 2000) cache.clear();
    cache.set(key, translated);
  }
  if (translated === key) return text;
  return `${text.match(/^\s*/)?.[0] ?? ""}${translated}${text.match(/\s*$/)?.[0] ?? ""}`;
}
export const confirmUI = (text: string): boolean =>
  window.confirm(translateUI(text));
