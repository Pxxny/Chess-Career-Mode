import { useState } from 'react';
import { Card, CardTitle, EmptyState } from '@/components/ui';
import { ResultBadge } from '@/components/game/ResultBadge';
import { recentGames } from '@/game/history/stats';
import { useSave } from '@/hooks/useGame';
import { cn } from '@/utils/cn';
import { BlitzLobby } from './play/BlitzLobby';
import { EngineGame } from './play/EngineGame';
import { GameHistory } from './play/GameHistory';
import { TrainingGame } from './play/TrainingGame';

const MODES = [
  { id: 'training', label: 'Training Game', blurb: 'Play an NPC with a training goal' },
  { id: 'blitz', label: 'Online Blitz', blurb: 'Rated games on a simulated server' },
  { id: 'engine', label: 'Game vs the Engine', blurb: 'Play Stockfish at any strength' },
  { id: 'history', label: 'History', blurb: 'Past games and analysis' },
] as const;
type ModeId = (typeof MODES)[number]['id'];

function HistoryView() {
  const { history, training, practice } = useSave();
  const thematic = history.sessions.filter((s) => s.sessionId === 'thematic-games').slice(-5).reverse();
  const rated = recentGames(history, 5);
  return (
    <>
      <GameHistory games={practice.games} title="Practice games" limit={20} />
      <Card className="my-4">
        <CardTitle>Games to analyse</CardTitle>
        <p className="font-display text-3xl font-bold tabular-nums text-ink">{training.unanalyzedGames}</p>
        <p className="mt-1 text-sm text-ink-muted">Rated games and thematic games you have not yet gone over. Use Analyze Your Game in the Sessions tab (Chess) to learn from them. Practice games are analysed automatically when they finish.</p>
      </Card>
      <Card className="mb-4">
        <CardTitle>Recent thematic games</CardTitle>
        {thematic.length === 0 ? (
          <EmptyState title="No thematic games yet" description="Complete a Thematic Games session to see it here." />
        ) : (
          <ul className="divide-y divide-white/5">
            {thematic.map((s, i) => (
              <li key={`${s.year}-${s.week}-${s.day}-${i}`} className="py-2.5">
                <p className="font-semibold text-ink">{s.detail ?? s.name}</p>
                <p className="text-xs text-ink-muted">{s.qualityLabel} session · year {s.year}, week {s.week}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <CardTitle>Recent rated games</CardTitle>
        {rated.length === 0 ? (
          <EmptyState title="No rated games yet" description="Rated career games and tournament games will be listed here." />
        ) : (
          <ul className="divide-y divide-white/5">
            {rated.map((g) => (
              <li key={g.id} className="flex items-center gap-3 py-2.5">
                <ResultBadge outcome={g.outcome} />
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{g.opponentName}</p>
                  <p className="text-xs text-ink-muted">Elo {g.opponentElo} · {g.color}{g.opening ? ` · ${g.opening}` : ''}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

export function GamesTab() {
  const [mode, setMode] = useState<ModeId>('training');
  return (
    <>
      <div role="group" aria-label="Game mode" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MODES.map((m) => (
          <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => setMode(m.id)} className={cn('min-h-14 rounded-xl border px-3 py-2 text-left', mode === m.id ? 'border-gold-500 bg-gold-500/10' : 'border-white/10 bg-navy-800 hover:border-gold-500/40')}>
            <span className="block text-sm font-semibold text-ink">{m.label}</span>
            <span className="block text-[11px] text-ink-muted">{m.blurb}</span>
          </button>
        ))}
      </div>
      {mode === 'training' && <TrainingGame />}
      {mode === 'blitz' && <BlitzLobby />}
      {mode === 'engine' && <EngineGame />}
      {mode === 'history' && <HistoryView />}
    </>
  );
}
