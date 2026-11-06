import { useMemo, useState, type ReactNode } from 'react';
import { Badge, Card, CardTitle, EmptyState } from '@/components/ui';
import type { OpeningDatabase } from '@/game/openings/database';
import { KNOWLEDGE_LEVELS, buildOpeningPerformance, collectOpeningGames, gameInOpening, type OpeningGameRef, type OpeningPerf, type SourceKind } from '@/game/openings/stats';
import { useSave } from '@/hooks/useGame';
import { cn } from '@/utils/cn';

/* Colours: one blue/gray/orange triple for win/draw/loss (distinguishable without red-green), one gold for magnitude. */
const C = { win: '#3987e5', draw: '#97a2b8', loss: '#d95926', gold: '#e5c166', grid: 'rgba(255,255,255,0.08)', text: '#97a2b8' };

const SOURCES: Array<{ id: 'all' | SourceKind; label: string }> = [
  { id: 'all', label: 'All games' },
  { id: 'rated', label: 'Rated career' },
  { id: 'training', label: 'Training' },
  { id: 'blitz', label: 'Online blitz' },
  { id: 'engine', label: 'Engine' },
];

type SortKey = 'name' | 'games' | 'wins' | 'draws' | 'losses' | 'winRate' | 'avgAccuracy' | 'avgOpponentElo' | 'knowledge';

const scoreOf = (list: OpeningGameRef[]): number => (list.length ? (list.reduce((s, r) => s + (r.outcome === 'win' ? 1 : r.outcome === 'draw' ? 0.5 : 0), 0) / list.length) * 100 : 0);

function Legend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />{i.label}</li>
      ))}
    </ul>
  );
}

