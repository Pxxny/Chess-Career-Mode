import { useId } from 'react';
import type { CareerArticle } from '@/game/career/highlights';
/** A locally rendered keepsake, using the saved podium rather than predicted winners. */
export function CeremonyArt({article}:{article:CareerArticle}){
 const id=useId().replaceAll(':',''),c=article.ceremony!,opening=c.phase==='opening';
 const figures=opening?[{name:'',rank:2},{name:'',rank:1},{name:'',rank:3}]:[c.podium[1],c.podium[0],c.podium[2]].filter(Boolean);
 const positions:Record<number,number>={1:400,2:220,3:580};
 return <figure className="overflow-hidden rounded-2xl border border-gold-500/20 bg-navy-900" data-testid="ceremony-picture">
 <svg viewBox="0 0 800 460" role="img" aria-label={opening?'Opening ceremony':`Award ceremony · ${c.podium[0]?.name??article.event}`} className="w-full">
 <defs><linearGradient id={`${id}bg`} x2="0" y2="1"><stop stopColor="#11251f"/><stop offset="1" stopColor="#35543d"/></linearGradient><radialGradient id={`${id}light`}><stop stopColor="#eedb9a" stopOpacity=".3"/><stop offset="1" stopColor="#eedb9a" stopOpacity="0"/></radialGradient></defs>
 <rect width="800" height="460" fill={`url(#${id}bg)`}/><ellipse cx="400" cy="210" rx="340" ry="235" fill={`url(#${id}light)`}/>
 <path d="M0 0H90L65 350H0ZM800 0H710L735 350H800" fill="#17362c"/><path d="M95 0L310 330H150ZM705 0L490 330H650Z" fill="#e9d390" opacity=".06"/>
 <text x="400" y="42" textAnchor="middle" fill="#e9d390" fontSize="19" fontFamily="sans-serif" letterSpacing="4">{opening?'OPENING CEREMONY':'AWARD CEREMONY'}</text>
 <foreignObject x="100" y="58" width="600" height="55"><div style={{color:'#f1eddb',textAlign:'center',fontSize:19,fontWeight:600,lineHeight:1.3}}>{article.event}</div></foreignObject>
 {c.sponsor&&<foreignObject x="100" y="115" width="600" height="32"><div style={{color:'#becbb0',textAlign:'center',fontSize:13}}>{c.sponsor}</div></foreignObject>}
 <ellipse cx="400" cy="418" rx="330" ry="25" fill="#0b1e18"/>
 {figures.map(p=>{const x=positions[p.rank]??400,y=opening?330:p.rank===1?300:p.rank===2?326:345;return <g key={p.rank}>
 {!opening&&<><rect x={x-75} y={y} width="150" height={420-y} rx="4" fill={p.rank===1?'#bd9f4c':p.rank===2?'#81958b':'#92724c'}/><text x={x} y={y+45} fill="#14281e" textAnchor="middle" fontSize="32" fontWeight="700">{p.rank}</text></>}
 <path d={`M${x-31} ${y-87}Q${x} ${y-106} ${x+31} ${y-87}L${x+27} ${y-14}H${x-27}Z`} fill={p.rank===1?'#e2dfc7':'#526c60'}/>
 <path d={`M${x-20} ${y-14}V${y}M${x+20} ${y-14}V${y}`} stroke="#152a22" strokeWidth="13"/>
 <circle cx={x} cy={y-119} r="22" fill="#c89e75"/><path d={`M${x-22} ${y-122}Q${x-22} ${y-151} ${x+20} ${y-129}`} fill="#29332c"/>
 {!opening&&<><path d={`M${x-12} ${y-94}L${x} ${y-67}L${x+12} ${y-94}`} stroke="#c6a654" strokeWidth="4" fill="none"/><circle cx={x} cy={y-63} r="9" fill={p.rank===1?'#edd47c':p.rank===2?'#c5d3cc':'#c49b70'}/></>}
 {!opening&&p.rank===1&&<g transform={`translate(${x+39} ${y-110})`}><path d="M-14 0H14L11 23Q0 35 -11 23Z" fill="#f2d776"/><path d="M-14 4H-24Q-23 24 -10 22M14 4H24Q23 24 10 22" stroke="#e3c466" strokeWidth="4" fill="none"/><path d="M0 29V41M-13 43H13" stroke="#f2d776" strokeWidth="5"/><path d="M-12 34L-36 40" stroke="#c89e75" strokeWidth="9" strokeLinecap="round"/></g>}
 {!opening&&<foreignObject x={x-76} y={y+55} width="152" height="60"><div style={{color:'#10271d',fontSize:13,textAlign:'center',fontWeight:700,lineHeight:1.2,overflowWrap:'anywhere'}}>{p.name}</div></foreignObject>}
 </g>;})}
 {!opening&&<g transform="translate(495 295)"><path d="M-20-72H20L27 0H-27Z" fill="#213d30"/><circle cy="-98" r="19" fill="#b99169"/><path d="M-20-51L-43-70" stroke="#b99169" strokeWidth="9" strokeLinecap="round"/><path d="M-13 0V21M13 0V21" stroke="#14291e" strokeWidth="12"/></g>}
 {opening&&<><path d="M315 307H485" stroke="#d5b16a" strokeWidth="7"/><path d="M400 290L390 323M403 291L412 324" stroke="#f5e5ae" strokeWidth="3"/><text x="400" y="385" textAnchor="middle" fontSize="18" fill="#e9d390">Let the competition begin</text></>}
 <text x="400" y="448" textAnchor="middle" fontSize="11" fill="#bdc7b3">{article.year} · {c.location??'Career tournament venue'} · Career illustration</text>
 </svg>
 <figcaption className="px-4 py-3 text-xs text-ink-muted">{opening?'Opening ceremony':'Award ceremony'}{!opening&&c.playerRank?` · Your result #${c.playerRank}`:''}{!opening&&c.prize!==undefined?` · Prize $${c.prize}`:''}</figcaption>
 {!opening&&c.podium.length>0&&<ol className="space-y-1 border-t border-white/10 px-4 py-3 text-sm" aria-label="Award podium">{c.podium.map(p=><li key={p.rank} className={p.rank===1?"font-semibold text-gold-300":"text-ink-muted"}>#{p.rank} · {p.name}{p.points!==undefined?` · ${p.points} pts`:""}</li>)}</ol>}
 </figure>;
}
