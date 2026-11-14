import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { Button, Modal } from '@/components/ui';
import { useSave } from '@/hooks/useGame';
import { useNpcs } from '@/hooks/useNpcs';
import { getCountry } from '@/data/world/countries';
import { randomAppearance } from '@/data/appearance';
import { createRng } from '@/game/rng';
import { hashString } from '@/utils/format';
import { renderPortraitSvg } from '@/game/appearance/portraitSvg';
import { tournamentSpotlight } from '@/game/competition/spotlight';
import { circuitAdvancement } from '@/game/competition/qualificationCircuit';
import { predictMatch, displayPercentages } from '@/game/prediction/model';
import { npcActor, conditionsFor } from '@/game/prediction/adapters';
import { translateUI as t } from '@/i18n/translate';
import { useContext } from 'react';
import { LanguageContext } from '@/i18n/context';
import type { ScheduledEvent } from '@/game/world/schedule';
import type { Npc } from '@/types';
import { GameAtlas } from './GameAtlas';
import { normalizeText } from '@/utils/text';
type VenueCity = [string, number, number, number];
let cityData: Promise<Record<string,VenueCity[]>> | undefined;
const loadCities = (): Promise<Record<string,VenueCity[]>> => cityData ??= fetch(`${import.meta.env.BASE_URL}data/venue-cities.json`).then(r=>{if(!r.ok)throw new Error('city data');return r.json();}).catch(()=>{cityData=undefined;return {} as Record<string,VenueCity[]>;});
const xml = (s: string) => s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
const short = (s: string, max=34) => s.length>max?s.slice(0,max-1)+'…':s;
function portrait(npc: Npc) { return renderPortraitSvg(randomAppearance(createRng(hashString(npc.id)).next,npc.gender),npc.name).replace('width="100%" height="100%"','width="200" height="200"'); }
function poster(event: ScheduledEvent, favorites: Npc[], slide: number) {
  const c=event.details?.qualificationCircuit;
  const title = slide===0?t('Players to watch'):slide===1?t(event.details?.format==='knockout'?'Possible final pairing':'Potential title showdown'):t(c?'Road to the World Finals':'Meet the host city');
  const faces=favorites.slice(0,slide===0?3:2).map((n,i)=>`<g transform="translate(${slide===0?96+i*250:170+i*340},155) scale(.86)">${portrait(n)}</g><text x="${slide===0?182+i*250:256+i*340}" y="364" text-anchor="middle" font-size="20" fill="#f0f4e8">${xml(short(n.name,23))}</text><text x="${slide===0?182+i*250:256+i*340}" y="393" text-anchor="middle" font-size="17" fill="#bbcf9d">${n.currentElo} Elo · ${xml(n.title)}</text>`).join('');
  const body=slide===2?`<text x="450" y="220" text-anchor="middle" font-size="28" fill="#e8c977">${xml(short(c?.sponsor??event.details?.location??'',43))}</text><text x="450" y="275" text-anchor="middle" font-size="25" fill="#eff4e9">${xml(short(c?.worldFinalName??getCountry(event.details?.country??'')?.name??'',49))}</text><text x="450" y="330" text-anchor="middle" font-size="19" fill="#bdc9b7">${xml(short(circuitAdvancement(event.details),66))}</text>`:faces;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="470" viewBox="0 0 900 470"><defs><linearGradient id="promo-bg" x2="1" y2="1"><stop stop-color="#183d32"/><stop offset="1" stop-color="#101e1d"/></linearGradient><pattern id="board" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M0 0h40v40H0zM40 40h40v40H40z" fill="#fff" opacity=".025"/></pattern></defs><rect width="900" height="470" rx="26" fill="url(#promo-bg)"/><rect width="900" height="470" rx="26" fill="url(#board)"/><path d="M42 114h816M42 431h816" stroke="#c5ad65" opacity=".4"/><text x="44" y="42" font-family="sans-serif" font-size="15" fill="#bbcf9d">${xml(short(c?.sponsor??event.details?.organizer?.name??t('Career tournament'),80))}</text><text x="44" y="84" font-family="sans-serif" font-weight="bold" font-size="31" fill="#f1e9d0">${xml(title)}</text><g font-family="sans-serif">${body}</g><text x="44" y="456" font-family="sans-serif" font-size="14" fill="#aebca9">${xml(short(event.name,100))}</text></svg>`)}`;
}
export function TournamentSpotlight({ event }: { event: ScheduledEvent }) {
  const save=useSave(), npcs=useNpcs(), language=useContext(LanguageContext), reduced=useReducedMotion();
  const spotlight=useMemo(()=>tournamentSpotlight(save,event,npcs),[save,event,npcs]);
  const [slide,setSlide]=useState(0), [playing,setPlaying]=useState(true), [hover,setHover]=useState(false), [focus,setFocus]=useState(false);
  const [cities,setCities]=useState<VenueCity[]>([]), [chosen,setChosen]=useState<VenueCity|null>(null), [loaded,setLoaded]=useState(false);
  const cityPanel=useRef<HTMLDivElement>(null), circuit=event.details?.qualificationCircuit;
  useEffect(()=>{let current=true;setCities([]);setChosen(null);setLoaded(false);loadCities().then(data=>{if(!current)return;const rows=data[event.details?.country??'']??[];setCities(rows);setChosen(rows.find(r=>normalizeText(r[0])===normalizeText(event.details?.location??''))??null);setLoaded(true);});return()=>{current=false;};},[event.id,event.details?.country,event.details?.location]);
  useEffect(()=>{if(!playing||reduced||hover||focus)return;const timer=setInterval(()=>{if(document.visibilityState==='visible')setSlide(s=>(s+1)%3);},6500);return()=>clearInterval(timer);},[playing,reduced,hover,focus]);
  const image=useMemo(()=>poster(event,spotlight.favorites,slide),[event,spotlight.favorites,slide,language]);
  const duel=useMemo(()=>spotlight.favorites.length>=2?predictMatch({player:npcActor(spotlight.favorites[0]),opponent:npcActor(spotlight.favorites[1]),conditions:conditionsFor(event.details?.timeControl.category??'classical','unknown',event.details?.category),id:`promo:${event.id}`,stamp:{...save.world.date,day:save.world.day}}):undefined,[spotlight.favorites,event,save.world.date,save.world.day]);
  const host=getCountry(event.details?.country??'');
  const selectCity=(city:VenueCity)=>{setChosen(city);requestAnimationFrame(()=>cityPanel.current?.scrollIntoView({behavior:reduced?'auto':'smooth',block:'nearest'}));};
  const hostCity=cities.find(r=>normalizeText(r[0])===normalizeText(event.details?.location??''))??null;
  return <div className="space-y-4" data-testid="tournament-spotlight">
    <div role="region" aria-label={t('Tournament promotion')} className="overflow-hidden rounded-2xl border border-white/10 bg-navy-900" onPointerEnter={()=>setHover(true)} onPointerLeave={()=>setHover(false)} onFocusCapture={()=>setFocus(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setFocus(false);}}>
      <img src={image} alt={t(slide===0?'Players to watch':slide===1?'Potential title showdown':'Road to the World Finals')} className="aspect-[900/470] w-full object-contain" data-testid="tournament-promo-image"/>
      <div className="flex flex-wrap items-center justify-between gap-2 p-3"><div className="flex gap-2"><Button variant="secondary" aria-label={t('Previous promotion')} onClick={()=>setSlide((slide+2)%3)}>←</Button><Button variant="secondary" aria-label={t('Next promotion')} onClick={()=>setSlide((slide+1)%3)}>→</Button><Button variant="secondary" aria-pressed={playing&&!reduced} disabled={!!reduced} onClick={()=>setPlaying(!playing)}>{playing&&!reduced?'Pause slideshow':'Play slideshow'}</Button></div><span className="text-xs text-ink-muted">{slide+1} / 3</span></div>
    </div>
    <p className="text-xs text-ink-muted">{spotlight.projected?'Projected field · entries may change.':'Spotlight uses the currently announced entrants.'} <span>Career portraits. Promotional matchups are projections, not confirmed pairings.</span></p>
    {slide===1 && duel && <p className="text-sm text-gold-300"><span translate="no">{duel.player.name} — {duel.opponent.name}</span><br/><span>Projected duel W / D / L</span>: {displayPercentages(duel.adjusted).map(n=>`${n.toFixed(1)}%`).join(' / ')}</p>}
    {!spotlight.favorites.length && <p className="text-sm text-ink-muted">No individual field announced yet.</p>}
    <div className="grid grid-cols-2 gap-2">{spotlight.favorites.map(n=><div key={n.id} className="min-w-0 rounded-xl bg-navy-900 p-3"><p className="break-words text-sm font-semibold" translate="no">{n.name}</p><p className="mt-1 text-xs text-gold-300">{n.currentElo} Elo · {n.title}</p><p className="mt-1 text-xs text-ink-muted">{t(n.style)} · <span>Current form</span> {n.form.toFixed(0)}</p></div>)}</div>
    {circuit && <div className="rounded-xl border border-gold-500/20 p-4 text-sm" data-testid="sponsor-route"><p className="text-xs text-ink-muted">Sponsor</p><p className="font-semibold" translate="no">{circuit.sponsor??'Career Qualification Circuit'}</p><p className="mt-2 text-gold-300" translate="no">{circuit.worldFinalName??'World Qualification Finals'}</p><p className="mt-2">{circuitAdvancement(event.details)}</p></div>}
    {event.details?.host?.mode === "online" ? <p className="text-sm text-ink-muted">Online event · no physical host city</p> : <div className="rounded-xl border border-white/10 p-4" ref={cityPanel} data-testid="host-city-map">
      <h3 className="font-semibold">Host city & map</h3><p className="mt-1 text-sm" translate="no">{event.details?.location} · {host?.name}</p>
      <GameAtlas country={event.details?.country??''} cities={cities} selected={chosen} host={hostCity} onSelect={selectCity}/>
      {chosen && <div className="mt-3 rounded-xl bg-navy-900 p-3 text-sm" data-testid="selected-city-info"><p className="font-semibold" translate="no">{chosen[0]}</p><p className="mt-1 text-xs text-ink-muted" translate="no">{chosen[3].toFixed(4)}, {chosen[2].toFixed(4)}</p><p className="mt-1 text-xs text-ink-muted"><span>Population in city dataset</span>: {chosen[1].toLocaleString()} · GeoNames</p></div>}
      {loaded && !chosen && <p className="mt-3 text-xs text-ink-muted">Host city coordinates not recorded; choose a listed city.</p>}
      <p className="mt-2 text-xs text-ink-faint">The game draws this atlas locally. No external map service is required.</p>
    </div>}
  </div>;
}
export function TournamentSpotlightDialog({event,onClose}:{event:ScheduledEvent;onClose:()=>void}) {
  return <Modal open title="Tournament spotlight & host city" onClose={onClose} size="lg"><TournamentSpotlight key={event.id} event={event}/></Modal>;
}
