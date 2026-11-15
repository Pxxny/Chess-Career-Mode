import type { OpeningPerf } from '@/game/openings/stats';
export function MasteryBadge({perf}:{perf?:OpeningPerf}) {
 const weak=!!perf&&perf.games>=3&&perf.score<40, strong=!!perf&&perf.knowledge.level>=4&&perf.score>=55;
 const color=weak?'border-orange-400/40 bg-orange-500/10 text-orange-400':strong?'border-emerald-500/40 bg-emerald-500/10 text-emerald-300':perf?'border-gold-500/20 bg-gold-500/10 text-gold-300':'border-white/10 text-ink-faint';
 return <span data-testid="mastery-badge" data-mastery={weak?'practice':strong?'strong':perf?'learning':'new'} className={`inline-flex max-w-full flex-wrap gap-1 rounded-md border px-1.5 py-0.5 text-[10px] ${color}`}><span>{weak?'Needs practice':strong?'Ready':perf?.knowledge.label??'Unfamiliar'}</span>{!!perf?.games&&<span>· {perf.winRate}% W · {perf.games} games</span>}</span>;
}
