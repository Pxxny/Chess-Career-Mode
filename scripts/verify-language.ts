import assert from "node:assert/strict";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  getLanguage,
  normalizeLanguage,
  receiveLanguagePreference,
  setLanguage,
  subscribeLanguage,
} from "../src/i18n/language.ts";
import { translateUI } from "../src/i18n/translate.ts";
import { TH_MESSAGES } from "../src/i18n/th.ts";
import { COUNTRIES } from "../src/data/world/countries.ts";
import { APPEARANCE_OPTIONS } from "../src/data/appearance.ts";
import { SKILL_DEFINITIONS } from "../src/data/skills.ts";
import { STAT_LABELS } from "../src/data/stats.ts";
import { TIERS } from "../src/data/chess/tiers.ts";

assert.equal(DEFAULT_LANGUAGE, "en");
assert.equal(getLanguage(), "en"); // Also works without a DOM or browser storage.
for (const invalid of [null, undefined, "", "TH", "fr", {}, true])
  assert.equal(normalizeLanguage(invalid), "en");
assert.equal(normalizeLanguage("th"), "th");
assert.equal(translateUI("  Full name  ", "en"), "  Full name  ");
assert.equal(translateUI("  Full name  ", "th"), "  ชื่อและนามสกุล  ");
assert.equal(translateUI("Create career", "th"), "เริ่มอาชีพ");
assert.equal(translateUI("Welcome, Train", "th"), "ยินดีต้อนรับ Train");
assert.equal(translateUI("Open profile for Home", "th"), "เปิดโปรไฟล์ของ Home");
assert.equal(
  translateUI("You talked with Train.", "th"),
  "คุณพูดคุยกับ Train แล้ว",
);
assert.equal(translateUI("Familiarity 42/100", "th"), "ความคุ้นเคย 42/100");
assert.equal(translateUI("Closeness 7/100", "th"), "ความสนิท 7/100");
assert.equal(translateUI("Thailand", "th"), "ไทย");
assert.equal(translateUI("Swiss", "th"), "สวิส");
assert.equal(translateUI("Switzerland", "th"), "สวิตเซอร์แลนด์");
assert.equal(translateUI("Thai · Asia", "th"), "ไทย · เอเชีย");
assert.equal(translateUI("Train: Calculation", "th"), "ฝึก: การคำนวณ");
assert.equal(
  translateUI("Calculation 12, Endgame 10", "th"),
  "การคำนวณ 12, ช่วงท้ายเกม 10",
);
for (const original of [
  "Magnus Carlsen",
  "Bangkok",
  "1. e4 e5 2. Nf3 Nc6",
  "Ruy Lopez",
  "save-slot-1",
  "2700",
  "วันพุธ",
  "https://example.test/complete",
]) {
  assert.equal(translateUI(original, "th"), original);
  assert.equal(translateUI(original, "en"), original);
}
for (const [source, translated] of Object.entries(TH_MESSAGES)) {
  const slots = (text: string) =>
    [...new Set(text.match(/\{\{\d+\}\}/g) ?? [])].sort();
  // English plural suffix captures may be omitted; Thai must never introduce new captures.
  for (const slot of slots(translated))
    assert.ok(
      slots(source).includes(slot),
      `Unexpected placeholder ${slot}: ${source}`,
    );
  assert.ok(translated.trim(), `Empty translation: ${source}`);
}
for (const country of COUNTRIES)
  assert.notEqual(
    translateUI(country.name, "th"),
    country.name,
    `Country translation: ${country.code}`,
  );
for (const field of Object.values(APPEARANCE_OPTIONS))
  for (const option of field)
    assert.notEqual(
      translateUI(option.label, "th"),
      option.label,
      `Appearance label: ${option.label}`,
    );
for (const skill of SKILL_DEFINITIONS)
  assert.notEqual(translateUI(skill.label, "th"), skill.label);
for (const label of [
  ...Object.values(STAT_LABELS),
  ...TIERS.map((t) => t.label),
])
  assert.notEqual(translateUI(label, "th"), label, `Profile label: ${label}`);
assert.equal(translateUI("Calculation, Strategy", "th"), "การคำนวณ, กลยุทธ์");
let changes = 0;
const unsubscribe = subscribeLanguage(() => changes++);
setLanguage("th");
assert.equal(getLanguage(), "th");
assert.equal(translateUI("Home"), "หน้าหลัก");
setLanguage("th");
assert.equal(changes, 1);
receiveLanguagePreference("fr");
assert.equal(getLanguage(), "en");
unsubscribe();
setLanguage("th");
assert.equal(changes, 2);
setLanguage("en");
assert.equal(LANGUAGE_STORAGE_KEY, "chess-career-mode-language");
console.log(
  `Language checks passed: English defaults, Thai messages (${Object.keys(TH_MESSAGES).length}), named captures, canonical text, countries, appearance, skills and preference subscriptions.`,
);
