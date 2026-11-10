import { writeFileSync, mkdirSync } from "node:fs";
import { LEGENDS } from "../src/data/chess/legends.ts";
import { npcAppearance } from "../src/game/appearance/npcAppearance.ts";
import { renderPortraitSvg } from "../src/game/appearance/portraitSvg.ts";

const favorites = [
  "magnus-carlsen",
  "fabiano-caruana",
  "hikaru-nakamura",
  "viswanathan-anand",
  "anish-giri",
  "maxime-vachier-lagrave",
  "levon-aronian",
  "d-gukesh",
  "garry-kasparov",
  "vladimir-kramnik",
  "hou-yifan",
  "judit-polgar",
];
const players = [
  ...favorites.map((slug) => LEGENDS.find((p) => p.slug === slug)!),
  ...LEGENDS.filter((p) => !favorites.includes(p.slug)),
];
const cards = players
  .map(
    (p) =>
      `<article data-player="${p.slug}">${renderPortraitSvg(npcAppearance({ id: `legend-${p.slug}`, gender: p.gender ?? "male" }), `${p.name} portrait`)}<div>${p.name}</div></article>`,
  )
  .join("");
mkdirSync("artifacts", { recursive: true });
writeFileSync(
  "artifacts/real-player-portraits.html",
  `<!doctype html><html lang="en"><meta charset="utf-8"><title>Chess Career Mode — Player portraits</title><style>*{box-sizing:border-box}body{margin:0;background:#181e19;color:#eef1e6;font-family:Arial,sans-serif}h1{margin:28px 24px 8px;font-size:25px}p{margin:0 24px 20px;color:#b6c5ac}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;padding:0 20px 24px}article{padding:14px 8px 12px;border:1px solid #414b3e;background:#252e26;border-radius:14px;text-align:center;font-size:14px;font-weight:600}svg{display:block;width:132px;height:132px;margin:0 auto 10px;border-radius:50%;border:1px solid #93a789}article div{min-height:32px;display:flex;align-items:center;justify-content:center}</style><h1>Chess Career Mode</h1><p>Real-player character portraits</p><main class="grid">${cards}</main></html>`,
);
console.log(
  `Rendered ${players.length} curated character portraits to artifacts/real-player-portraits.html`,
);
