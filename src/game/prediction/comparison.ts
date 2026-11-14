export function comparisonWinner(a: unknown, b: unknown, lower = false): 'player' | 'opponent' | 'equal' | 'unknown' {
  if (typeof a !== 'number' || typeof b !== 'number' || !Number.isFinite(a) || !Number.isFinite(b)) return 'unknown';
  if (Math.abs(a-b) < 0.05) return 'equal';
  return (a>b) !== lower ? 'player' : 'opponent';
}
