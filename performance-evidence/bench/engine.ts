const dir = process.argv[2];
const { BuiltinEngine } = await import(`${dir}/src/game/engine/builtin.ts`);
const POS = [
  ['start', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'],
  ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1'],
  ['middlegame', 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10'],
];
const e = new BuiltinEngine();
// 1) fixed depth, generous budget: same best move expected, compare time
const out: string[] = [];
for (const [name, fen] of POS) {
  const s = performance.now();
  const r = await e.search({ fen, moves: [], depth: 4, movetime: 60000 });
  out.push(`${name.padEnd(11)} depth4 -> ${r.best} (cp ${r.lines[0].cp}) in ${(performance.now() - s).toFixed(0)} ms`);
}
// 2) fixed 350 ms budget (the default): how deep does it get?
for (const [name, fen] of POS) {
  const r = await e.search({ fen, moves: [], depth: 5, movetime: 350 });
  out.push(`${name.padEnd(11)} 350ms budget -> reached depth ${r.depth}, best ${r.best}`);
}
console.log(out.join('\n'));