/** Readout line used as the hover/focus tooltip for every chart */
function Readout({ text }: { text: string | null }) {
  return <p aria-live="polite" className="mb-1 min-h-5 text-xs text-gold-300">{text ?? 'Tap, hover or focus a chart for details.'}</p>;
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-navy-800 p-4">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

function ChartCard({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <Card>
      <CardTitle aside={aside}>{title}</CardTitle>
      <div role="region" aria-label={`${title} chart`} tabIndex={0} className="overflow-x-auto">{children}</div>
    </Card>
  );
}

/** Win / draw / loss as stacked horizontal bars, one row per opening */
function ResultsChart({ rows }: { rows: OpeningPerf[] }) {
  const [tip, setTip] = useState<string | null>(null);
  const top = rows.slice(0, 10);
  const max = Math.max(...top.map((r) => r.games), 1);
  const rowH = 34;
  return (
    <>
      <Legend items={[{ label: 'Wins', color: C.win }, { label: 'Draws', color: C.draw }, { label: 'Losses', color: C.loss }]} />
      <Readout text={tip} />
      <svg viewBox={`0 0 600 ${top.length * rowH + 4}`} role="img" aria-label={`Results for your ${top.length} most played openings. ${top.map((r) => `${r.key}: ${r.wins} wins, ${r.draws} draws, ${r.losses} losses`).join('; ')}.`} className="w-full min-w-[30rem]">
        {top.map((r, i) => {
          const y = i * rowH + 4;
          const scale = 340 / max;
          let x = 200;
          const segs = [['wins', r.wins, C.win], ['draws', r.draws, C.draw], ['losses', r.losses, C.loss]] as const;
          return (
            <g key={r.key} tabIndex={0} onClick={() => setTip(`${r.key}: ${r.wins} wins, ${r.draws} draws, ${r.losses} losses (${r.winRate}% wins)`)} onMouseEnter={() => setTip(`${r.key}: ${r.wins} wins, ${r.draws} draws, ${r.losses} losses (${r.winRate}% wins)`)} onFocus={() => setTip(`${r.key}: ${r.wins} wins, ${r.draws} draws, ${r.losses} losses (${r.winRate}% wins)`)} onMouseLeave={() => setTip(null)} onBlur={() => setTip(null)} className="outline-none focus-visible:opacity-90">
              <rect x="0" y={y - 2} width="600" height={rowH - 4} fill="transparent" />
              <text x="192" y={y + 15} textAnchor="end" fontSize="16" fill="#e8ebf2">{r.key.length > 19 ? `${r.key.slice(0, 18)}…` : r.key}</text>
              {segs.map(([name, n, color]) => {
                if (n === 0) return null;
                const w = n * scale;
                const rect = <rect key={name} x={x} y={y + 2} width={Math.max(2, w - 2)} height="20" rx="3" fill={color} />;
                x += w;
                return rect;
              })}
              <text x={x + 6} y={y + 15} fontSize="14" fill={C.text}>{r.games}</text>
            </g>
          );
        })}
      </svg>
    </>
  );
}

/** Average accuracy per opening as a dot plot */
function AccuracyChart({ rows }: { rows: OpeningPerf[] }) {
  const [tip, setTip] = useState<string | null>(null);
  const list = rows.filter((r) => r.avgAccuracy !== null).slice(0, 10);
  if (list.length === 0) return <p className="text-sm text-ink-muted">Accuracy is measured when a played game has been analysed. Finish a practice game to see it here.</p>;
  const rowH = 32;
  const x = (v: number): number => 200 + ((Math.max(40, Math.min(100, v)) - 40) / 60) * 370;
  return (
    <>
      <Readout text={tip} />
      <svg viewBox={`0 0 600 ${list.length * rowH + 30}`} role="img" aria-label={`Average accuracy: ${list.map((r) => `${r.key} ${Math.round(r.avgAccuracy!)}%`).join(', ')}.`} className="w-full min-w-[30rem]">
        {[40, 60, 80, 100].map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1="0" y2={list.length * rowH} stroke={C.grid} />
            <text x={x(t)} y={list.length * rowH + 20} textAnchor="middle" fontSize="14" fill={C.text}>{t}%</text>
          </g>
        ))}
        {list.map((r, i) => {
          const cy = i * rowH + 16;
          const text = `${r.key}: ${r.avgAccuracy}% average accuracy over ${r.accuracyGames} analysed game${r.accuracyGames === 1 ? '' : 's'}`;
          return (
            <g key={r.key} tabIndex={0} onClick={() => setTip(text)} onMouseEnter={() => setTip(text)} onFocus={() => setTip(text)} onMouseLeave={() => setTip(null)} onBlur={() => setTip(null)} className="outline-none">
              <line x1="200" x2={x(r.avgAccuracy!)} y1={cy} y2={cy} stroke={C.gold} strokeOpacity="0.35" strokeWidth="2" />
              <text x="192" y={cy + 5} textAnchor="end" fontSize="16" fill="#e8ebf2">{r.key.length > 19 ? `${r.key.slice(0, 18)}…` : r.key}</text>
              <circle cx={x(r.avgAccuracy!)} cy={cy} r="6" fill={C.gold} stroke="#111a2e" strokeWidth="2" />
              <circle cx={x(r.avgAccuracy!)} cy={cy} r="14" fill="transparent" />
            </g>
          );
        })}
      </svg>
    </>
  );
}

/** Vertical columns with a value label on top */
function Columns({ data, label, format = (v: number) => String(v) }: { data: Array<{ key: string; value: number; note?: string }>; label: string; format?: (v: number) => string }) {
  const [tip, setTip] = useState<string | null>(null);
  const max = Math.max(...data.map((d) => d.value), 1);
  const w = 600 / data.length;
  return (
    <>
      <Readout text={tip} />
      <svg viewBox="0 0 600 180" role="img" aria-label={`${label}: ${data.map((d) => `${d.key} ${format(d.value)}`).join(', ')}.`} className="w-full min-w-[30rem]">
        <line x1="0" x2="600" y1="130" y2="130" stroke={C.grid} />
        {data.map((d, i) => {
          const h = (d.value / max) * 100;
          const text = `${d.key}: ${format(d.value)}${d.note ? ` · ${d.note}` : ''}`;
          return (
            <g key={d.key} tabIndex={0} onClick={() => setTip(text)} onMouseEnter={() => setTip(text)} onFocus={() => setTip(text)} onMouseLeave={() => setTip(null)} onBlur={() => setTip(null)} className="outline-none">
              <rect x={i * w} y="0" width={w} height="170" fill="transparent" />
              {d.value > 0 && <rect x={i * w + w * 0.18} y={130 - h} width={w * 0.64} height={h} rx="4" fill={C.gold} fillOpacity={0.35 + 0.65 * (d.value / max)} />}
              <text x={i * w + w / 2} y={125 - h} textAnchor="middle" fontSize="14" fill="#e8ebf2">{format(d.value)}</text>
              <text x={i * w + w / 2} y="156" textAnchor="middle" fontSize="14" fill={C.text}>{d.key.length > 9 ? `${d.key.slice(0, 8)}…` : d.key}</text>
            </g>
          );
        })}
      </svg>
    </>
  );
}

