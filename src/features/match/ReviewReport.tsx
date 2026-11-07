import { useState } from 'react';
import { Badge, Card, CardTitle, ProgressBar, Tabs } from '@/components/ui';
import { barPercent, formatEval } from '@/game/match/evalFormat';
import { LABEL_TEXT, betterAlternatives, countLabels, criticalMistakes, evalText, keyMoments, missedOpportunities, tacticalOpportunities } from '@/game/match/review';
import type { MatchAnalysisReport, MatchSide, MoveReview, PieceColor, ReviewLabel } from '@/types';
import { cn } from '@/utils/cn';

const ORDER: ReviewLabel[] = ['brilliant', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'missed', 'blunder'];
const TONE: Record<ReviewLabel, string> = {
  brilliant: 'text-cyan-300',
  best: 'text-emerald-300',
  excellent: 'text-emerald-300',
  good: 'text-ink',
  book: 'text-ink-muted',
  inaccuracy: 'text-amber-300',
  mistake: 'text-orange-400',
  missed: 'text-orange-300',
  blunder: 'text-red-400',
};

const moveName = (m: MoveReview): string => `${Math.floor((m.ply - 1) / 2) + 1}${m.color === 'white' ? '.' : '...'} ${m.san}`;

function EvalGraph({ report, onSelect, selected }: { report: MatchAnalysisReport; onSelect: (ply: number) => void; selected: number | null }) {
  const n = report.evals.length;
  const w = 600;
  const h = 130;
  const x = (i: number): number => (n <= 1 ? 0 : (i / (n - 1)) * w);
  const y = (cp: number, mate: number | null = null): number => h - (barPercent(cp, mate) / 100) * h;
  const line = report.evals.map((cp, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(cp, i > 0 ? report.moves[i - 1].mateAfter : null).toFixed(1)}`).join(' ');
  const marks = report.moves.filter((m) => m.label === 'blunder' || m.label === 'mistake' || m.label === 'brilliant' || m.label === 'missed');
  return (
    <figure>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label="Evaluation graph. Above the middle line White is better."
        data-testid="eval-graph"
        className="w-full cursor-pointer rounded-lg bg-charcoal-900"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          onSelect(Math.round(((e.clientX - r.left) / r.width) * (n - 1)));
        }}
      >
        <path d={`${line} L${w},${h} L0,${h} Z`} fill="#e7e5e4" opacity={0.9} />
        <line x1={0} x2={w} y1={h / 2} y2={h / 2} stroke="#68738a" strokeDasharray="4 4" />
        <path d={line} fill="none" stroke="#d4a94a" strokeWidth={1.5} />
        {marks.map((m) => (
          <circle key={m.ply} cx={x(m.ply)} cy={y(m.evalAfter, m.mateAfter)} r={4} fill={m.label === 'brilliant' ? '#22d3ee' : m.label === 'blunder' ? '#f87171' : m.label === 'mistake' ? '#fb923c' : '#fbbf24'} />
        ))}
        {selected !== null && <line x1={x(selected)} x2={x(selected)} y1={0} y2={h} stroke="#d4a94a" strokeWidth={1} />}
      </svg>
      <figcaption className="mt-1 text-xs text-ink-faint">White's point of view. Click the graph to jump to a position. Dots mark brilliant moves, missed opportunities, mistakes and blunders.</figcaption>
    </figure>
  );
}

function MomentRow({ m, text, onSelect, tag }: { m: MoveReview; text: string; onSelect: (ply: number) => void; tag?: string }) {
  return (
    <li>
      <button type="button" onClick={() => onSelect(m.ply)} className="w-full rounded-lg border border-white/[0.06] bg-navy-900 p-3 text-left hover:border-gold-500/40">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-mono font-semibold text-ink">{moveName(m)}</span>
          <span className={cn('text-sm font-semibold', TONE[m.label])}>{LABEL_TEXT[m.label]}</span>
          {tag && <Badge>{tag}</Badge>}
          <span className="ml-auto font-mono text-xs text-ink-muted">{evalText(m.evalAfter, m.mateAfter)}</span>
        </p>
        <p className="mt-1 text-sm text-ink-muted">{text}</p>
        {m.line.length > 0 && <p className="mt-1 break-words font-mono text-xs text-ink-faint">Engine line: {m.line.join(' ')}</p>}
      </button>
    </li>
  );
}

interface Props {
  report: MatchAnalysisReport;
  white: MatchSide;
  black: MatchSide;
  onSelectPly: (ply: number) => void;
  selectedPly: number | null;
}

type Tab = 'overview' | 'moves' | 'moments' | 'mistakes' | 'tactics';

/** The full report of a finished game. Every judgement comes from the engine analysis stored with it. */
export function ReviewReport({ report, white, black, onSelectPly, selectedPly }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const counts = countLabels(report);
  const moments = keyMoments(report);
  const critical = criticalMistakes(report);
  const missed = missedOpportunities(report);
  const tactics = tacticalOpportunities(report);
  const alternatives = betterAlternatives(report);

  return (
    <Card data-testid="review-report">
      <CardTitle aside={<span className="text-xs text-ink-faint">{report.engine} · depth {report.depth}</span>}>Game analysis</CardTitle>
      <Tabs
        label="Analysis sections"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'moves', label: 'Move by move' },
          { id: 'moments', label: 'Key moments' },
          { id: 'mistakes', label: 'Mistakes' },
          { id: 'tactics', label: 'Tactics' },
        ]}
      >
        {tab === 'overview' && (
          <div className="space-y-5">
            <EvalGraph report={report} onSelect={onSelectPly} selected={selectedPly} />
            <div className="grid gap-3 sm:grid-cols-2">
              {([['white', white, report.whiteAccuracy], ['black', black, report.blackAccuracy]] as Array<[PieceColor, MatchSide, number]>).map(([c, side, acc]) => (
                <div key={c} className="rounded-xl bg-navy-900 p-3">
                  <p className="text-xs text-ink-muted">{c === 'white' ? 'White' : 'Black'} · {side.name}</p>
                  <p className="font-display text-3xl font-bold text-ink" data-testid={`accuracy-${c}`}>{acc.toFixed(1)}%</p>
                  <ProgressBar value={acc} label={`${c} accuracy`} />
                </div>
              ))}
            </div>
            <p className="text-xs text-ink-faint">Accuracy is computed from the winning chances each move gave away, measured by the engine (the same method for every game and both players).</p>
            {report.opening && (
              <p className="text-sm text-ink">
                <span className="text-ink-muted">Opening: </span>
                <span className="font-semibold">{report.opening.name}</span> <Badge>{report.opening.eco}</Badge>
                <span className="text-ink-muted">
                  {' '}
                  · book for {report.opening.bookPlies} half-move{report.opening.bookPlies === 1 ? '' : 's'}
                  {report.opening.leftBookBy ? `, ${report.opening.leftBookBy === 'white' ? 'White' : 'Black'} left the book first` : ''}
                </span>
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="label-counts">
                <thead>
                  <tr className="text-left text-xs text-ink-faint">
                    <th className="py-1 pr-3 font-normal">Move quality</th>
                    <th className="px-2 font-normal">White</th>
                    <th className="px-2 font-normal">Black</th>
                  </tr>
                </thead>
                <tbody>
                  {ORDER.map((l) => (
                    <tr key={l} className="border-t border-white/[0.05]">
                      <td className={cn('py-1 pr-3', TONE[l])}>{LABEL_TEXT[l]}</td>
                      <td className="px-2 font-mono">{counts.white[l]}</td>
                      <td className="px-2 font-mono">{counts.black[l]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'moves' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="move-table">
              <thead>
                <tr className="text-left text-xs text-ink-faint">
                  <th className="py-1 pr-2 font-normal">Move</th>
                  <th className="px-2 font-normal">Quality</th>
                  <th className="px-2 font-normal">Eval</th>
                  <th className="px-2 font-normal">Lost</th>
                  <th className="px-2 font-normal">Better</th>
                </tr>
              </thead>
              <tbody>
                {report.moves.map((m) => (
                  <tr key={m.ply} onClick={() => onSelectPly(m.ply)} className={cn('cursor-pointer border-t border-white/[0.05] hover:bg-white/5', selectedPly === m.ply && 'bg-gold-500/10')}>
                    <td className="py-1 pr-2 font-mono">{moveName(m)}</td>
                    <td className={cn('px-2', TONE[m.label])}>{LABEL_TEXT[m.label]}</td>
                    <td className="px-2 font-mono">{evalText(m.evalAfter, m.mateAfter)}</td>
                    <td className="px-2 font-mono">{m.loss > 0 ? m.loss.toFixed(1) : '–'}</td>
                    <td className="px-2 font-mono">{m.bestSan && m.bestSan !== m.san && m.loss >= 5 ? m.bestSan : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'moments' && (
          <ul className="space-y-2" data-testid="key-moments">
            {moments.length === 0 && <li className="text-sm text-ink-muted">A quiet game: no move stood out.</li>}
            {moments.map((mo) => <MomentRow key={mo.review.ply} m={mo.review} text={mo.text} onSelect={onSelectPly} />)}
          </ul>
        )}

        {tab === 'mistakes' && (
          <div className="space-y-5">
            <section>
              <h3 className="mb-2 text-sm font-semibold text-ink">Critical mistakes</h3>
              <ul className="space-y-2">
                {critical.length === 0 && <li className="text-sm text-ink-muted">No move decided the game by itself.</li>}
                {critical.map((m) => <MomentRow key={m.ply} m={m} onSelect={onSelectPly} text={`Winning chances fell by ${Math.round(m.loss)} points.${m.bestSan ? ` ${m.bestSan} was better.` : ''}`} />)}
              </ul>
            </section>
            <section>
              <h3 className="mb-2 text-sm font-semibold text-ink">Missed opportunities</h3>
              <ul className="space-y-2">
                {missed.length === 0 && <li className="text-sm text-ink-muted">Nothing important was missed.</li>}
                {missed.map((m) => <MomentRow key={m.ply} m={m} onSelect={onSelectPly} text={m.forcedMate ? `A forced mate in ${m.forcedMate} was available${m.bestSan ? ` with ${m.bestSan}` : ''}.` : `${m.bestSan ?? 'A better move'} kept the advantage that this move let go.`} />)}
              </ul>
            </section>
            <section>
              <h3 className="mb-2 text-sm font-semibold text-ink">Better alternatives</h3>
              <ul className="space-y-2" data-testid="alternatives">
                {alternatives.length === 0 && <li className="text-sm text-ink-muted">Every move was close to the engine's choice.</li>}
                {alternatives.map((m) => <MomentRow key={m.ply} m={m} onSelect={onSelectPly} text={`Instead of ${m.san}, the engine preferred ${m.bestSan}.`} />)}
              </ul>
            </section>
          </div>
        )}

        {tab === 'tactics' && (
          <ul className="space-y-2" data-testid="tactics">
            {tactics.length === 0 && <li className="text-sm text-ink-muted">The position never called for one exact move.</li>}
            {tactics.map((t) => (
              <MomentRow
                key={t.review.ply}
                m={t.review}
                onSelect={onSelectPly}
                tag={t.found ? 'Found' : 'Missed'}
                text={`${t.motif}. ${t.found ? `${t.review.san} was the right idea.` : `${t.review.bestSan ?? 'The engine move'} was needed (${formatEval(t.review.evalAfter, t.review.mateAfter)} after the game move).`}`}
              />
            ))}
          </ul>
        )}
      </Tabs>
    </Card>
  );
}
