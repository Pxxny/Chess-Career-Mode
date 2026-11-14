// Builds the per-country city files used by the city selector.
// Source: the `all-the-cities` package (GeoNames, population >= 1000).
// Output: public/data/cities/<ISO2>.json as [[name, population], ...], largest first.
// Runs after `npm install`; skips when already built. Use `npm run build:data` to force.
import { createRequire } from "node:module";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const OUT = new URL("../public/data/cities/", import.meta.url);
const INDEX = new URL("index.json", OUT);
const SEEDS = new URL("../src/data/world/expandedCities.json", import.meta.url);
const VERSION = 3;
const VENUES = new URL("../public/data/venue-cities.json", import.meta.url);

const { readFileSync } = await import("node:fs");
if (
  existsSync(INDEX) &&
  existsSync(SEEDS) && existsSync(VENUES) &&
  JSON.parse(readFileSync(INDEX, "utf8")).version === VERSION &&
  !process.argv.includes("--force")
) {
  console.log(
    "[world-data] city files already built (use `npm run build:data` to rebuild).",
  );
  process.exit(0);
}

let cities;
try {
  const require = createRequire(import.meta.url);
  const mod = require("all-the-cities");
  cities = Array.isArray(mod) ? mod : mod.default;
} catch {
  try {
    const mod = await import("all-the-cities");
    cities = mod.default ?? mod;
  } catch {
    console.warn(
      "[world-data] `all-the-cities` is not installed; the city selector will use curated cities and custom entries.",
    );
    process.exit(0);
  }
}

const byCountry = new Map();
for (const city of cities) {
  if (!city.country || !city.name) continue;
  if (!byCountry.has(city.country)) byCountry.set(city.country, []);
  byCountry.get(city.country).push(city);
  if (city.country === "GB") {
    const code = { ENG: "GB-ENG", SCT: "GB-SCO", WLS: "GB-WLS" }[
      city.adminCode
    ];
    if (code) {
      if (!byCountry.has(code)) byCountry.set(code, []);
      byCountry.get(code).push(city);
    }
  }
}

mkdirSync(OUT, { recursive: true });
const counts = {};
const seedPools = {};
const venueCities = {};
for (const [code, list] of byCountry) {
  list.sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
  const seen = new Set();
  const rows = [];
  for (const c of list) {
    const key = c.name.toLowerCase();
    if (seen.has(key)) continue; // same-named towns keep only the largest
    seen.add(key);
    rows.push([c.name, c.population ?? 0]);
  }
  venueCities[code] = [...new Map(list.filter(c => Array.isArray(c.loc?.coordinates) && c.loc.coordinates.length === 2).slice().reverse().map(c => [c.name.toLowerCase(),c])).values()].sort((a,b) => (b.population??0)-(a.population??0)).slice(0,150).map(c => [c.name, c.population ?? 0, ...c.loc.coordinates.map(n => Math.round(n*10000)/10000)]);
  counts[code] = rows.length;
  // Keep a small bundled pool for NPC hometowns and for offline selectors.
  // Existing curated names are preserved; getSeedCities adds 50 new distinct entries.
  seedPools[code] = rows.slice(0, 70).map(([name]) => name);
  writeFileSync(new URL(`${code}.json`, OUT), JSON.stringify(rows));
}
writeFileSync(SEEDS, JSON.stringify(seedPools));
writeFileSync(VENUES, JSON.stringify(venueCities));
writeFileSync(
  INDEX,
  JSON.stringify({
    version: VERSION,
    source: "all-the-cities (GeoNames, populated places >= 1000)",
    countries: counts,
  }),
);
console.log(
  `[world-data] wrote ${Object.keys(counts).length} country city files.`,
);