/** Rolling score over time */
function TrendChart({ refs }: { refs: OpeningGameRef[] }) {
  const [tip, setTip] = useState<string | null>(null);
  const ordered = [...refs].sort((a, b) => a.year * 100 + a.week - (b.year * 100 + b.week));
  const win = Math.min(10, Math.max(3, Math.floor(ordered.length / 3)));
  if (ordered.length < 6) return <p className="text-sm text-ink-muted">Play at least six games to see your trend.</p>;
  const pts = ordered.map((_, i) => (i + 1 < win ? null : scoreOf(ordered.slice(i + 1 - win, i + 1)))).map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  const x = (i: number): number => 30 + (i / (ordered.length - 1)) * 560;
  const y = (v: number): number => 10 + (1 - v / 100) * 110;
  const path = pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  return (
    <>
      <Readout text={tip} />
      <svg viewBox="0 0 600 150" role="img" aria-label={`Score over time, rolling ${win} games, from ${Math.round(pts[0].v)}% to ${Math.round(pts[pts.length - 1].v)}%.`} className="w-full min-w-[30rem]">
        {[0, 50, 100].map((t) => (
          <g key={t}>
            <line x1="30" x2="590" y1={y(t)} y2={y(t)} stroke={C.grid} strokeDasharray={t === 50 ? '4 4' : undefined} />
            <text x="24" y={y(t) + 4} textAnchor="end" fontSize="13" fill={C.text}>{t}%</text>
          </g>
        ))}
        <path d={path} fill="none" stroke={C.gold} strokeWidth="2" strokeLinejoin="round" />
        {pts.map((p) => {
          const text = `After game ${p.i + 1}: ${Math.round(p.v)}% score over the last ${win} games`;
          return <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r="8" fill="transparent" tabIndex={0} onClick={() => setTip(text)} onMouseEnter={() => setTip(text)} onFocus={() => setTip(text)} onMouseLeave={() => setTip(null)} onBlur={() => setTip(null)} className="outline-none" />;
        })}
        <circle cx={x(pts[pts.length - 1].i)} cy={y(pts[pts.length - 1].v)} r="4" fill={C.gold} stroke="#111a2e" strokeWidth="2" />
        <text x="30" y="142" fontSize="13" fill={C.text}>Game 1</text>
        <text x="590" y="142" textAnchor="end" fontSize="13" fill={C.text}>Game {ordered.length}</text>
      </svg>
    </>
  );
}

