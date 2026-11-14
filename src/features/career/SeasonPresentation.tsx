import Lottie from 'lottie-react';
import { useSoundEnabled } from '@/audio/sound';
import { useReducedMotion } from 'motion/react';
import { useEffect,useRef,useState } from 'react';
import { Howl } from 'howler';
import { Button } from '@/components/ui';
const pulse={
 v:'5.9.0',fr:30,ip:0,op:60,w:160,h:160,nm:'Season clock',ddd:0,assets:[],
 layers:[{ddd:0,ind:1,ty:4,nm:'Progress ring',sr:1,
  ks:{o:{a:0,k:100},r:{a:1,k:[{t:0,s:[0],i:{x:[.667],y:[1]},o:{x:[.333],y:[0]}},{t:60,s:[360]}]},p:{a:0,k:[80,80,0]},a:{a:0,k:[0,0,0]},s:{a:0,k:[100,100,100]}},
  shapes:[{ty:'gr',it:[
   {ty:'el',d:1,p:{a:0,k:[0,0]},s:{a:0,k:[100,100]},nm:'Ring'},
   {ty:'st',c:{a:0,k:[.7,.82,.5,1]},o:{a:0,k:100},w:{a:0,k:8},lc:2,lj:1,d:[{n:'d',nm:'dash',v:{a:0,k:24}},{n:'g',nm:'gap',v:{a:0,k:16}}]},
   {ty:'tr',p:{a:0,k:[0,0]},a:{a:0,k:[0,0]},s:{a:0,k:[100,100]},r:{a:0,k:0},o:{a:0,k:100},sk:{a:0,k:0},sa:{a:0,k:0}}
  ],nm:'Season progress'}],ip:0,op:60,st:0,bm:0}]
};
export function SeasonPresentation({action,tournaments,stopping}:{action:string;tournaments:number;stopping:boolean}){
 const globalSound=useSoundEnabled(),reduced=useReducedMotion();
 const [sound,setSound]=useState(false),audio=useRef<Howl|null>(null),synth=useRef<{triggerAttackRelease:(note:string,duration:string)=>void;dispose:()=>void}|null>(null),previous=useRef(tournaments);
 useEffect(()=>()=>{audio.current?.unload();synth.current?.dispose();},[]);
 useEffect(()=>{if(sound&&globalSound&&tournaments>previous.current){audio.current?.play();synth.current?.triggerAttackRelease('G4','8n');}previous.current=tournaments;},[tournaments,sound,globalSound]);
 useEffect(()=>{if(!globalSound){audio.current?.stop();synth.current?.dispose();synth.current=null;setSound(false);}},[globalSound]);
 const enable=async()=>{if(sound){setSound(false);audio.current?.stop();return;}const Tone=await import('tone');await Tone.start();synth.current?.dispose();synth.current=new Tone.Synth({volume:-25}).toDestination();audio.current??=new Howl({src:[`${import.meta.env.BASE_URL}audio/career/milestone.wav`],volume:.12});setSound(true);synth.current.triggerAttackRelease('C4','8n');};
 return <div className="flex flex-wrap items-center gap-3 rounded-xl bg-navy-900 p-3" data-testid="season-animation"><Lottie animationData={pulse} loop autoplay={!stopping&&!reduced} style={{width:70,height:70}} aria-label="Season activity animation"/><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{action}</p><p className="text-xs text-ink-muted">{stopping?'Finishing the current action':'Live season activity'}</p><Button className="mt-2" variant="secondary" disabled={!globalSound} aria-pressed={sound} onClick={()=>void enable().catch(()=>setSound(false))}>{sound?'Mute season soundscape':'Enable season soundscape'}</Button></div></div>;
}
