import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MonitorCheck,Monitor,Volume2,VolumeX,Settings2,ScrollText } from 'lucide-react';
import type { ScreenWakeStatus } from '@/hooks/useScreenWakeLock';
import { setSoundEnabled,useSoundEnabled } from '@/audio/sound';
import { ApMeter } from '@/components/game/ApMeter';
import { MoneyChip } from '@/components/game/MoneyChip';
import { Avatar,Button,Modal } from '@/components/ui';
import { ROUTES } from '@/data/navigation';
import { usePlayer } from '@/hooks/useGame';
import { usePreferences } from '@/store/preferences';
import { BoardPreferences } from '@/features/match/BoardPreferences';
export function TopBar({wakeStatus}:{wakeStatus:ScreenWakeStatus}) {
 const player=usePlayer(),sound=useSoundEnabled(),theme=usePreferences(s=>s.theme),setTheme=usePreferences(s=>s.setTheme),[settings,setSettings]=useState(false);
 return <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-navy-950/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl"><div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-2 sm:flex sm:h-20 sm:justify-between sm:px-7">
 <Link to={ROUTES.profile} aria-label={`Open profile for ${player.name}`} className="flex min-w-0 items-center gap-3 rounded-full py-1 pr-3 hover:bg-white/5"><Avatar name={player.name} seed={player.avatarSeed} appearance={player.appearance}/><span translate="no" className="truncate text-sm font-semibold sm:text-base">{player.name}</span></Link>
 <div data-performance-trigger className="col-start-1 row-start-2 flex touch-manipulation select-none items-center gap-2 sm:ml-auto"><ApMeter ap={player.ap}/><MoneyChip amount={player.money}/></div>
 <div className="col-start-2 row-span-2 flex items-center gap-3"><span data-testid="screen-wake-status" data-status={wakeStatus} role="img" aria-label={wakeStatus==='active'?'Screen stays awake':wakeStatus==='unavailable'?'Screen wake lock is unavailable in this browser':'Screen wake lock is waiting for the browser'} className="text-ink-faint">{wakeStatus==='active'?<MonitorCheck size={16}/>:<Monitor size={16}/>}</span><button type="button" aria-label="Settings" onClick={()=>setSettings(true)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 text-ink-muted hover:text-ink"><Settings2 size={19}/></button></div>
 </div>{settings&&<Modal open title="Settings" onClose={()=>setSettings(false)}><div className="space-y-5"><label className="block text-sm font-semibold">Theme<select aria-label="Theme" value={theme} onChange={e=>setTheme(e.target.value as typeof theme)} className="mt-2 w-full rounded-xl bg-navy-900 p-3"><option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option></select></label><div className="flex flex-wrap items-center justify-between gap-3"><Button variant="secondary" aria-label={sound?'Turn sound off':'Turn sound on'} aria-pressed={sound} onClick={()=>setSoundEnabled(!sound)}>{sound?<Volume2 size={18}/>:<VolumeX size={18}/>} Sound</Button></div><Link to={ROUTES.changelog} onClick={()=>setSettings(false)} className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 p-3 hover:bg-white/5"><ScrollText size={20} aria-hidden className="shrink-0 text-gold-300"/><span><span className="block text-sm font-semibold text-ink">Changelog</span><span className="block text-xs text-ink-faint">See what changed in every release</span></span></Link><BoardPreferences/></div></Modal>}</header>;
}
