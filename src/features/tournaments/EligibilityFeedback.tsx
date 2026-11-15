import { Link } from 'react-router-dom';
import { useSave } from '@/hooks/useGame';
import { useNpcs } from '@/hooks/useNpcs';
import { eligibilityFeedback } from '@/game/competition/eligibility';
import type {ScheduledEvent} from '@/game/world/schedule';
export function EligibilityFeedback({event}:{event:ScheduledEvent}) {
 const save=useSave(),npcs=useNpcs(),feedback=eligibilityFeedback(save,event,npcs);
 if(!feedback.length)return null;
 return <ul className="my-3 space-y-2 rounded-xl bg-navy-800/70 p-3 text-xs" data-testid="eligibility-feedback">{feedback.map((f,i)=><li key={i} className="flex flex-wrap items-center justify-between gap-2"><span className="text-ink-muted">{f.text}</span>{f.to&&<Link className="min-h-8 py-1 text-gold-300 underline underline-offset-4" to={f.to}>{f.action}</Link>}</li>)}</ul>;
}
