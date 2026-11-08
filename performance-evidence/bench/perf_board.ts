const dir = process.argv[2];
const { perft, parseFen } = await import(`${dir}/src/game/chess/board.ts`);
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const KIWI = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
const run = (label: string, fen: string, d: number) => {
  perft(parseFen(fen), d);
  const ts: number[] = [];
  for (let i = 0; i < 7; i++) { const s = performance.now(); perft(parseFen(fen), d); ts.push(performance.now() - s); }
  ts.sort((a, b) => a - b);
  console.log(label.padEnd(24), 'median', ts[3].toFixed(1), 'ms');
};
run('perft(start,4)', START, 4);
run('perft(kiwipete,3)', KIWI, 3);
const before = process.memoryUsage().heapUsed;
