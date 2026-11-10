import assert from "node:assert/strict";
import { npcAppearance } from "../src/game/appearance/npcAppearance.ts";
import { APPEARANCE_OPTIONS } from "../src/data/appearance.ts";
import { buildWorldNpcs } from "../src/game/npc/buildWorldNpcs.ts";
import { renderPortraitSvg } from "../src/game/appearance/portraitSvg.ts";
import { LEGENDS } from "../src/data/chess/legends.ts";
import { LEGEND_APPEARANCES } from "../src/data/chess/legendAppearances.ts";
import { randomAppearance } from "../src/data/appearance.ts";
import { createRng } from "../src/game/rng.ts";
import { hashString } from "../src/utils/format.ts";

const npcs = buildWorldNpcs(2026);
const before = JSON.stringify(npcs);
assert.deepEqual(
  Object.keys(LEGEND_APPEARANCES).sort(),
  LEGENDS.map((p) => `legend-${p.slug}`).sort(),
  "Every real player has a curated likeness",
);
const identities = new Set<string>();
for (const npc of npcs) {
  const appearance = npcAppearance(npc);
  if (npc.kind === "legend") {
    assert.equal(appearance.accessory, "none");
    assert.notEqual(appearance.glasses, "sunglasses");
    assert.deepEqual(appearance, LEGEND_APPEARANCES[npc.id]);
  } else {
    assert.deepEqual(
      appearance,
      randomAppearance(
        createRng(hashString(`npc-portrait-v1:${npc.id}`)).next,
        npc.gender,
      ),
      "Fictional NPC faces stay exactly as before",
    );
  }
  for (const field of Object.keys(appearance) as (keyof typeof appearance)[])
    assert.ok(
      APPEARANCE_OPTIONS[field].some(
        (option) => option.id === appearance[field],
      ),
    );
  assert.deepEqual(
    npcAppearance({
      ...npc,
      currentElo: npc.currentElo + 30,
      age: npc.age + 1,
      name: "Renamed",
      nationality: "TH",
    }),
    appearance,
  );
  assert.deepEqual(npcAppearance(JSON.parse(JSON.stringify(npc))), appearance);
  if (npc.gender === "female") assert.equal(appearance.facialHair, "none");
  identities.add(JSON.stringify(appearance));
}
assert.ok(
  identities.size > npcs.length * 0.95,
  "NPCs should have varied faces",
);
assert.equal(
  JSON.stringify(npcs),
  before,
  "Deriving a portrait must not modify old saves or NPC data",
);
const legend = npcs.find((npc) => npc.kind === "legend")!;
assert.equal(LEGEND_APPEARANCES["legend-fabiano-caruana"].hairStyle, "curly");
assert.equal(LEGEND_APPEARANCES["legend-fabiano-caruana"].glasses, "square");
assert.equal(LEGEND_APPEARANCES["legend-magnus-carlsen"].facialHair, "stubble");
assert.equal(LEGEND_APPEARANCES["legend-hikaru-nakamura"].facialHair, "beard");
assert.equal(LEGEND_APPEARANCES["legend-d-gukesh"].facialHair, "beard");
assert.equal(LEGEND_APPEARANCES["legend-viswanathan-anand"].glasses, "square");
assert.equal(LEGEND_APPEARANCES["legend-hou-yifan"].glasses, "square");
assert.equal(LEGEND_APPEARANCES["legend-richard-rapport"].hairStyle, "long");
const copy = npcAppearance(legend);
copy.hairColor = "blue";
assert.notEqual(
  npcAppearance(legend).hairColor,
  "blue",
  "Callers cannot mutate the shared curated data",
);
assert.ok(
  renderPortraitSvg(npcAppearance(legend), `${legend.name} portrait`).includes(
    "<svg",
  ),
);
console.log(
  `NPC portrait checks passed: ${npcs.length} existing identities, valid and varied character art, stable across reload/rating/age/name/federation changes, female appearance and unmodified NPC data.`,
);
