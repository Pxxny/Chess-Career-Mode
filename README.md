# Chess Career Mode

Stage 1: foundation (shell, navigation, state, UI kit). Stage 2: world database. Stage 3: character creation.

## Run
```
npm install      # also builds the city files (postinstall)
npm run dev
npm run test:world   # Node 22+: checks the NPC database (count, determinism, tiers, legends)
```

## World database
- **Countries** – `src/data/world/countries.ts` reads the maintained `world-countries` dataset (ISO 3166-1 plus territories): name, nationality (demonym), code, flag emoji, continent. England, Scotland and Wales are added as FIDE home-nation federations. Flag emoji do not render on Windows desktop browsers; the country name always appears beside them.
- **Federations** – FIDE code (ISO alpha-3 with FIDE's known exceptions) plus a name. Names are generated as "<Country> Chess Federation" except for a handful of well-known ones.
- **Cities** – `scripts/build-world-data.mjs` converts the `all-the-cities` (GeoNames, population >= 1000) package into one file per country in `public/data/cities/`. The selector loads the file for the chosen country, shows the largest cities first, searches the rest, and accepts custom entries. Same-named towns in a country are collapsed to the largest. If the files are missing it falls back to curated major cities + capital, still with custom entry. Rebuild with `npm run build:data`.
- **NPCs** – `src/game/npc/`. 1,200 fictional players (deterministic from `GAME_CONFIG.world.seed`, ID `npc-0001`...) plus 23 historical legends. Fixed tier quotas guarantee beginners through legendary players. Each NPC is generated from its own seeded RNG, so IDs and attributes are stable.
- **Persistence** – the NPC database lives in its own IndexedDB store, written once and loaded on later launches. It is rebuilt only if the seed, schema version or count in `GAME_CONFIG` changes, or when a new career starts. Changed NPCs are written back individually (`store/npcRepository.ts`).
- **Legends** – `src/data/chess/legends.ts`. They only hold a ranking in the years they were active (Elo interpolated from `ratings`). Alternate history mode (character creation or Profile) places every legend in their prime. Pre-1970 Elo values are retrospective estimates and dates are best-effort; edit the file to adjust.

## Structure
- `src/types` – interfaces (Player, Npc, Country, City, World, GameSave...)
- `src/data` – config and static data (`world/`, `chess/`)
- `src/game` – pure logic, no React (NPC generation, world state, rankings, city search)
- `src/store` – Zustand stores (save in `gameStore`, NPC world in `npcStore`) and the IndexedDB repository
- `src/features` – creation, profile, world (directory, profile modal, city service)
- `src/components`, `src/pages`, `src/hooks`, `src/utils`

## Character creation (stage 3)
- **Wizard** – `src/features/creation/`: identity, archetype, look, start year, confirm. Steps validate before advancing, earlier steps can be revisited, and changing nationality clears the city.
- **Archetypes** – `src/data/archetypes.ts`. Each adds a net +16 starting skill points (checked by `npm run test:world`), sets tendencies (aggression, complexity, risk, resilience, adaptability) and a training-speed affinity. No skill is ever locked.
- **Appearance** – `src/data/appearance.ts` holds every option; `src/game/appearance/portraitSvg.ts` draws the portrait as SVG from those tables (pure function, unknown values are replaced, so injecting the SVG is safe). `npm run` the script `scripts/render-portraits.ts` to preview samples. The appearance is saved on the player and shown in the top bar and Profile.
- **Start year** – 1950 to 2026 (`GAME_CONFIG.startYear`). The NPC world is built for that year: legends are filtered and aged by `resolveLegend` (Kasparov and Karpov in 1985, a 14-year-old Carlsen in 2005), fictional players get era-appropriate Elo ceilings, tier mixes, federation strength and real tournament names (`data/chess/historicalEvents.ts`). Alternate history puts every legend in their prime.
- **Permanent link** – `GameSave.career` (`CareerRecord`) stores the career id, start year, country, city and `databaseKey`. The NPC database in IndexedDB is stamped with that key and rebuilt only if it does not match. No action changes country, city or start year.
- **Starting values** – all in `GAME_CONFIG.player` (Elo 1000, 0 rated games, money, AP, morale, skills, age). The league is derived from the starting Elo.
- Existing saves from earlier stages are discarded on upgrade (save version 3) and the player creates a new career.
