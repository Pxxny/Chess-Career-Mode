import { useMemo } from 'react';
import { Trophy } from 'lucide-react';
import { Badge, Button, Card, CardTitle, EmptyState } from '@/components/ui';
import { useSave } from '@/hooks/useGame';
import { useNpcs } from '@/hooks/useNpcs';
import { getCountry } from '@/data/world/countries';
import { useGameStore } from '@/store/gameStore';
import { useOpeningDb } from '@/store/openingStore';
import { buildMatchSetup, highestTitle } from '@/game/match/setup';
import { describeTimeControl } from '@/game/match/timeControls';
import { PLAYER_ID, playerOpponentId, standings } from '@/game/match/tournament';
import type { MatchSetup } from '@/game/match/session';
import { getSchedule, isEligible, type ScheduledEvent } from '@/game/world/schedule';
import { useState } from 'react';

/** Events held this week: the schedule of the week before shows them one week away. */
function eventsThisWeek(save: ReturnType<typeof useSave>): ScheduledEvent[] {
  const country = getCountry(save.player.country);
  const region = { city: save.player.city.name, countryCode: save.player.country, demonym: country?.nationality ?? save.player.country, continent: country?.continent ?? 'World' };
  const d = save.world.date;
  return getSchedule({ year: d.year, week: d.week - 1 }, region, save.career.id, 4).filter((e) => e.weeksUntilStart === 1);
}

/** The tournament in progress (pairings, standings, the next game) or the events that can be entered this week. */
export function TournamentPanel({ onStart }: { onStart: (setup: MatchSetup) => void }) {
  const save = useSave();
  const npcs = useNpcs();
  const db = useOpeningDb();
  const enter = useGameStore((s) => s.enterTournament);
  const withdraw = useGameStore((s) => s.withdrawTournament);
  const close = useGameStore((s) => s.closeTournament);
  const [error, setError] = useState<string | null>(null);
  const t = save.tournament;
  const events = useMemo(() => eventsThisWeek(save), [save.world.date, save.player.country, save.player.city.name, save.career.id]);
  const rows = useMemo(() => (t ? standings(t) : []), [t]);

  const play = (mode: 'play' | 'simulate') => {
    if (!t) return;
    const next = playerOpponentId(t);
    const npc = next ? npcs.find((n) => n.id === next.id) : undefined;
    if (!next || !npc) return;
    onStart(buildMatchSetup({ save, npc, playerColor: next.color, timeControl: t.timeControl, rated: true, mode, speed: mode === 'simulate' ? 'fast' : 'brisk', tournament: { id: t.eventId, name: t.name, level: t.level, round: t.round, rounds: t.rounds }, seed: Math.floor(Math.random() * 2 ** 31), db }));
  };

  if (t) {
    const next = playerOpponentId(t);
    const npc = next ? npcs.find((n) => n.id === next.id) : undefined;
    const me = rows.find((r) => r.player.id === PLAYER_ID);
    const shown = rows.slice(0, 10);
    if (me && me.rank > 10) shown.push(me);
    return (
      <Card data-testid="tournament-panel">
        <CardTitle aside={<Badge tone="gold">{t.status === 'finished' ? 'Finished' : `Round ${t.round} of ${t.rounds}`}</Badge>}>{t.name}</CardTitle>
        <p className="mb-3 text-sm text-ink-muted">{t.players.length} players · {describeTimeControl(t.timeControl)} · prize fund {t.prizeFund}</p>
        {t.status === 'playing' && next && npc && (
          <div className="mb-4 rounded-xl bg-navy-900 p-3">
            <p className="text-sm text-ink">Round {t.round}: you play <span className="font-semibold">{next.color}</span> against <span className="font-semibold">{npc.name}</span> ({npc.currentElo}).</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => play('play')} data-testid="play-round">Play the game</Button>
              <Button variant="secondary" onClick={() => play('simulate')}>Simulate (take control any time)</Button>
            </div>
          </div>
        )}
        {t.status === 'finished' && (
          <div className="mb-4 rounded-xl bg-navy-900 p-3">
            <p className="text-ink">You finished <span className="font-semibold">{t.finalRank}</span> of {t.players.length} with {me?.player.points} points{t.prize > 0 ? ` and won ${t.prize}` : ''}.</p>
            <Button className="mt-3" onClick={close}>Close results</Button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="standings">
            <thead><tr className="text-left text-xs text-ink-faint"><th className="py-1 font-normal">#</th><th className="font-normal">Player</th><th className="font-normal">Elo</th><th className="font-normal">Pts</th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.player.id} className={r.player.isPlayer ? 'bg-gold-500/10 font-semibold text-ink' : 'text-ink-muted'}>
                  <td className="py-1 pr-2 font-mono">{r.rank}</td>
                  <td>{getCountry(r.player.countryCode)?.flag} {r.player.title !== 'none' ? `${r.player.title} ` : ''}{r.player.name}</td>
                  <td className="font-mono">{r.player.elo}</td>
                  <td className="font-mono">{r.player.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {t.status === 'playing' && <Button className="mt-4" variant="danger" onClick={() => window.confirm('Withdraw? Your remaining games are lost by forfeit.') && withdraw()}>Withdraw from the tournament</Button>}
      </Card>
    );
  }

  return (
    <Card data-testid="tournament-panel">
      <CardTitle>Tournaments this week</CardTitle>
      {events.length === 0 ? (
        <EmptyState title="No event is held this week" description="Local, national, international and elite events take place on a fixed calendar. Check Home for the next ones, or play a rated game meanwhile." />
      ) : (
        <ul className="space-y-3">
          {events.map((e) => {
            const eligible = isEligible(e, save.player.rating, save.player.reputation);
            const played = save.history.tournaments.some((r) => r.tournamentId === e.id);
            const affordable = save.player.money >= e.entryFee;
            return (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-navy-900 p-3">
                <div>
                  <p className="font-semibold text-ink">{e.name}</p>
                  <p className="text-xs text-ink-muted">{e.level} · {e.fieldSize} players · entry {e.entryFee} · needs {e.minElo}+ Elo{e.minReputation ? `, reputation ${e.minReputation}+` : ''}</p>
                </div>
                <Button
                  onClick={() => {
                    const r = enter(e);
                    setError(r.ok ? null : r.error);
                  }}
                  disabled={!eligible || played || !affordable}
                >
                  <Trophy className="h-4 w-4" aria-hidden /> {played ? 'Already played' : !eligible ? 'Not eligible' : !affordable ? 'Cannot afford' : 'Enter'}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
      <p className="mt-3 text-xs text-ink-faint">Your title: {highestTitle(save) === 'none' ? 'none' : highestTitle(save)}. Events held this week accept entries on the spot.</p>
    </Card>
  );
}
