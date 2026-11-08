import assert from 'node:assert/strict';
import { parseFen, perft } from '../src/game/chess/board';

/** Fixed workloads: no engine search limits, difficulty settings or game results are changed. */
const cases = [
  { name: 'Starting position', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', depth: 4, nodes: 197281 },
  { name: 'Kiwipete', fen: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', depth: 3, nodes: 97862 },
] as const;

console.log(`Chess benchmark — Node ${process.versions.node}; one warm-up and seven measured runs per position.`);
for (const item of cases) {
  const position = parseFen(item.fen);
  assert.equal(perft(position, item.depth), item.nodes, `${item.name} warm-up perft`);
  const samples: number[] = [];
  for (let i = 0; i < 7; i++) {
    const start = performance.now();
    const nodes = perft(position, item.depth);
    samples.push(performance.now() - start);
    assert.equal(nodes, item.nodes, `${item.name} perft run ${i + 1}`);
  }
  const median = [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)];
  console.log(`${item.name}: depth ${item.depth}; ${item.nodes.toLocaleString('en-US')} nodes; median ${median.toFixed(2)} ms; ${Math.round(item.nodes * 1000 / median).toLocaleString('en-US')} nodes/s`);
  console.log(`  Samples (ms): ${samples.map((sample) => sample.toFixed(2)).join(', ')}`);
}
console.log('All perft reference assertions passed. Compare medians on the same machine with other CPU-heavy work stopped.');
