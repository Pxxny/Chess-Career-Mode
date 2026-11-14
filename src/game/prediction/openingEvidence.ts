import { getBookOpening, OPENING_BOOK } from '@/data/chess/openingBook';
import type { GameSave } from '@/types';
import { bounded } from './config';
export interface OpeningUsage { name: string; eco: string; games: number; source: 'played' | 'preference' }
export function resolveOpening(value: string) {
  return getBookOpening(value) ?? OPENING_BOOK.find(o => o.name.toLowerCase() === value.toLowerCase() || o.eco === value || value.toLowerCase().startsWith(o.name.toLowerCase()));
}
export const evidenceCode = (value: string) => resolveOpening(value)?.eco ?? value;
export function openingEvidence(save: GameSave, planned?: string) {
  const sample = [...save.history.games.slice(-500).map(g => g.opening), ...save.practice.games.slice(-500).map(g => g.openingName)].filter((s): s is string => !!s);
  const counts = new Map<string, OpeningUsage>();
  for (const name of sample) {
    const entry = resolveOpening(name), key = entry?.eco ?? name;
    const current = counts.get(key);
    counts.set(key, { name: entry?.name ?? name, eco: entry?.eco ?? '', games: (current?.games ?? 0) + 1, source: 'played' });
  }
  const usage = [...counts.values()].sort((a,b) => b.games - a.games || a.name.localeCompare(b.name)).slice(0,4);
  if (!usage.length) for (const id of [...new Set([...save.repertoire.preferences.white, ...save.repertoire.preferences.black])].slice(0,4)) {
    const o = resolveOpening(id); usage.push({ name: o?.name ?? id, eco: o?.eco ?? '', games: 0, source: 'preference' });
  }
  const code = planned ? evidenceCode(planned) : undefined;
  const studied = save.repertoire.study.filter(s => !code || evidenceCode(s.openingId) === code).reduce((n,s) => n + Math.max(0,Math.min(1,s.score)),0);
  const played = code ? counts.get(code)?.games ?? 0 : sample.length;
  return { usage, familiarity: bounded(save.player.skills.opening + Math.min(25, Math.log1p(studied) * 6 + Math.log1p(played) * 3),0,100), basis: planned ? 'planned' as const : 'repertoire' as const };
}
