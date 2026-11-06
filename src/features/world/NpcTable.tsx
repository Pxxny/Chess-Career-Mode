import { getCountry } from '@/data/world/countries';
import type { Npc } from '@/types';

interface NpcTableProps {
  npcs: Npc[];
  showRank?: boolean;
  onSelect?: (npc: Npc) => void;
}

export function NpcTable({ npcs, showRank = false, onSelect }: NpcTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-ink-faint">
          <tr className="border-b border-white/5">
            {showRank && <th className="w-12 py-2 pr-2 font-medium">Rank</th>}
            <th className="py-2 pr-2 font-medium">Player</th>
            <th className="py-2 pr-2 font-medium">Country</th>
            <th className="py-2 text-right font-medium">Elo</th>
          </tr>
        </thead>
        <tbody>
          {npcs.map((npc) => (
            <tr key={npc.id} className="border-b border-white/5 last:border-0">
              {showRank && <td className="py-2.5 pr-2 tabular-nums text-ink-muted">{npc.worldRank ?? '–'}</td>}
              <td className="py-2.5 pr-2 font-semibold text-ink">
                {onSelect ? (
                  <button type="button" onClick={() => onSelect(npc)} className="text-left underline-offset-2 hover:text-gold-300 hover:underline">
                    {npc.name}
                  </button>
                ) : (
                  npc.name
                )}
                {npc.title !== 'none' && <span className="ml-2 text-xs font-medium text-gold-500">{npc.title}</span>}
              </td>
              <td className="py-2.5 pr-2 text-ink-muted">
                <span aria-hidden>{getCountry(npc.nationality)?.flag}</span>{' '}
                {getCountry(npc.nationality)?.name ?? npc.nationality}
              </td>
              <td className="py-2.5 text-right font-semibold tabular-nums text-gold-400">{npc.currentElo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
