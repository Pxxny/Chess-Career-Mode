import { ARCHETYPES, getArchetype } from '@/data/archetypes';
import { cn } from '@/utils/cn';
import { ArchetypeSummary } from '../ArchetypeSummary';
import type { CharacterDraft } from '../useCharacterDraft';

export function ArchetypeStep({ draft, update }: { draft: CharacterDraft; update: (p: Partial<CharacterDraft>) => void }) {
  const selected = getArchetype(draft.archetype);
  return (
    <div>
      <p className="mb-4 text-sm text-ink-muted">
        Your archetype sets your starting skills and how you tend to play. It is a head start, not a restriction: every skill can be trained.
      </p>
      <div role="radiogroup" aria-label="Playing archetype" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ARCHETYPES.map((a) => {
          const active = a.id === draft.archetype;
          return (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => update({ archetype: a.id })}
              className={cn(
                'rounded-xl border p-3 text-left transition-colors',
                active ? 'border-gold-500 bg-gold-500/10' : 'border-white/10 bg-navy-900 hover:border-white/25',
              )}
            >
              <span className={cn('block font-display text-lg font-bold', active ? 'text-gold-300' : 'text-ink')}>{a.label}</span>
              <span className="mt-0.5 block text-xs text-ink-muted">{a.tagline}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-5 rounded-xl border border-white/[0.06] bg-navy-900 p-4">
        <h3 className="mb-3 font-display text-lg font-bold text-ink">{selected.label}</h3>
        <ArchetypeSummary archetype={selected} />
      </div>
    </div>
  );
}
