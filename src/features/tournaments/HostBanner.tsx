import { getCountry } from '@/data/world/countries';
import { venueCity } from '@/game/competition/travel';
import type {ScheduledEvent} from '@/game/world/schedule';
export function HostBanner({event}:{event:ScheduledEvent}) {
 const d=event.details,country=getCountry(d?.country??''),city=venueCity(d?.country??'',d?.location??''),online=d?.host?.mode==='online';
 const prestige=event.level==='elite'?'World stage':event.level==='international'?'International arena':event.level==='national'?'National stage':'Community venue';
 return <div className="host-banner relative mb-4 overflow-hidden rounded-2xl border border-white/10 p-4 sm:p-5" data-testid="host-banner"><span aria-hidden className="absolute -right-3 -top-7 text-[7rem] opacity-[.07]">♜</span><p className="text-xs font-semibold uppercase tracking-widest text-gold-300">{online?'Online tournament':prestige}</p><p className="mt-2 text-lg font-bold" translate="no">{online?'Online':`${country?.flag??''} ${d?.location??country?.name??'Local venue'}`}</p>{!online&&<p className="mt-1 text-sm text-ink-muted" translate="no">{country?.name}{city?` · ${Math.round(city[1]/1000).toLocaleString()}k residents · ${city[3].toFixed(2)}°, ${city[2].toFixed(2)}°`:''}</p>}</div>;
}
