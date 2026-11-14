import { createRng } from '@/game/rng';
import { hashString } from '@/utils/format';
export type GeoPoint = [number,number];
export type AtlasCity = [string,number,number,number];
export interface AtlasCountry { code:string; name:string; label:GeoPoint; polygons:GeoPoint[][][] }
export interface AtlasData { version:number; countries:AtlasCountry[]; rivers:Array<{name:string;lines:GeoPoint[][]}>; lakes:GeoPoint[][][] }
export interface Camera { x:number;y:number;width:number }
export interface Bounds {west:number;east:number;north:number;south:number}
export const ATLAS_WIDTH=720, ATLAS_HEIGHT=440;
export const mercatorY=(latitude:number)=>-180/Math.PI*Math.log(Math.tan(Math.PI/4+Math.max(-85,Math.min(85,latitude))*Math.PI/360));
export const wrapLongitude=(longitude:number,center=0)=>longitude+360*Math.round((center-longitude)/360);
export function atlasLine(points:GeoPoint[],closed=false) {
  let previous=points[0]?.[0]??0;
  return points.map(([lon,lat],i)=>{const x=wrapLongitude(lon,previous);previous=x;return `${i?'L':'M'}${x.toFixed(3)} ${mercatorY(lat).toFixed(3)}`;}).join('')+(closed?'Z':'');
}
export const atlasPolygon=(rings:GeoPoint[][])=>rings.map(ring=>atlasLine(ring,true)).join('');
export function polygonBounds(rings:GeoPoint[][],center=0):Bounds {
  const pts=rings.flat().map(([x,y])=>[wrapLongitude(x,center),mercatorY(y)]);
  return {west:Math.min(...pts.map(p=>p[0])),east:Math.max(...pts.map(p=>p[0])),north:Math.min(...pts.map(p=>p[1])),south:Math.max(...pts.map(p=>p[1]))};
}
export function fitBounds(bounds:Bounds,height=ATLAS_HEIGHT):Camera {
  const width=Math.max(1.4,(bounds.east-bounds.west)*1.25,(bounds.south-bounds.north)*ATLAS_WIDTH/height*1.22);
  return {x:(bounds.west+bounds.east)/2,y:(bounds.north+bounds.south)/2,width:Math.min(360,width)};
}
export function countryCamera(country:AtlasCountry|undefined,city:AtlasCity|null,height=ATLAS_HEIGHT):Camera {
  const lon=city?.[2]??country?.label[0]??0, y=mercatorY(city?.[3]??country?.label[1]??20);
  if(!country)return {x:lon,y,width:14};
  const polygons=country.polygons.map(p=>polygonBounds(p,lon));
  // Use the main nearby landmass; overseas territories must not stretch a host-country view across the globe.
  const distance=(b:Bounds)=>Math.hypot(Math.max(b.west-lon,0,lon-b.east),Math.max(b.north-y,0,y-b.south));
  const closest=[...polygons].sort((a,b)=>distance(a)-distance(b)||(b.east-b.west)*(b.south-b.north)-(a.east-a.west)*(a.south-a.north))[0];
  const span=Math.max(3,closest.east-closest.west,closest.south-closest.north);
  const nearby=polygons.filter(b=>Math.hypot((b.west+b.east-closest.west-closest.east)/2,(b.north+b.south-closest.north-closest.south)/2)<span*1.15);
  return fitBounds({west:Math.min(...nearby.map(b=>b.west)),east:Math.max(...nearby.map(b=>b.east)),north:Math.min(...nearby.map(b=>b.north)),south:Math.max(...nearby.map(b=>b.south))},height);
}
export const worldCamera=():Camera=>({x:0,y:-18,width:360});
export function screenPoint(lon:number,lat:number,camera:Camera,height=ATLAS_HEIGHT):GeoPoint {
  const scale=ATLAS_WIDTH/camera.width;
  return [(wrapLongitude(lon,camera.x)-camera.x)*scale+ATLAS_WIDTH/2,(mercatorY(lat)-camera.y)*scale+height/2];
}
export function zoomCamera(camera:Camera,factor:number,anchor:GeoPoint=[ATLAS_WIDTH/2,ATLAS_HEIGHT/2],height=ATLAS_HEIGHT):Camera {
  const width=Math.max(.2,Math.min(360,camera.width*factor)), ratio=width/camera.width;
  return {width,x:camera.x+(anchor[0]-ATLAS_WIDTH/2)*camera.width/ATLAS_WIDTH*(1-ratio),y:Math.max(-155,Math.min(155,camera.y+(anchor[1]-height/2)*camera.width/ATLAS_WIDTH*(1-ratio)))};
}
export function panCamera(camera:Camera,dx:number,dy:number):Camera {
  return {...camera,x:camera.x-dx*camera.width/ATLAS_WIDTH,y:Math.max(-155,Math.min(155,camera.y-dy*camera.width/ATLAS_WIDTH))};
}
export function cityCallouts(cities:AtlasCity[],camera:Camera,height=ATLAS_HEIGHT,spacing=30) {
  const result:Array<{city:AtlasCity;x:number;y:number;labelX:number;labelY:number}>=[];
  for(const city of cities) {
    const [x,y]=screenPoint(city[2],city[3],camera,height);
    if(x<12||x>ATLAS_WIDTH-12||y<18||y>height-18)continue;
    const margin=Math.max(18,spacing/2+2);
    let labelX=Math.max(margin,Math.min(ATLAS_WIDTH-margin,x)),labelY=Math.max(margin,Math.min(height-margin,y));
    for(let i=0;result.some(p=>Math.hypot(p.labelX-labelX,p.labelY-labelY)<spacing)&&i<160;i++) {
      const radius=(20+Math.floor(i/12)*12)*spacing/30;
      labelX=Math.max(margin,Math.min(ATLAS_WIDTH-margin,x+Math.cos(i*2.399)*radius));
      labelY=Math.max(margin,Math.min(height-margin,y+Math.sin(i*2.399)*radius));
    }
    result.push({city,x,y,labelX,labelY});
  }
  return result;
}
/** Stable, fictional scenery in an actual city; no building is claimed to be a real address. */
export function generateCityDistrict(city:AtlasCity,country:string) {
  const rng=createRng(hashString(`${country}:${city[0]}:district-v1`));
  const buildings:Array<{x:number;y:number;width:number;height:number;tone:number}>=[],parks:Array<{x:number;y:number}>=[];
  for(let row=0;row<6;row++)for(let col=0;col<11;col++) {
    if((col>=4&&col<=6)&&(row>=2&&row<=3))continue;
    const x=26+col*62,y=28+row*65;
    if(rng.chance(.16))parks.push({x,y});
    else buildings.push({x:x+rng.int(0,4),y:y+rng.int(0,4),width:rng.int(28,47),height:rng.int(25,45),tone:rng.int(0,3)});
  }
  return {buildings,parks};
}
