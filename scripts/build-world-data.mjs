// Builds the per-country city files used by the city selector.
// Source: the `all-the-cities` package (GeoNames, population >= 1000).
// Output: public/data/cities/<ISO2>.json as [[name, population], ...], largest first.
// Runs after `npm install`; skips when already built. Use `npm run build:data` to force.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const OUT = new URL('../public/data/cities/', import.meta.url);
const INDEX = new URL('index.json', OUT);

if (existsSync(INDEX) && !process.argv.includes('--force')) {
  console.log('[world-data] city files already built (use `npm run build:data` to rebuild).');
  process.exit(0);
}

let cities;
try {
  const require = createRequire(import.meta.url);
  const mod = require('all-the-cities');
  cities = Array.isArray(mod) ? mod : mod.default;
} catch {
  try {
    const mod = await import('all-the-cities');
    cities = mod.default ?? mod;
  } catch {
    console.warn('[world-data] `all-the-cities` is not installed; the city selector will use curated cities and custom entries.');
    process.exit(0);
  }
}

const byCountry = new Map();
for (const city of cities) {
  if (!city.country || !city.name) continue;
  if (!byCountry.has(city.country)) byCountry.set(city.country, []);
  byCountry.get(city.country).push(city);
}

mkdirSync(OUT, { recursive: true });
const counts = {};
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
  counts[code] = rows.length;
  writeFileSync(new URL(`${code}.json`, OUT), JSON.stringify(rows));
}
writeFileSync(INDEX, JSON.stringify({ source: 'all-the-cities (GeoNames)', countries: counts }));
console.log(`[world-data] wrote ${Object.keys(counts).length} country city files.`);
