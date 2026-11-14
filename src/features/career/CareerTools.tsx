import { useEffect, useMemo, useRef, useState } from 'react';
import { Story } from 'inkjs';
import Graph from 'graphology';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Chart, LinearScale, Tooltip } from 'chart.js';
import { MatrixController, MatrixElement } from 'chartjs-chart-matrix';
import { useSave } from '@/hooks/useGame';
import { careerSchedule } from '@/game/career/planning';
import { Button } from '@/components/ui';
import storyData from '@/data/seasonCoach.json';
Chart.register(LinearScale,Tooltip,MatrixController,MatrixElement);
export function SeasonCoach() {
 const save=useSave();const [revision,setRevision]=useState(0);
 const story=useMemo(()=>{const s=new Story(storyData);s.variablesState!['elo']=save.player.rating;return s;},[save.career.id]);
 const [lines,setLines]=useState<string[]>(()=>{const rows=[];while(story.canContinue)rows.push(story.Continue()??'');return rows;});
 return <div className="rounded-xl bg-navy-900 p-4" data-testid="season-coach"><h3 className="font-semibold">Coach’s season notebook</h3>{lines.map((l,i)=><p key={i} className="mt-2 text-sm text-ink-muted">{l}</p>)}<div className="mt-3 flex flex-wrap gap-2">{!story.currentChoices.length&&<Button variant="secondary" onClick={()=>{story.ResetState();story.variablesState!['elo']=save.player.rating;const text=[];while(story.canContinue)text.push(story.Continue()??'');setLines(text);setRevision(n=>n+1);}}>Ask another question</Button>}{story.currentChoices.map(c=><Button key={`${revision}:${c.index}`} variant="secondary" onClick={()=>{story.ChooseChoiceIndex(c.index);const text=[];while(story.canContinue)text.push(story.Continue()??'');setLines(text);setRevision(n=>n+1);}}>{c.text}</Button>)}</div></div>;
}
export function PerformanceHeatmap(){
 const save=useSave(),canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  if(!canvas.current)return;
  const cells=new Map<string,{x:number;y:number;v:number;n:number}>();
  for(const g of save.history.games.filter(g=>g.year===save.world.date.year)){const key=`${g.week}:${g.day??1}`;const c=cells.get(key)??{x:g.week,y:g.day??1,v:0,n:0};c.n++;c.v+=g.outcome==='win'?1:g.outcome==='draw'?.5:0;cells.set(key,c);}
  const chart=new Chart(canvas.current,{type:'matrix',data:{datasets:[{label:'Score rate',data:[...cells.values()].map(c=>({...c,v:c.v/c.n})),backgroundColor:ctx=>{const c=ctx.raw as {v:number};return c?.v>=.65?'#9cbe83':c?.v>=.4?'#c5aa64':'#9e6868';},width:10,height:18}]},options:{responsive:true,maintainAspectRatio:false,scales:{x:{type:'linear',min:1,max:52},y:{type:'linear',min:1,max:7}},plugins:{legend:{display:false}}}});
  return()=>chart.destroy();
 },[save.history.games,save.world.date.year]);
 return <div><h3 className="mb-3 font-semibold">Season performance heatmap</h3><p className="text-xs text-ink-muted">Recorded games only · green: strong score · gold: balanced · red: difficult day</p><div className="mt-3 h-52"><canvas ref={canvas}/></div></div>;
}

export function QualificationFlow(){const save=useSave();const events=careerSchedule(save,52).filter(e=>e.details?.qualificationCircuit);const selected=events.filter(e=>e.details!.qualificationCircuit!.stage!=='local'||e.details!.qualificationCircuit!.heat===0);const nodes=selected.map(e=>({id:e.id,position:{x:(['local','national','continental','world'].indexOf(e.details!.qualificationCircuit!.stage))*240,y:e.details!.qualificationCircuit!.seriesId?180:0},data:{label:`${e.name}\n${e.details!.qualificationCircuit!.advanceTop??'Final'} places`},style:{background:'#263d30',color:'#edf0df',border:'1px solid #94ac7a',width:210}}));const ids=new Set(nodes.map(n=>n.id));const edges=selected.filter(e=>ids.has(e.details!.qualificationCircuit!.targetEventId??'')).map(e=>({id:e.id,source:e.id,target:e.details!.qualificationCircuit!.targetEventId!,label:`Top ${e.details!.qualificationCircuit!.advanceTop}`}));return <div className="h-80 rounded-xl bg-navy-900" data-testid="qualification-flow"><ReactFlow nodes={nodes} edges={edges} fitView nodesDraggable={false} minZoom={.25} colorMode="dark"><Background/><Controls/></ReactFlow></div>;}
export function RivalryNetwork(){const save=useSave();const graph=useMemo(()=>{const g=new Graph({type:'undirected'});g.addNode('player');for(const m of save.history.games.slice(-150)){const id=m.opponentId??m.opponentName;if(!g.hasNode(id))g.addNode(id,{name:m.opponentName,games:0,score:0});g.updateNodeAttribute(id,'games',n=>(n??0)+1);g.updateNodeAttribute(id,'score',n=>(n??0)+(m.outcome==='win'?1:m.outcome==='draw'?.5:0));if(!g.hasEdge('player',id))g.addEdge('player',id);}return g;},[save.history.games]);const rivals=graph.nodes().filter(n=>n!=='player').sort((a,b)=>graph.getNodeAttribute(b,'games')-graph.getNodeAttribute(a,'games')).slice(0,5);return <div><h3 className="font-semibold">Your rivalry network</h3>{rivals.length?rivals.map(id=><p key={id} className="mt-2 rounded-xl bg-navy-900 p-3 text-sm">{graph.getNodeAttribute(id,'name')} · {graph.getNodeAttribute(id,'games')} games · {(graph.getNodeAttribute(id,'score')/graph.getNodeAttribute(id,'games')*100).toFixed(0)}% score</p>):<p className="mt-2 text-sm text-ink-muted">Play recorded games to build your rivalry network.</p>}</div>;}
export function CareerTools(){const [tab,setTab]=useState('path');return <details className="rounded-2xl border border-white/10 bg-navy-800 p-4"><summary className="cursor-pointer font-semibold">Career studio · routes, coach & performance</summary><div className="my-4 flex flex-wrap gap-2">{[['path','Qualification routes'],['coach','Coach notebook'],['heat','Performance'],['rival','Rivalries']].map(([id,name])=><Button key={id} variant={tab===id?'primary':'secondary'} onClick={()=>setTab(id)}>{name}</Button>)}</div>{tab==='path'?<QualificationFlow/>:tab==='coach'?<SeasonCoach/>:tab==='heat'?<PerformanceHeatmap/>:<RivalryNetwork/>}</details>;}
