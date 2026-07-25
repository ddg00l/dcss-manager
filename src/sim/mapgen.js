import {mulberry32} from '../core/rng.js';
import {BRANCHES,brDepth,BR_OFFSET,BR_ORDER} from '../data/branches.js';
import {MONS,UNIQUES} from '../data/monsters.js';
import {GODKEYS} from '../data/gods.js';
import {gDrop} from '../core/economy.js';
import {randConsumable} from '../data/consumables.js';
import {randomItem} from '../data/items.js';
import {PORTALS,PORTAL_KEYS} from '../data/portals.js';
import {memHas} from '../data/memtree.js';

export const MW=24,MH=15;
export function genFloor(h,s){
  const P=h.inPortal?PORTALS[h.inPortal.type]:null;
  const br=P?{n:P.n,short:'Portal',floors:P.floors,floor:P.floor,wall:P.wall,
    mobs:P.mobs.map(m=>[m,1,999]),boss:null}:BRANCHES[h.branch];
  const pf=P?h.inPortal.floor:h.floor;
  h.regenN=(h.regenN||0)+1; /* every regeneration is unique — the same floor cannot be farmed in a loop */
  const rng=mulberry32(h.seed+pf*7919+h.segIdx*104729+(P?31337:0)+h.regenN*1013904);
  const g=[];
  for(let y=0;y<MH;y++){g.push(new Array(MW).fill(1))}
  const rooms=[];
  const nr=4+Math.floor(rng()*4);
  for(let i=0;i<nr;i++){
    const w=3+Math.floor(rng()*6),hh=3+Math.floor(rng()*4);
    const x=1+Math.floor(rng()*(MW-w-2)),y=1+Math.floor(rng()*(MH-hh-2));
    rooms.push({x,y,w,h:hh,cx:x+(w>>1),cy:y+(hh>>1)});
    for(let yy=y;yy<y+hh;yy++)for(let xx=x;xx<x+w;xx++)g[yy][xx]=0;
  }
  for(let i=1;i<rooms.length;i++){
    let a=rooms[i-1],b=rooms[i],x=a.cx,y=a.cy;
    while(x!==b.cx){g[y][x]=0;x+=x<b.cx?1:-1}
    while(y!==b.cy){g[y][x]=0;y+=y<b.cy?1:-1}
    g[y][x]=0;
  }
  const free=[];
  for(let y=0;y<MH;y++)for(let x=0;x<MW;x++)if(g[y][x]===0)free.push([x,y]);
  const take=()=>free.splice(Math.floor(rng()*free.length),1)[0];
  const start=take();
  /* stairs at farthest cell */
  let far=free[0],fd=0;
  for(const c of free){const d=Math.abs(c[0]-start[0])+Math.abs(c[1]-start[1]);
    if(d>fd){fd=d;far=c}}
  free.splice(free.indexOf(far),1);
  const depth=P?(h.portalDepth+(P.depthRamp||0)*(h.inPortal.floor-1)):brDepth(h);
  const isBossFloor=P?false:((br.floors===h.floor&&(br.boss||br.bossMon))||(br.every&&h.floor%br.every===0));
  const monsters=[];
  const pool=P?br.mobs:br.mobs.filter(m=>h.floor>=m[1]&&h.floor<=m[2]);
  const n=P?(P.mobs.length?6+Math.floor(rng()*5):0):(5+Math.floor(rng()*5)+(h.branch==='zot'?2:0));
  for(let i=0;i<n&&free.length>4;i++){
    const mk=pool[Math.floor(rng()*pool.length)][0];
    const c=take();
    monsters.push(makeMon(mk,depth,c[0],c[1],rng));
  }
  /* unique spawn */
  let uniq=null;
  const brKey=(P||h.branch==='dungeon')?undefined:h.branch;
  if(P){/* no uniques in portals */}else
  if(isBossFloor&&br.boss)uniq=br.boss;
  else if(!isBossFloor){
    const cands=Object.keys(UNIQUES).filter(k=>{
      const u=UNIQUES[k];
      if((u.br||'dungeon')!==(brKey||'dungeon'))return false;
      return h.floor>=u.fl[0]&&h.floor<=u.fl[1]&&!h.uniqSeen?.includes(k);
    });
    if(cands.length&&rng()<.2)uniq=cands[Math.floor(rng()*cands.length)];
  }
  if(uniq&&free.length>2){
    const u=UNIQUES[uniq],c=take();
    const m=makeMon(u.base,depth,c[0],c[1],rng);
    m.hp=Math.floor(m.hp*u.mul);m.maxHp=m.hp;m.dmg=Math.floor(m.dmg*(1+u.mul*.25));
    m.xp*=u.mul*2;m.uniq=uniq;m.n=u.n;m.t=u.t;
    monsters.push(m);
    (h.uniqSeen=h.uniqSeen||[]).push(uniq);
  }
  if(isBossFloor&&br.bossMon&&free.length>2){
    const c=take();
    const m=makeMon(br.bossMon,depth,c[0],c[1],rng);
    m.hp=Math.floor(m.hp*br.bossMul);m.maxHp=m.hp;m.dmg=Math.floor(m.dmg*2.2);
    m.xp*=br.bossMul*2;m.boss=true;m.n=br.bossN;m.t=br.bossT;
    monsters.push(m);
  }
  const items=[];
  const goldMul=P?P.goldMul:1;
  const ng=(P?3:2)+Math.floor(rng()*3);
  for(let i=0;i<ng&&free.length>2;i++){const c=take();
    items.push({x:c[0],y:c[1],kind:'gold',amt:Math.floor((8+rng()*20)*Math.pow(1.24,depth)*goldMul)})}
  const consN=P?P.lootN:(rng()<.6?1:2);
  for(let i=0;i<consN&&free.length>2;i++){const c=take();
    items.push({x:c[0],y:c[1],kind:'cons',c:randConsumable(rng)})}
  if(rng()<((P?.5:.10)*gDrop(s))&&free.length>2){const c=take();
    items.push({x:c[0],y:c[1],kind:'item',it:randomItem(null,Math.min(2,Math.floor(depth/8)),rng)})}
  if(!P&&rng()<.16&&!h.god&&free.length>2){const c=take();
    items.push({x:c[0],y:c[1],kind:'altar',god:GODKEYS[Math.floor(rng()*GODKEYS.length)]})}
  if(!P&&rng()<.02&&depth>=8&&free.length>2){const c=take();items.push({x:c[0],y:c[1],kind:'key'})}
  /* shop */
  if(!P&&!isBossFloor&&rng()<.08&&free.length>2){const c=take();
    const stypes=['general','weapon','armour','potion','scroll'];
    items.push({x:c[0],y:c[1],kind:'shop',stype:stypes[Math.floor(rng()*stypes.length)]})}
  /* portal entrance */
  if(!P&&h.branch==='dungeon'&&!h.banished&&rng()<.07&&free.length>2){
    const cands=PORTAL_KEYS.filter(k=>{
      const pd=PORTALS[k];
      if(h.floor<pd.fl[0]||h.floor>pd.fl[1])return false;
      if(pd.needWin&&!s.fame.some(f=>f.won))return false;
      return true;
    });
    if(cands.length){const c=take();
      items.push({x:c[0],y:c[1],kind:'portal',ptype:cands[Math.floor(rng()*cands.length)]})}
  }
  /* traps (hidden) */
  const traps=[];
  if(!P){
    const tn=1+Math.floor(rng()*3);
    for(let i=0;i<tn&&free.length>2;i++){
      const c=take();
      const r2=rng();
      const kind=depth>=18&&r2<.08?'zot':r2<.3?'teleport':r2<.55?'alarm':r2<.8?'net':'shaft';
      traps.push({x:c[0],y:c[1],kind,seen:false});
    }
  }
  if(isBossFloor&&br.orb&&free.length>2){const c=take();items.push({x:c[0],y:c[1],kind:'orb'})}
  /* NG+ and elite floors */
  const ngPlus=memHas(s,'k_ngplus')?2:1;
  const elite=memHas(s,'k_elite')&&rng()<.15;
  for(const mo of monsters){
    mo.hp=Math.floor(mo.hp*ngPlus*(elite?1.5:1));mo.maxHp=mo.hp;
    mo.dmg=Math.floor(mo.dmg*ngPlus*(elite?1.2:1));
  }
  const explored=[];
  for(let y=0;y<MH;y++)explored.push(new Array(MW).fill(false));
  h.map={g,monsters,items,stairs:{x:far[0],y:far[1]},px:start[0],py:start[1],explored,
    bossFloor:isBossFloor,elite,traps,clouds:[]};
  /* volcano: smoldering clouds */
  if(P&&P.clouds){
    for(let i=0;i<5&&free.length>2;i++){const c=take();
      h.map.clouds.push({x:c[0],y:c[1],kind:P.clouds,t:9999})}
  }
  h.path=null;h.pathGoal=null;
  reveal(h);
}
function _unused_brDepth(h){
  /* global difficulty depth: dungeon floor or branch offset */
  const off={dungeon:0,lair:6,orc:9,elf:12,vaults:13,depths:16,zot:21}[h.branch];
  return off+h.floor;
}
export function makeMon(kind,depth,x,y,rng){
  const d=MONS[kind];
  const sc=Math.pow(1.40,Math.max(0,depth-avgKind(kind)));
  return {kind,n:d.n,t:d.t,x,y,hp:Math.floor(d.hp*sc),maxHp:Math.floor(d.hp*sc),
    dmg:Math.floor(d.dmg*Math.pow(1.34,Math.max(0,depth-avgKind(kind)))),
    ac:d.ac,ev:d.ev,xp:d.xp*sc,spd:d.spd||1,rng:d.rng?5:1,acc:3+depth*.8,
    mv:0,awake:false,special:d};
}
const KIND_AVG={};
function avgKind(kind){
  if(KIND_AVG[kind]!==undefined)return KIND_AVG[kind];
  let lo=99,hi=0;
  for(const bk of BR_ORDER){const br=BRANCHES[bk];
    for(const m of br.mobs)if(m[0]===kind){
      const off=BR_OFFSET[bk];
      lo=Math.min(lo,off+m[1]);hi=Math.max(hi,off+m[2]);}}
  const v=lo===99?1:(lo+hi)/2;
  KIND_AVG[kind]=v;return v;
}
/* Bresenham line of sight: walls block sight beyond themselves (the wall face is seen). */
export function los(m,x0,y0,x1,y1){
  let dx=Math.abs(x1-x0),dy=Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1,err=dx-dy,x=x0,y=y0;
  while(!(x===x1&&y===y1)){
    if(!(x===x0&&y===y0)&&m.g[y][x]===1)return false;
    const e2=2*err;
    if(e2>-dy){err-=dy;x+=sx}
    if(e2<dx){err+=dx;y+=sy}
  }
  return true;
}
export const FOV_R=7;
export function reveal(h){
  const m=h.map;
  if(m._rx===m.px&&m._ry===m.py)return; /* only recompute after movement */
  m._rx=m.px;m._ry=m.py;
  const R=FOV_R;
  for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){
    if(dx*dx+dy*dy>R*R+2)continue;
    const x=m.px+dx,y=m.py+dy;
    if(x<0||x>=MW||y<0||y>=MH)continue;
    if(m.explored[y][x])continue;
    if(los(m,m.px,m.py,x,y))m.explored[y][x]=true;
  }
}