export function Performance({ db }: { db: OpeningDatabase }) {
  const save = useSave();
  const [source, setSource] = useState<'all' | SourceKind>('all');
  const [simulated, setSimulated] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'games', dir: -1 });

  const all = useMemo(() => collectOpeningGames(save, db), [save, db]);
  const refs = useMemo(() => all.filter((r) => (source === 'all' || r.source === source) && (simulated || !r.simulated)), [all, source, simulated]);
  const rows = useMemo(() => buildOpeningPerformance(save, db, refs, simulated), [save, db, refs, simulated]);

  const sorted = useMemo(() => {
    const get = (r: OpeningPerf): number | string => (sort.key === 'name' ? r.key : sort.key === 'knowledge' ? r.knowledge.points : (r[sort.key] ?? -1));
    return [...rows].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      return (typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number)) * sort.dir || a.key.localeCompare(b.key);
    });
  }, [rows, sort]);

  const byGames = useMemo(() => [...rows].sort((a, b) => b.games - a.games), [rows]);
  const total = refs.length;
  const wins = refs.filter((r) => r.outcome === 'win').length;
  const accs = refs.filter((r) => r.accuracy !== null);
  const avgAcc = accs.length ? accs.reduce((s, r) => s + r.accuracy!, 0) / accs.length : null;

  const white = refs.filter((r) => r.color === 'white');
  const black = refs.filter((r) => r.color === 'black');
  const eco = ['A', 'B', 'C', 'D', 'E'].map((l) => ({ key: `ECO ${l}`, value: refs.filter((r) => r.entry?.eco[0] === l).length }));
  const levels = KNOWLEDGE_LEVELS.map((l, i) => ({ key: l.label, value: rows.filter((r) => r.knowledge.level === i).length }));

  const prefIds = new Set(Object.values(save.repertoire.preferences).flat());
  const prefEntries = [...prefIds].map((id) => db.byId.get(id)).filter((e): e is NonNullable<typeof e> => !!e);
  const prefStats = prefEntries.map((e) => ({ e, n: refs.filter((r) => gameInOpening(db, r, e)).length }));
  const playedPref = prefStats.filter((p) => p.n > 0).length;
  const prefGames = prefStats.reduce((s, p) => s + p.n, 0);

  const head = (key: SortKey, label: string) => (
    <th scope="col" aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} className="px-2 py-2 text-left font-semibold">
      <button type="button" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === 'name' ? 1 : -1 }))} className="hover:text-gold-300">
        {label}{sort.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  );

  return (
    <>
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Game source">
          {SOURCES.map((s) => (
            <button key={s.id} type="button" aria-pressed={source === s.id} onClick={() => setSource(s.id)} className={cn('min-h-11 rounded-lg border px-3 text-sm font-semibold', source === s.id ? 'border-gold-500 bg-gold-500/10 text-gold-300' : 'border-white/10 text-ink-muted hover:text-ink')}>{s.label}</button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-sm text-ink-muted"><input type="checkbox" className="accent-gold-500" checked={simulated} onChange={(e) => setSimulated(e.target.checked)} />Include simulated games</label>
        </div>
      </Card>

      {total === 0 ? (
        <Card><EmptyState title="No opening statistics yet" description="Statistics are counted from the games you really play: rated career games and the practice games on the Games tab. Play a game to start the dashboard." /></Card>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Games with an opening" value={String(total)} hint={`${rows.length} ${rows.length === 1 ? 'opening' : 'openings'}`} />
            <Kpi label="Win rate" value={`${Math.round((wins / total) * 100)}%`} hint={`score ${Math.round(scoreOf(refs))}%`} />
            <Kpi label="Average accuracy" value={avgAcc === null ? '–' : `${Math.round(avgAcc)}%`} hint={`${accs.length} analysed games`} />
            <Kpi label="Preferred openings played" value={prefEntries.length ? `${playedPref}/${prefEntries.length}` : '–'} hint={prefEntries.length ? `${prefGames} games in them` : 'None chosen yet'} />
          </div>

          <p className="mb-3 text-xs text-ink-muted">Scroll charts and the table sideways for full detail on smaller screens.</p>
          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <ChartCard title="Results by opening"><ResultsChart rows={byGames} /></ChartCard>
            <ChartCard title="Accuracy by opening"><AccuracyChart rows={[...byGames]} /></ChartCard>
            <ChartCard title="White and Black">
              <Columns label="Score as White and as Black" format={(v) => `${Math.round(v)}%`} data={[{ key: 'As White', value: scoreOf(white), note: `${white.length} games` }, { key: 'As Black', value: scoreOf(black), note: `${black.length} games` }]} />
            </ChartCard>
            <ChartCard title="Games by ECO volume"><Columns label="Games by ECO volume" data={eco.map((e) => ({ ...e, note: { 'ECO A': 'flank and irregular', 'ECO B': 'semi-open: Sicilian, French…', 'ECO C': 'open games and the French', 'ECO D': 'closed games and semi-closed', 'ECO E': 'Indian defences' }[e.key] }))} /></ChartCard>
            <ChartCard title="Score over time"><TrendChart refs={refs} /></ChartCard>
            <ChartCard title="Opening knowledge"><Columns label="Openings at each knowledge level" data={levels} /></ChartCard>
          </div>

          <Card className="mb-4">
            <CardTitle aside={<Badge>{prefEntries.length} preferred</Badge>}>Preferred openings: chosen versus played</CardTitle>
            {prefStats.length === 0 ? (
              <p className="text-sm text-ink-muted">Choose openings in the Preferences tab to compare them with what you actually play.</p>
            ) : (
              <ul className="space-y-1.5">
                {prefStats.sort((a, b) => b.n - a.n).map(({ e, n }) => (
                  <li key={e.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-sm sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_6rem]">
                    <span className="min-w-0 truncate text-ink">{e.name}</span>
                    <span role="img" aria-label={`${n} games`} className="order-3 col-span-2 h-3 rounded-full bg-navy-600 sm:order-none sm:col-span-1"><span className="block h-3 rounded-full" style={{ width: `${(n / Math.max(...prefStats.map((p) => p.n), 1)) * 100}%`, background: C.gold }} /></span>
                    <span className="text-right text-xs text-ink-muted">{n === 0 ? 'never played' : `${n} game${n === 1 ? '' : 's'}`}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      <Card>
        <CardTitle>All openings you have played</CardTitle>
        {sorted.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing to show for this filter.</p>
        ) : (
          <div role="region" aria-label="Opening performance table" tabIndex={0} className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm text-ink">
              <caption className="sr-only">Performance of every opening you have played</caption>
              <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-ink-muted">
                <tr>{head('name', 'Opening')}{head('games', 'Games')}{head('wins', 'W')}{head('draws', 'D')}{head('losses', 'L')}{head('winRate', 'Win rate')}{head('avgAccuracy', 'Accuracy')}{head('avgOpponentElo', 'Opp. Elo')}<th scope="col" className="px-2 py-2 text-left font-semibold">Most common variation</th>{head('knowledge', 'Knowledge')}</tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sorted.map((r) => (
                  <tr key={r.key}>
                    <th scope="row" className="px-2 py-2 text-left font-semibold"><span className="block">{r.key}</span><span className="block text-xs font-normal text-ink-faint">{r.eco}</span></th>
                    <td className="px-2 py-2 tabular-nums">{r.games}</td>
                    <td className="px-2 py-2 tabular-nums">{r.wins}</td>
                    <td className="px-2 py-2 tabular-nums">{r.draws}</td>
                    <td className="px-2 py-2 tabular-nums">{r.losses}</td>
                    <td className="px-2 py-2 tabular-nums">{r.winRate}%</td>
                    <td className="px-2 py-2 tabular-nums">{r.avgAccuracy === null ? '–' : `${r.avgAccuracy}%`}</td>
                    <td className="px-2 py-2 tabular-nums">{r.avgOpponentElo}</td>
                    <td className="px-2 py-2 text-xs text-ink-muted">{r.mostCommonVariation ? `${r.mostCommonVariation.name} (${r.mostCommonVariation.games})` : '–'}</td>
                    <td className="px-2 py-2"><span className="font-semibold">{r.knowledge.label}</span><span className="block text-xs text-ink-faint">{r.knowledge.points}{r.knowledge.next ? ` / ${r.knowledge.next}` : ''} pts</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-ink-faint">Win rate is wins divided by games. Accuracy comes from the engine analysis of games you played. Knowledge grows with games played, accuracy, the variations you have met and Thematic Games study.</p>
      </Card>
    </>
  );
}
