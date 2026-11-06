import { useGameStore } from '@/store/gameStore';

export function AlternateHistoryToggle({ enabled }: { enabled: boolean }) {
  const setAlternateHistory = useGameStore((s) => s.setAlternateHistory);
  return (
    <label className="flex items-start gap-3 text-sm text-ink-muted">
      <input type="checkbox" checked={enabled} onChange={(e) => setAlternateHistory(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#d4a94a]" />
      <span>
        <span className="font-semibold text-ink">Alternate history mode</span>
        <span className="block">Historical legends appear in their prime, whatever the year. When off, they only appear in the years they were active.</span>
      </span>
    </label>
  );
}
