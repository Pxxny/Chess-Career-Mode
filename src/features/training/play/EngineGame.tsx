import { useState } from 'react';
import { Badge, Button, Card, CardTitle } from '@/components/ui';
import { GAME_CONFIG } from '@/data/config';
import { createRng } from '@/game/rng';
import { engineOpponent } from '@/game/play/opponent';
import { practiceBlock } from '@/game/play/practice';
import { ENGINE_TIME_CONTROLS, findTimeControl } from '@/game/play/timeControls';
import { MAX_ENGINE_ELO, MIN_ENGINE_ELO, strengthFor } from '@/game/engine/strength';
import { useEngineInfo } from '@/hooks/useEngineInfo';
import { useSave } from '@/hooks/useGame';
import type { PieceColor } from '@/types';
import { Field, gameSeed, Segmented, selectClass, StatusLine } from './controls';
import { GameScreen } from './GameScreen';
import type { SessionConfig } from './useGameSession';

const PRESETS = [
  { label: 'Beginner', elo: 800 },
  { label: 'Club', elo: 1400 },
  { label: 'Strong club', elo: 1800 },
  { label: 'Master', elo: 2300 },
  { label: 'Grandmaster', elo: 2700 },
];

export function EngineGame() {
  const save = useSave();
  const info = useEngineInfo();
  const [started, setStarted] = useState<SessionConfig | null>(null);
  const [run, setRun] = useState(0);
  const [elo, setElo] = useState(Math.round(Math.min(2800, Math.max(800, save.player.rating)) / 50) * 50);
  const [full, setFull] = useState(false);
  const [think, setThink] = useState(0);
  const [colorChoice, setColorChoice] = useState<PieceColor | 'random'>('white');
  const [tcId, setTcId] = useState('none');
  const [helpers, setHelpers] = useState(true);

  const tc = findTimeControl(tcId);
  const block = practiceBlock(save, 'engine', tc);
  const label = full ? 'Full strength' : `Elo ${elo}`;

  const build = (): SessionConfig => {
    const rng = createRng(gameSeed(save, 3));
    const color: PieceColor = colorChoice === 'random' ? (rng.chance(0.5) ? 'white' : 'black') : colorChoice;
    const strength = strengthFor(full ? MAX_ENGINE_ELO : elo, { full, thinkMs: think > 0 ? think : undefined });
    return {
      mode: 'engine',
      opponent: engineOpponent(full ? MAX_ENGINE_ELO : elo, 'Stockfish'),
      color,
      timeControl: tc,
      startFen: null,
      objective: null,
      situation: null,
      rated: false,
      forcedLine: null,
      strength,
      noResign: true,
      allowTakeback: helpers,
      allowHint: helpers,
      liveFeedback: false,
      seed: gameSeed(save, 5),
    };
  };

  if (started) return <GameScreen key={run} config={started} title="Game vs the Engine" onExit={() => setStarted(null)} onAgain={() => { setRun((r) => r + 1); setStarted(build()); }} />;

  return (
    <Card>
      <CardTitle aside={<div className="flex flex-wrap gap-2"><Badge>Costs {GAME_CONFIG.practice.ap.engine} AP</Badge><Badge tone={info.status === 'stockfish' ? 'gold' : 'neutral'}>{info.status === 'idle' ? 'Engine starts with the game' : info.label}</Badge></div>}>Game vs the Engine</CardTitle>
      <p className="mb-4 text-sm text-ink-muted">Play Stockfish at the strength you choose. Every move the engine makes is checked against the rules, so it can only play legal moves.</p>

      <div className="space-y-5">
        <div>
          <p className="mb-1 text-sm font-semibold text-ink">Difficulty: {label}</p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button key={p.label} type="button" disabled={full} onClick={() => setElo(p.elo)} className={`min-h-11 rounded-lg border px-3 text-sm font-semibold disabled:opacity-40 ${!full && elo === p.elo ? 'border-gold-500 bg-gold-500/10 text-gold-300' : 'border-white/10 bg-navy-900 text-ink-muted hover:text-ink'}`}>
                {p.label} ({p.elo})
              </button>
            ))}
          </div>
          <input aria-label="Engine Elo" type="range" min={MIN_ENGINE_ELO} max={3200} step={50} value={elo} disabled={full} onChange={(e) => setElo(Number(e.target.value))} className="w-full accent-gold-500" />
          <label className="mt-2 flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={full} onChange={(e) => setFull(e.target.checked)} className="accent-gold-500" />
            Full strength (no weakening)
          </label>
          <p className="mt-1 text-xs text-ink-faint">The Elo is approximate. Stockfish's strength setting is calibrated against engine rating lists, not human ratings, and levels below 1320 are made by letting the engine choose weaker moves on purpose.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Segmented<PieceColor | 'random'> label="Colour" value={colorChoice} onChange={setColorChoice} options={[{ id: 'white', label: 'White' }, { id: 'black', label: 'Black' }, { id: 'random', label: 'Random' }]} />
          <Field label="Time control">
            {(id) => (
              <select id={id} className={selectClass} value={tcId} onChange={(e) => setTcId(e.target.value)}>
                {ENGINE_TIME_CONTROLS.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Engine thinking time" hint="Longer thinking makes the engine more accurate at the chosen level.">
            {(id) => (
              <select id={id} className={selectClass} value={think} onChange={(e) => setThink(Number(e.target.value))}>
                <option value={0}>Automatic</option>
                <option value={200}>Fast (0.2 s)</option>
                <option value={800}>Normal (0.8 s)</option>
                <option value={2000}>Deep (2 s)</option>
              </select>
            )}
          </Field>
          <label className="flex items-center gap-2 self-end pb-3 text-sm text-ink">
            <input type="checkbox" checked={helpers} onChange={(e) => setHelpers(e.target.checked)} className="accent-gold-500" />
            Allow hints and take-backs
          </label>
        </div>

        {info.problem && info.status === 'builtin' && <StatusLine>Stockfish could not be loaded ({info.problem}). The built-in engine will play instead. It is weaker but follows every rule.</StatusLine>}
        {block && <StatusLine tone="warn">{block}</StatusLine>}
        <Button disabled={!!block} onClick={() => setStarted(build())}>Start game</Button>
      </div>
    </Card>
  );
}
