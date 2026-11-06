import { useMemo, useState } from 'react';
import { Badge, Button, Modal } from '@/components/ui';
import { bookMoves, OPENING_BOOK, OPENING_FAMILIES, type BookOpening } from '@/data/chess/openingBook';
import { generateThematicSet } from '@/game/training/positions';
import { normalizeText } from '@/utils/text';
import { cn } from '@/utils/cn';
import { PositionBoard } from './PositionBoard';

export interface ThematicResult {
  openingId: string;
  openingName: string;
  color: 'white' | 'black';
  /** 0 to 1 */
  score: number;
}

interface Props {
  open: boolean;
  /** Changes for every session so each set of positions differs */
  seed: number;
  onFinish: (result: ThematicResult) => void;
  onClose: () => void;
}

type Step = 'pick' | 'play' | 'done';

const matches = (o: BookOpening, query: string): boolean => {
  if (!query) return true;
  const q = normalizeText(query).replace('defense', 'defence');
  return [o.name, o.eco, o.family, ...(o.aliases ?? [])].some((t) => normalizeText(t).replace('defense', 'defence').includes(q));
};

function numberedLine(moves: string[]): string {
  return moves.map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${m}` : m)).join(' ');
}

export function ThematicDialog({ open, seed, onFinish, onClose }: Props) {
  const [step, setStep] = useState<Step>('pick');
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState('all');
  const [opening, setOpening] = useState<BookOpening | null>(null);
  const [color, setColor] = useState<'white' | 'black'>('white');
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<string | null>>([]);
  const [picked, setPicked] = useState<string | null>(null);

  const list = useMemo(() => OPENING_BOOK.filter((o) => (family === 'all' || o.family === family) && matches(o, query)), [query, family]);
  const positions = useMemo(() => (opening ? generateThematicSet(opening.id, color, seed) : []), [opening, color, seed]);

  const reset = () => {
    setStep('pick');
    setIndex(0);
    setAnswers([]);
    setPicked(null);
  };
  const close = () => {
    reset();
    onClose();
  };
  const start = () => {
    if (positions.length === 0) return;
    setIndex(0);
    setAnswers([]);
    setPicked(null);
    setStep('play');
  };
  const answer = (move: string) => {
    if (picked !== null) return;
    setPicked(move);
  };
  const next = () => {
    const updated = [...answers, picked];
    setAnswers(updated);
    setPicked(null);
    if (index + 1 >= positions.length) setStep('done');
    else setIndex(index + 1);
  };

  const correctCount = answers.filter((a, i) => a !== null && a === positions[i]?.correct).length;
  const score = positions.length ? correctCount / positions.length : 0;
  const current = positions[index];

  return (
    <Modal open={open} title="Thematic Games" onClose={close} size="lg">
      {step === 'pick' && (
        <>
          <p className="mb-3 text-sm text-ink-muted">Choose an opening and the side you want to train. Positions are taken from its main line.</p>
          <fieldset className="mb-3">
            <legend className="mb-1 text-sm font-semibold text-ink">Train as</legend>
            <div className="flex gap-2">
              {(['white', 'black'] as const).map((c) => (
                <button key={c} type="button" aria-pressed={color === c} onClick={() => setColor(c)} className={cn('min-h-11 flex-1 rounded-lg border px-3 text-sm font-semibold capitalize', color === c ? 'border-gold-500 bg-gold-500/15 text-gold-300' : 'border-white/10 bg-navy-700 text-ink-muted')}>
                  {c}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <label className="col-span-2 text-sm font-semibold text-ink sm:col-span-1">
              Search
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Sicilian, B90, Ruy Lopez…" className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-navy-700 px-3 text-ink" />
            </label>
            <label className="col-span-2 text-sm font-semibold text-ink sm:col-span-1">
              Family
              <select value={family} onChange={(e) => setFamily(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-navy-700 px-3 text-ink">
                <option value="all">All openings</option>
                {OPENING_FAMILIES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ul className="max-h-64 space-y-1.5 overflow-y-auto" aria-label="Openings">
            {list.length === 0 && <li className="text-sm text-ink-muted">No opening matches.</li>}
            {list.map((o) => (
              <li key={o.id}>
                <button type="button" onClick={() => setOpening(o)} aria-pressed={opening?.id === o.id} className={cn('w-full rounded-lg border px-3 py-2 text-left', opening?.id === o.id ? 'border-gold-500 bg-gold-500/10' : 'border-white/10 bg-navy-700 hover:border-gold-500/40')}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink">{o.name}</span>
                    <Badge>{o.eco}</Badge>
                  </span>
                  <span className="block text-xs text-ink-muted">
                    {o.family} · usually played by {o.side}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {opening && <p className="mt-3 break-words text-xs text-ink-muted">Main line: {numberedLine(bookMoves(opening))}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button onClick={start} disabled={!opening || positions.length === 0}>
              Start
            </Button>
          </div>
        </>
      )}

      {step === 'play' && current && opening && (
        <>
          <p className="mb-1 text-sm text-ink-muted">
            {opening.name} · position {index + 1} of {positions.length}
          </p>
          <PositionBoard fen={current.fen} perspective={color} label={`${opening.name} position ${index + 1}`} />
          {current.played.length > 0 && <p className="mt-2 break-words text-center text-xs text-ink-muted">Moves so far: {numberedLine(current.played)}</p>}
          <p className="mb-2 mt-3 text-sm font-semibold text-ink">Which move continues the main line?</p>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Answers">
            {current.options.map((m) => {
              const isCorrect = m === current.correct;
              const chosen = picked === m;
              return (
                <button key={m} type="button" onClick={() => answer(m)} disabled={picked !== null} className={cn('min-h-12 rounded-lg border px-2 text-base font-bold', picked === null ? 'border-white/10 bg-navy-700 text-ink hover:border-gold-500/50' : isCorrect ? 'border-emerald-400 bg-emerald-500/15 text-emerald-200' : chosen ? 'border-red-400 bg-red-500/15 text-red-200' : 'border-white/5 bg-navy-700 text-ink-faint')}>
                  {m}
                </button>
              );
            })}
          </div>
          <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm text-ink-muted">
            {picked === null ? '' : picked === current.correct ? 'Correct, that is the main-line move.' : `Not quite. The main line continues ${current.correct}.`}
          </p>
          <div className="mt-3 flex justify-end">
            <Button onClick={next} disabled={picked === null}>
              {index + 1 >= positions.length ? 'Finish' : 'Next position'}
            </Button>
          </div>
        </>
      )}

      {step === 'done' && opening && (
        <>
          <p className="font-display text-2xl font-bold text-ink">
            {correctCount} of {positions.length} correct
          </p>
          <p className="mt-1 text-sm text-ink-muted">Your accuracy shapes the quality of this session and the experience you gain.</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>
              Discard
            </Button>
            <Button
              onClick={() => {
                onFinish({ openingId: opening.id, openingName: opening.name, color, score });
                reset();
              }}
            >
              Complete session
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
