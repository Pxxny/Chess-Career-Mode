import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { getCountry } from '@/data/world/countries';
import { translateUI as t } from '@/i18n/translate';
import { hashString } from '@/utils/format';
import { ATLAS_WIDTH as W, ATLAS_HEIGHT as BASE_H, atlasLine, atlasPolygon, cityCallouts, countryCamera, generateCityDistrict, mercatorY, panCamera, polygonBounds, screenPoint, worldCamera, zoomCamera, type AtlasCity, type AtlasData, type Camera } from '@/game/world/gameAtlas';
let atlasPromise:Promise<AtlasData>|undefined;
const loadAtlas=()=>atlasPromise??=fetch(`${import.meta.env.BASE_URL}data/game-atlas.json`).then(r=>{if(!r.ok)throw new Error('atlas');return r.json();}).then((data:AtlasData)=>{if(data.version!==1||!Array.isArray(data.countries)||!data.countries.length)throw new Error('atlas');return data;}).catch(error=>{atlasPromise=undefined;throw error;});
function CityDistrict({city,country,onVenue}:{city:AtlasCity;country:string;onVenue:()=>void}) {
  const scene=useMemo(()=>generateCityDistrict(city,country),[city,country]);
  return <g data-testid="generated-city-scene">
    <rect width={W} height={BASE_H} fill="#52694a"/>
    {[0,1,2,3,4,5,6].map(i=><path key={`street-y${i}`} d={`M0 ${17+i*65}H720`} stroke="#25392d" strokeWidth="15"/>)}
    {Array.from({length:12},(_,i)=><path key={`street-x${i}`} d={`M${17+i*62} 0V440`} stroke="#25392d" strokeWidth="12"/>)}
    <path d="M-20 82Q240 76 380 84T750 82M-10 342Q220 334 390 344T750 342" fill="none" stroke="#b8b195" strokeWidth="21"/>
    <path d="M-20 82Q240 76 380 84T750 82M-10 342Q220 334 390 344T750 342" fill="none" stroke="#ead9ac" strokeWidth="12"/>
    <path d="M-20 82Q240 76 380 84T750 82M-10 342Q220 334 390 344T750 342" fill="none" stroke="#9e936d" strokeDasharray="7 9" strokeWidth="1"/>
    {scene.parks.map(({x,y},i)=><g key={`park${i}`}><rect x={x-3} y={y-3} width="53" height="54" rx="12" fill="#71926a"/>{[0,1,2,3].map(n=><g key={n}><ellipse cx={x+8+n%2*23} cy={y+14+Math.floor(n/2)*22} rx="9" ry="7" fill="#354f38"/><circle cx={x+8+n%2*23} cy={y+10+Math.floor(n/2)*22} r="8" fill="#8eaa79"/></g>)}</g>)}
    {scene.buildings.map((b,i)=><g key={`building${i}`}><rect x={b.x+3} y={b.y+6} width={b.width} height={b.height} rx="3" fill="#283e32" opacity=".5"/><rect x={b.x} y={b.y} width={b.width} height={b.height} rx="3" fill={['#c1b397','#b5b7a0','#909d8c','#d0c3a6'][b.tone]}/><path d={`M${b.x+5} ${b.y+7}h${b.width-10}M${b.x+5} ${b.y+15}h${b.width-10}`} stroke="#e6dfc9" strokeOpacity=".5" strokeWidth="2"/></g>)}
    <g role="button" tabIndex={0} aria-label={t('Tournament venue · game district')} onClick={onVenue} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onVenue();}}} className="cursor-pointer">
      <rect x="279" y="165" width="159" height="125" rx="18" fill="#172f26" stroke="#d9bb70" strokeWidth="3"/>
      <path d="M297 183h123v86H297z" fill="#9cae7b"/><path d="M297 183h31v22h-31zm62 0h31v22h-31zm-31 22h31v22h-31zm62 0h30v22h-30zm-93 22h31v22h-31zm62 0h31v22h-31zm-31 22h31v20h-31zm62 0h30v20h-30z" fill="#567250"/>
      <circle cx="359" cy="210" r="29" fill="#e8c879" stroke="#1d3527" strokeWidth="3"/><text x="359" y="222" textAnchor="middle" fontSize="36" fill="#1c3628" pointerEvents="none">♜</text>
      <rect x="265" y="290" width="188" height="33" rx="12" fill="#142c23"/><text x="359" y="312" textAnchor="middle" fontSize="13" fill="#f0d78e" pointerEvents="none">{t('Tournament district')}</text>
    </g>
    <g pointerEvents="none"><rect x="18" y="17" width="235" height="41" rx="12" fill="#142c23" fillOpacity=".92"/><text x="33" y="43" fontSize="16" fontWeight="bold" fill="#e6dfc0">{city[0]}</text></g>
  </g>;
}
export function GameAtlas({country,cities,selected,host,onSelect}:{country:string;cities:AtlasCity[];selected:AtlasCity|null;host:AtlasCity|null;onSelect:(city:AtlasCity)=>void}) {
  const [data,setData]=useState<AtlasData|null>(null),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
  const [mode,setMode]=useState<'country'|'world'|'city'>('country'),[camera,setCamera]=useState<Camera>(worldCamera);
  const [pixelWidth,setPixelWidth]=useState(W);
  const H=mode==='country'&&pixelWidth<500?720:BASE_H, symbolScale=W/pixelWidth;
  const [cityZoom,setCityZoom]=useState(1),[cityPan,setCityPan]=useState({x:0,y:0}),[notice,setNotice]=useState(false);
  const svg=useRef<SVGSVGElement>(null),drag=useRef<{id:number;x:number;y:number;camera:Camera;pan:{x:number;y:number};moved:boolean}|null>(null);
  const id=useId().replaceAll(':',''), landId=`atlas-land-${id}`,current=selected??host;
  const mapCountry=data?.countries.find(c=>c.code===(country.startsWith('GB-')?'GB':country));
  const initial=useMemo(()=>countryCamera(mapCountry,host,H),[mapCountry,host,H]);
  useEffect(()=>{let alive=true;setFailed(false);loadAtlas().then(d=>{if(alive)setData(d);}).catch(()=>{if(alive)setFailed(true);});return()=>{alive=false;};},[retry]);
  useEffect(()=>{if(data)setCamera(mode==='world'?worldCamera():initial);},[initial,data]);
  const geography=useMemo(()=>data?{
    countries:data.countries.filter(c=>c.code!=='AQ').map(c=>({...c,path:c.polygons.map(atlasPolygon).join(''),bounds:c.polygons.map(p=>polygonBounds(p))})),
    rivers:data.rivers.map(r=>({name:r.name,path:r.lines.map(line=>atlasLine(line)).join(''),bounds:r.lines.map(l=>polygonBounds([l]))})),
    lakes:data.lakes.map(p=>({path:atlasPolygon(p),bounds:polygonBounds(p)})),
  }:null,[data]);
  const switchMode=(next:typeof mode)=>{setMode(next);setNotice(false);setCityZoom(1);setCityPan({x:0,y:0});setCamera(next==='world'?worldCamera():initial);};
  const zoom=(factor:number,anchor?:[number,number])=>mode==='city'?setCityZoom(z=>Math.max(1,Math.min(3,z/factor))):setCamera(c=>zoomCamera(c,factor,anchor??[W/2,H/2],H));
  const visible=(bounds:{west:number;east:number;north:number;south:number},offset=0)=>bounds.east+offset>camera.x-camera.width*.6&&bounds.west+offset<camera.x+camera.width*.6&&bounds.south>camera.y-camera.width*H/W*.6&&bounds.north<camera.y+camera.width*H/W*.6;
  const copies=[-720,-360,0,360,720].filter(offset=>180+offset>camera.x-camera.width/2&&-180+offset<camera.x+camera.width/2);
  const candidates=useMemo(()=>[...new Set([host,selected,...cities.slice(0,mode==='world'?0:pixelWidth<500?6:camera.width>15?16:30)].filter((c):c is AtlasCity=>!!c))],[cities,host,selected,mode,pixelWidth,camera.width]);
  const pins=cityCallouts(candidates,camera,H,32*symbolScale), routeHost=host?screenPoint(host[2],host[3],camera,H):null;
  const scale=W/camera.width, transform=`translate(${W/2-camera.x*scale} ${H/2-camera.y*scale}) scale(${scale})`;
  useEffect(()=>{
    const el=svg.current;if(!el)return;
    const wheel=(event:WheelEvent)=>{event.preventDefault();const rect=el.getBoundingClientRect();const factor=Math.exp(Math.max(-200,Math.min(200,event.deltaY))*.003);if(mode==='city')setCityZoom(z=>Math.max(1,Math.min(3,z/factor)));else setCamera(c=>zoomCamera(c,factor,[(event.clientX-rect.left)/rect.width*W,(event.clientY-rect.top)/rect.height*H],H));};
    el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);
  },[data,mode,H]);
  useEffect(()=>{const el=svg.current;if(!el)return;const observer=new ResizeObserver(entries=>{const width=entries[0]?.contentRect.width;if(width>0)setPixelWidth(width);});observer.observe(el);return()=>observer.disconnect();},[data,mode]);
  const xy=(clientX:number,clientY:number):[number,number]=>{const rect=svg.current!.getBoundingClientRect();return [(clientX-rect.left)/rect.width*W,(clientY-rect.top)/rect.height*H];};
  const select=(city:AtlasCity)=>{if(drag.current?.moved)return;setNotice(false);onSelect(city);if(mode==='city'){setCityPan({x:0,y:0});setCityZoom(1);}};
  return <div data-testid="game-atlas" className="mt-3 overflow-hidden rounded-2xl border border-white/15 bg-[#152d30]">
    <div className="flex flex-wrap items-center justify-between gap-2 p-3"><div className="grid w-full grid-cols-3 gap-1 sm:w-auto" role="group" aria-label={t('Game map views')}>{(['country','world','city'] as const).map(view=><Button key={view} className="min-w-0 px-2 py-2 text-xs sm:px-3 sm:py-2.5 sm:text-sm" aria-label={t(view==='country'?'Country map':view==='world'?'World map':'Generated city')} variant={mode===view?'primary':'secondary'} aria-pressed={mode===view} disabled={view==='city'&&!current} onClick={()=>switchMode(view)}><span className="whitespace-nowrap text-[11px] sm:hidden">{view==='country'?'Country':view==='world'?'World':'City'}</span><span className="hidden sm:inline">{view==='country'?'Country map':view==='world'?'World map':'Generated city'}</span></Button>)}</div><span className="hidden text-xs text-gold-300 sm:inline">{mode==='city'?'CITY':'ATLAS'}</span></div>
    {!data&&mode!=='city'?<div className="p-5 text-sm text-ink-muted">{failed?'Map data could not be loaded.':'Drawing the game map…'}{failed&&<Button className="ml-2" onClick={()=>setRetry(n=>n+1)}>Retry map</Button>}</div>:<>
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="block w-full touch-none select-none bg-[#183541]" style={{aspectRatio:`${W}/${H}`}} role="group" aria-label={t('Game-generated map')} data-mode={mode} data-camera-width={camera.width.toFixed(4)} data-camera-center={`${camera.x.toFixed(4)},${camera.y.toFixed(4)}`} tabIndex={0}
        onPointerDown={e=>{if((e.target as Element).closest('[data-city-pin], [role="button"]'))return;const [x,y]=xy(e.clientX,e.clientY);drag.current={id:e.pointerId,x,y,camera,pan:cityPan,moved:false};e.currentTarget.setPointerCapture(e.pointerId);}}
        onPointerMove={e=>{const d=drag.current;if(!d||d.id!==e.pointerId)return;const [x,y]=xy(e.clientX,e.clientY);if(Math.hypot(x-d.x,y-d.y)>3)d.moved=true;if(mode==='city')setCityPan({x:Math.max(-W,Math.min(W,d.pan.x+x-d.x)),y:Math.max(-H,Math.min(H,d.pan.y+y-d.y))});else setCamera(panCamera(d.camera,x-d.x,y-d.y));}}
        onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}
        onKeyDown={e=>{if(e.target!==e.currentTarget)return;const steps:Record<string,[number,number]>={ArrowLeft:[45,0],ArrowRight:[-45,0],ArrowUp:[0,45],ArrowDown:[0,-45]};if(steps[e.key]){e.preventDefault();const [dx,dy]=steps[e.key];if(mode==='city')setCityPan(p=>({x:p.x+dx,y:p.y+dy}));else setCamera(c=>panCamera(c,dx,dy));}if(e.key==='+'||e.key==='='){e.preventDefault();zoom(.7);}if(e.key==='-'){e.preventDefault();zoom(1.4);}}}>
        <defs><pattern id={`atlas-sea-${id}`} width="28" height="28" patternUnits="userSpaceOnUse"><path d="M3 12q5-3 10 0t10 0" fill="none" stroke="#80a6ad" strokeOpacity=".07"/></pattern><clipPath id={landId}>{geography?.countries.map(c=><path key={c.code} d={c.path} fillRule="evenodd"/>)}</clipPath></defs>
        {mode==='city'&&current?<g transform={`translate(${W/2+cityPan.x} ${H/2+cityPan.y}) scale(${cityZoom}) translate(${-W/2} ${-H/2})`}><CityDistrict city={current} country={country} onVenue={()=>setNotice(true)}/></g>:<>
          <rect width={W} height={H} fill={`url(#atlas-sea-${id})`}/>
          <g transform={transform} data-testid="atlas-geography">{copies.map(offset=><g key={offset} transform={`translate(${offset} 0)`}>
            {geography?.countries.filter(c=>c.bounds.some(b=>visible(b,offset))).map(c=><path key={c.code} data-atlas-country={c.code} d={c.path} fillRule="evenodd" fill={c.code===mapCountry?.code?'#7a8c58':['#3e5947','#48634d','#526e51','#405f4b'][hashString(c.code)%4]} stroke={c.code===mapCountry?.code?'#dfcb84':'#9ab591'} strokeWidth={c.code===mapCountry?.code?1.5:.65} vectorEffect="non-scaling-stroke"/>)}
            {geography?.lakes.filter(l=>visible(l.bounds,offset)).map((l,i)=><path key={`lake${i}`} d={l.path} fill="#244b59" stroke="#719a9b" strokeWidth=".5" vectorEffect="non-scaling-stroke"/>)}
            <g clipPath={`url(#${landId})`}>{geography?.rivers.filter(r=>r.bounds.some(b=>visible(b,offset))).map((r,i)=><path key={`river${i}`} d={r.path} fill="none" stroke="#82b1bb" strokeOpacity=".85" strokeWidth="1.2" vectorEffect="non-scaling-stroke"/>)}</g>
          </g>)}</g>
          <g pointerEvents="none">{geography?.countries.filter(c=>c.code===mapCountry?.code||(mode==='world'?['US','CA','BR','RU','CN','IN','AU','ZA'].includes(c.code):camera.width<55)).map(c=>{const [x,y]=screenPoint(c.label[0],c.label[1],camera,H);if(x<42||x>W-42||y<24||y>H-24)return null;return <text key={c.code} x={x} y={y} textAnchor="middle" fontSize={(c.code===mapCountry?.code?15:mode==='world'?8:10)*symbolScale} fontWeight="600" fill={c.code===mapCountry?.code?'#f2e4b6':'#d4dfcb'} stroke="#243e31" strokeWidth="3" paintOrder="stroke" letterSpacing="1.1">{pixelWidth<500?c.code:t(getCountry(c.code)?.name??c.name)}</text>;})}</g>
          {routeHost&&camera.width<100&&<g pointerEvents="none">{pins.filter(p=>p.city!==host).slice(0,5).map(p=><path key={`route${p.city[0]}`} d={`M${routeHost[0]} ${routeHost[1]}Q${(routeHost[0]+p.x)/2+12} ${(routeHost[1]+p.y)/2-18} ${p.x} ${p.y}`} fill="none" stroke="#edcf8b" strokeOpacity=".5" strokeWidth="1" strokeDasharray="3 5"/>)}</g>}
          {pins.map((p,i)=><g key={p.city[0]} data-city-pin={p.city[0]} role="button" tabIndex={0} aria-label={`${t('City info')}: ${p.city[0]}`} onClick={()=>select(p.city)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(p.city);}}} className="cursor-pointer">
            <path d={`M${p.x} ${p.y}L${p.labelX} ${p.labelY}`} stroke="#f0d79b" strokeWidth="1" pointerEvents="none"/><circle cx={p.x} cy={p.y} r="2.4" fill="#f8e5b0" pointerEvents="none"/>
            <circle data-marker-hit="true" cx={p.labelX} cy={p.labelY} r={22*symbolScale} fill="transparent"/><circle data-marker="true" cx={p.labelX} cy={p.labelY} r={(p.city===host?13:11)*symbolScale} fill={p.city===host?'#edcb75':p.city===selected?'#d6e4b5':'#274537'} stroke={p.city===selected||p.city===host?'#f0dda2':'#b4c69d'} strokeWidth="2"/>
            <text x={p.labelX} y={p.labelY+4*symbolScale} textAnchor="middle" fontSize={(p.city===host?15:10)*symbolScale} fill={p.city===host||p.city===selected?'#1c3729':'#edf2dc'} pointerEvents="none">{p.city===host?'♜':i+1}</text><title>{p.city[0]}</title>
            {pixelWidth>=500&&(p.city===host||p.city===selected)&&<text x={Math.min(W-110,p.labelX+19)} y={Math.max(17,p.labelY-15)} fontSize="12" fontWeight="bold" fill="#f4e5b7" stroke="#18352c" strokeWidth="3" paintOrder="stroke" pointerEvents="none">{p.city[0]}</text>}
          </g>)}
        </>}
        <g pointerEvents="none"><path d={`M${W-31} 42l-7 17 7-4 7 4z`} fill="#e8d79f"/><text x={W-31} y="33" fontSize="11" textAnchor="middle" fill="#e8d79f">N</text><rect x="12" y={H-34} width="178" height="23" rx="8" fill="#102923" fillOpacity=".88"/><text x="22" y={H-18} fontSize="10" fill="#d1dcbc">{t(mode==='city'?'Generated city district':'Game atlas · reference geography')}</text></g>
      </svg>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 p-3"><div className="flex gap-1"><Button className="px-3 py-2 text-xs" variant="secondary" aria-label={t('Zoom in map')} onClick={()=>zoom(.7)}>+</Button><Button className="px-3 py-2 text-xs" variant="secondary" aria-label={t('Zoom out map')} onClick={()=>zoom(1.4)}>−</Button><Button className="px-3 py-2 text-xs" variant="secondary" aria-label={t('Reset map')} onClick={()=>{onSelect(host??selected!);switchMode(mode);}} disabled={!host&&!selected}>Reset view</Button></div><p className="text-xs text-ink-muted">Drag to explore · + / − to zoom</p></div>
    </>}
    <div className="space-y-2 px-3 pb-3 text-xs text-ink-muted">
      {cities.length>0&&<label className="block"><span>Focus city</span><select aria-label={t('Focus city')} className="ml-2 max-w-full rounded-lg bg-navy-900 p-2 text-ink" value={selected?.[0]??''} onChange={e=>{const city=cities.find(c=>c[0]===e.target.value);if(!city)return;select(city);if(mode!=='city')setCamera(c=>({...c,x:city[2],y:mercatorY(city[3])}));}}><option value="">{t('Choose a city')}</option>{cities.map(c=><option key={c[0]} value={c[0]}>{c[0]}</option>)}</select></label>}
      {mode!=='city'?<><p><span className="text-gold-300">♜</span> <span>Tournament host</span> · <span>Cities and travel routes</span></p><p>Geography from Natural Earth; cities from GeoNames. Rendered entirely by the game.</p></>:<p>Streets, buildings and the tournament district are generated game scenery, not real addresses.</p>}
      {notice&&<p role="status" className="rounded-xl bg-gold-500/10 p-3 text-gold-300">This is the tournament district in the generated city map.</p>}
    </div>
  </div>;
}
