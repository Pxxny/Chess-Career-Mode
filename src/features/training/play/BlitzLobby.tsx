import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Card, CardTitle, StatCard } from '@/components/ui';
import { GAME_CONFIG } from '@/data/config';
import { getCountry } from '@/data/world/countries';
import { buildOnlinePool, currentRating, findMatch, opponentFromOnline, type Match } from '@/game/play/blitz';
import { practiceBlock } from '@/game/play/practice';
import { BLITZ_TIME_CONTROLS, findTimeControl } from '@/game/play/timeControls';
import { strengthFor } from '@/game/engine/strength';
import { chooseOpening } from '@/game/openings/situations';
import { createRng, mixSeed } from '@/game/rng';
import { useSave } from '@/hooks/useGame';
import { useOpeningDb } from '@/store/openingStore';
import { Segmented, StatusLine, gameSeed, hashString } from './controls';
import { GameHistory } from './GameHistory';
import { GameScreen } from './GameScreen';
import type { SessionConfig } from './useGameSession';

const pcfg = GAME_CONFIG.practice;

function RatingGraph({ points }: { points: number[] }) {
  if (points.length < 2) return <p className="text-sm text-ink-muted">Play a few rated games to see your rating graph.</p>;
  const W = 600;
  const H = 110;
  const lo = Math.min(...points) - 10;
  const hi = Math.max(...points) + 10;
  const x = (i: number): number => (i / (points.length - 1)) * W;
  const y = (v: number): number => H - ((v - lo) / (hi - lo || 1)) * (H - 10) - 5;
  const path = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Blitz rating over your last ${points.length} rated games, from ${points[0]} to ${points[points.length - 1]}.`} className="w-full rounded-lg bg-navy-900">
        <path d={path} fill="none" stroke="#e5c166" strokeWidth="2" />
        <circle cx={x(points.length - 1)} cy={y(points[points.length - 1])} r="4" fill="#e5c166" />
      </svg>
      <figcaption className="mt-1 flex justify-between text-[11px] text-ink-faint">
        <span>{lo + 10}</span>
        <span>Last {points.length} rated games</span>
        <span>{hi - 10}</span>
      </figcaption>
    </figure>
  );
}

export function BlitzLobby() {
  const save = useSave();
  const db = useOpeningDb();
  const { practice, world } = save;
  const [tcId, setTcId] = useState('5+0');
  const [rated, setRated] = useState<'rated' | 'casual'>('rated');
  const [range, setRange] = useState(200);
  const [searching, setSearching] = useState<{ match: Match | null; shown: number } | null>(null);
  const [found, setFound] = useState<Match | null>(null);
  const [none, setNone] = useState(false);
  const [started, setStarted] = useState<{ config: SessionConfig; runId: number } | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const pool = useMemo(() => buildOnlinePool(hashString(save.career.id), db, world.date.year, pcfg.onlinePoolSize), [save.career.id, db, world.date.year]);
  const tc = findTimeControl(tcId);
  const block = practiceBlock(save, 'blitz', tc);
  const provisional = practice.blitzGames < pcfg.provisionalGames;
  const blitz = practice.games.filter((g) => g.mode === 'blitz');
  const rated_ = blitz.filter((g) => g.ratingAfter !== null);
  const recent = rated_.slice(-40);
  const graph = recent.length ? [recent[0].ratingBefore as number, ...recent.map((g) => g.ratingAfter as number)] : [];
  const recordNow = practice.blitzRating;

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const search = () => {
    setFound(null);
    setNone(false);
    const lastOpponent = blitz[blitz.length - 1]?.opponentId;
    const match = findMatch(pool, practice.onlineDelta, { rating: practice.blitzRating, timeControl: tcId, maxRange: range, exclude: lastOpponent ? [lastOpponent] : [] }, gameSeed(save, 21));
    setSearching({ match, shown: 0 });
    const steps = match?.steps.length ?? 6;
    let shown = 0;
    timer.current = setInterval(() => {
      shown++;
      setSearching((s) => (s ? { ...s, shown } : s));
      if (shown >= steps) {
        if (timer.current) clearInterval(timer.current);
        setSearching(null);
        if (match) setFound(match);
        else setNone(true);
      }
    }, 450);
  };

  const start = () => {
    if (!found) return;
    const opponent = opponentFromOnline(found.player, practice.onlineDelta, db);
    const rng = createRng(gameSeed(save, 31));
    const color = rng.chance(0.5) ? 'white' : 'black';
    const config: SessionConfig = {
      mode: 'blitz',
      opponent,
      color,
      timeControl: tc,
      startFen: null,
      objective: null,
      situation: chooseOpening(db, save.repertoire.preferences, { color, opponent: opponent.temperament, whiteFirstMove: color === 'black' ? (opponent.lines.white[0]?.[0] ?? null) : null }, createRng(mixSeed(3, 4)))?.situation ?? null,
      rated: rated === 'rated',
      forcedLine: null,
      strength: strengthFor(opponent.elo, { thinkMs: 120 }),
      noResign: false,
      allowTakeback: false,
      allowHint: false,
      liveFeedback: false,
      seed: gameSeed(save, 41),
    };
    setStarted({ config, runId: practice.gameCounter });
    setFound(null);
  };

  if (started) {
    return (
      <GameScreen
        key={started.runId}
        config={started.config}
        title={`Online Blitz · ${started.config.rated ? 'Rated' : 'Casual'} (simulated)`}
        onExit={() => setStarted(null)}
        extra={({ ratingChange, ratingAfter }) => (ratingChange === null ? 'Casual game: your rating did not change.' : `Blitz rating ${ratingChange >= 0 ? '+' : ''}${ratingChange} → ${ratingAfter}`)}
      />
    );
  }

  const p = found?.player;
  const h2h = p ? blitz.filter((g) => g.opponentId === p.id) : [];
  const country = p ? getCountry(p.countryCode) : null;

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Blitz rating" value={`${practice.blitzRating}${provisional ? '?' : ''}`} hint={provisional ? `Provisional: ${pcfg.provisionalGames - practice.blitzGames} more games` : undefined} />
        <StatCard label="Peak" value={String(practice.blitzPeak)} />
        <StatCard label="Games" value={String(practice.blitzGames)} />
        <StatCard label="Record" value={`${rated_.filter((g) => g.outcome === 'win').length}-${rated_.filter((g) => g.outcome === 'draw').length}-${rated_.filter((g) => g.outcome === 'loss').length}`} hint="W-D-L, rated" />
      </div>

      <Card className="mb-4">
        <CardTitle aside={<Badge>Simulated server · {pool.length} players</Badge>}>Find an opponent</CardTitle>
        <p className="mb-4 text-sm text-ink-muted">Matchmaking is simulated: you are paired with a simulated online player whose rating is close to yours. It is not real multiplayer. Every block of {pcfg.ap.blitzBlock} games in a day costs {pcfg.ap.blitz} AP. Online games use no training hours, but they tire you a little, and every game earns experience.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Segmented label="Time control" value={tcId} onChange={setTcId} options={BLITZ_TIME_CONTROLS.map((t) => ({ id: t.id, label: t.label }))} />
          <Segmented label="Game type" value={rated} onChange={setRated} options={[{ id: 'rated', label: 'Rated' }, { id: 'casual', label: 'Casual' }]} />
          <div>
            <label htmlFor="blitz-range" className="mb-1 block text-sm font-semibold text-ink">Rating range: ±{range}</label>
            <input id="blitz-range" type="range" min={50} max={600} step={50} value={range} onChange={(e) => setRange(Number(e.target.value))} className="w-full accent-gold-500" />
            <p className="text-xs text-ink-faint">A narrow range can mean a longer wait.</p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {block && <StatusLine tone="warn">{block}</StatusLine>}
          {searching && (
            <div role="status" aria-live="polite" className="rounded-lg bg-navy-900 p-3 text-sm text-ink-muted">
              <p className="font-semibold text-ink">Searching for an opponent…</p>
              {searching.match?.steps.slice(0, searching.shown).map((s) => (
                <p key={s.second}>{s.second}s · looking within ±{s.range} · {s.candidates} online</p>
              )) ?? <p>Widening the search…</p>}
            </div>
          )}
          {none && <StatusLine>No one was online in your range for {tc.label}. Widen the rating range or try another time control.</StatusLine>}
          {last && <StatusLine>{last}</StatusLine>}
          <Button disabled={!!block || !!searching} onClick={search}>{searching ? 'Searching…' : 'Find match'}</Button>
        </div>
      </Card>

      {p && found && (
        <Card className="mb-4">
          <CardTitle aside={<Badge tone="gold">Matched after {found.waitSeconds}s</Badge>}>Opponent found</CardTitle>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-display text-2xl font-bold text-ink">{p.username}</p>
              <p className="text-sm text-ink-muted">Blitz {currentRating(p, practice.onlineDelta)} · {p.games} games · member since {p.memberSince}{country ? ` · ${country.name}` : ''}</p>
              <p className="mt-1 text-sm italic text-ink-muted">“{p.bio}”</p>
              <p className="mt-2 text-sm text-ink">Style: {p.style} ({p.temperament}) · Likes: {p.favouriteIds.slice(0, 3).map((id) => db.byId.get(id)?.name).filter(Boolean).join(', ')}</p>
              <p className="mt-1 text-sm text-ink-muted">
                {h2h.length === 0 ? 'You have not played them before.' : `Head to head: ${h2h.filter((g) => g.outcome === 'win').length} wins, ${h2h.filter((g) => g.outcome === 'draw').length} draws, ${h2h.filter((g) => g.outcome === 'loss').length} losses.`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={start}>Accept and play</Button>
              <Button variant="secondary" onClick={() => { setFound(null); setLast('You declined the match.'); }}>Decline</Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="mb-4">
        <CardTitle>Rating history</CardTitle>
        <RatingGraph points={graph} />
        <p className="mt-1 text-xs text-ink-faint">Current rating {recordNow}.</p>
      </Card>

      <GameHistory games={blitz} title="Match history" limit={15} />
    </>
  );
}
