import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import {
  getMajorCities,
  searchCities,
  hasExactCity,
} from "../src/game/world/citySearch.ts";
import { normalizeText } from "../src/utils/text.ts";
import type { City } from "../src/types/index.ts";

const index = JSON.parse(
  readFileSync(
    new URL("../public/data/cities/index.json", import.meta.url),
    "utf8",
  ),
);
let total = 0;
const timings: Record<string, number> = {};
for (const [code, count] of Object.entries(index.countries)) {
  const cities: City[] = JSON.parse(
    readFileSync(
      new URL(`../public/data/cities/${code}.json`, import.meta.url),
      "utf8",
    ),
  ).map(([name, population]: [string, number]) => ({ name, population }));
  assert.equal(cities.length, count);
  const started = performance.now();
  const all = getMajorCities(cities);
  assert.equal(
    all.length,
    cities.length,
    `${code}: every city reachable without a search`,
  );
  assert.deepEqual(
    new Set(all.map((c) => c.name)),
    new Set(cities.map((c) => c.name)),
  );
  const query = "a";
  const matches = searchCities(cities, query);
  assert.deepEqual(
    new Set(matches.map((c) => c.name)),
    new Set(
      cities
        .filter((c) => normalizeText(c.name).includes(query))
        .map((c) => c.name),
    ),
    `${code}: all matching rows beyond previous caps`,
  );
  const tail = cities.at(-1);
  if (tail) {
    assert(searchCities(cities, tail.name).some((c) => c.name === tail.name));
    assert(hasExactCity(cities, tail.name));
  }
  timings[code] = Number((performance.now() - started).toFixed(2));
  total += cities.length;
}
const ru: City[] = JSON.parse(
  readFileSync(
    new URL("../public/data/cities/RU.json", import.meta.url),
    "utf8",
  ),
).map(([name, population]: [string, number]) => ({ name, population }));
assert.equal(getMajorCities(ru).length, 4301);
assert(searchCities(ru, "a").length > 500);
assert.equal(
  getMajorCities(ru, 62).length,
  62,
  "explicit limits remain compatible for other callers",
);
assert.equal(searchCities(ru, "a", 90).length, 90);
assert.equal(
  searchCities([{ name: "Zürich", population: 1 }], " ZURICH ").length,
  1,
);
const original = JSON.stringify(ru);
getMajorCities(ru);
searchCities(ru, "k");
assert.equal(JSON.stringify(ru), original, "no mutation of city data");
console.log(
  `PASS all ${Object.keys(index.countries).length} country/federation files: ${total} rows remain available; unlimited default list/search, prefix/contains matches, exact last cities, accents and original input retained.`,
);
console.log(
  `PASS Russia: 4,301 cities; ${searchCities(ru, "a").length} matches for "a", beyond former caps. Node logic check times (not browser/network): RU ${timings.RU} ms, US ${timings.US} ms.`,
);
