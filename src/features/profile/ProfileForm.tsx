import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui';
import { GAME_CONFIG } from '@/data/config';
import { useGameStore } from '@/store/gameStore';

export function ProfileForm({ currentName }: { currentName: string }) {
  const renamePlayer = useGameStore((s) => s.renamePlayer);
  const [name, setName] = useState(currentName);
  const trimmed = name.trim();
  const unchanged = trimmed === currentName;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (trimmed && !unchanged) renamePlayer(trimmed);
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex-1 text-sm text-ink-muted">
        Player name
        <input
          value={name}
          maxLength={GAME_CONFIG.maxNameLength}
          onChange={(e) => setName(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-white/10 bg-navy-900 px-3 py-2.5 text-ink outline-none focus:border-gold-500"
        />
      </label>
      <Button type="submit" disabled={!trimmed || unchanged}>
        Save name
      </Button>
    </form>
  );
}
