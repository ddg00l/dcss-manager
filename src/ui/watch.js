import {$} from './dom.js';
import {save,persist} from '../core/state.js';
import {fmt,clamp} from '../core/fmt.js';
import {sfx} from './audio.js';
import {tileURL,tileImg} from '../data/tiles.js';
import {RACES} from '../data/races.js';
import {CLASSES} from '../data/classes.js';
import {GODS} from '../data/gods.js';
import {BRANCHES,brTag} from '../data/branches.js';
import {itemName,itemTile,randomItem,itemInfo} from '../data/items.js';
import {consTile} from '../data/consumables.js';
import {PORTALS} from '../data/portals.js';

import {heroStats} from '../sim/hero.js';
import {MW,MH,los,FOV_R} from '../sim/mapgen.js';
import {stackHTML,heroLayers} from './portrait.js';
import {comboKey,RARN} from '../data/combos.js';
import { t } from '../i18n/index.js';
import {todayAffix} from '../data/affixes.js';
import {ELITE_AFFIXES,FLOOR_AFFIXES} from '../data/eliteAffixes.js';
/* ===================== watch view ===================== */
export let watchId=null;
export function setWatch(id){watchId=id;renderChips()}
const wcv=$('watchCv'),wctx=wcv.getContext('2d');
const TILE=26;
/* draws a tile cell-sized; tall DCSS tiles (32x48) keep aspect, anchored to the cell bottom */
function drawTile(k,x,y){
  const im=tileImg(k);
  const r=im.naturalWidth?im.naturalHeight/im.naturalWidth:1;
  if(r>1.2)wctx.drawImage(im,x,y-TILE*(r-1),TILE,TILE*r);
  else wctx.drawImage(im,x,y,TILE,TILE);
}
export function watchHero(){
  const runs=save.heroes.filter(h=>h.state==='run');
  if(watchId){const h=save.heroes.find(x=>x.id===watchId);
    if(h&&h.state==='run')return h;
    if(h&&(h.state==='dead'||h.state==='victor'))return h;}
  return runs[0]||save.heroes.find(h=>h.log.length)||null;
}
export function renderChips(){
  const box=$('watchChips');box.innerHTML='';
  for(const h of save.heroes.filter(x=>x.state==='run'||x.state==='camp')){
    const el=document.createElement('div');
    el.className='chip'+(watchHero()===h?' sel':'')+(h.state!=='run'?' dead':'');
    el.innerHTML=stackHTML(h,'sm')+'<span>'+h.name+
      '<br><span class="label">'+(h.state==='run'?brTag(h):t('camp'))+'</span></span>';
    el.onclick=()=>{setWatch(h.id)};
    box.appendChild(el);
  }
  if(!save.heroes.length)
    box.innerHTML='<div class="hint">'+t("Summon a hero in the Heroes tab — they'll head into the dungeon on their own.")+'</div>';
}
let lastLogLen=0,lastLogHero=null;
export function renderWatch(){
  const h=watchHero();
  if(!h||!h.map){wctx.fillStyle='#000';wctx.fillRect(0,0,wcv.width,wcv.height);return}
  const m=h.map;
  const br=BRANCHES[h.branch];
  /* mobile camera: narrow screen → viewport around the hero with large tiles */
  const cw=wcv.clientWidth||wcv.parentElement.clientWidth||600;
  const mobile=cw<560;
  const VW=mobile?15:MW, VH=mobile?12:MH;
  const ox=mobile?clamp(m.px-(VW>>1),0,MW-VW):0;
  const oy=mobile?clamp(m.py-(VH>>1),0,MH-VH):0;
  if(wcv.width!==VW*TILE||wcv.height!==VH*TILE){wcv.width=VW*TILE;wcv.height=VH*TILE}
  const X=x=>(x-ox)*TILE, Y=y=>(y-oy)*TILE;
  const inV=(x,y)=>x>=ox&&x<ox+VW&&y>=oy&&y<oy+VH;
  wctx.fillStyle='#050608';wctx.fillRect(0,0,wcv.width,wcv.height);
  for(let y=oy;y<oy+VH;y++)for(let x=ox;x<ox+VW;x++){
    if(!m.explored[y][x])continue;
    if(m.g[y][x]===1)wctx.drawImage(tileImg(br.wall),X(x),Y(y),TILE,TILE);
    else wctx.drawImage(tileImg((x+y)%2?br.floor:br.floor2),X(x),Y(y),TILE,TILE);
  }
  /* DCSS-style: cells out of current line of sight are dimmed «memory» */
  wctx.fillStyle='rgba(5,6,8,.45)';
  for(let y=oy;y<oy+VH;y++)for(let x=ox;x<ox+VW;x++){
    if(!m.explored[y][x])continue;
    const dx=x-m.px,dy=y-m.py;
    const visible=dx*dx+dy*dy<=FOV_R*FOV_R+2&&los(m,m.px,m.py,x,y);
    if(!visible)wctx.fillRect(X(x),Y(y),TILE,TILE);
  }
  /* items */
  for(const it of m.items){
    if(!inV(it.x,it.y)||!m.explored[it.y][it.x])continue;
    const t=it.kind==='gold'?'i_gold':
      it.kind==='cons'?consTile(it.c):
      it.kind==='item'?(it.it?itemTile(it.it):'i_scroll'):it.kind==='orb'?'i_orb':
      it.kind==='key'?'i_key':
      it.kind==='shop'?('sh_'+it.stype):
      it.kind==='portal'?PORTALS[it.ptype].t:
      it.kind==='abyss_exit'?'p_abyss_exit':
      it.kind==='altar'?(GODS[it.god]?GODS[it.god].alt:'d_altar'):'i_scroll';
    wctx.drawImage(tileImg(t),X(it.x),Y(it.y),TILE,TILE);
  }
  /* traps (spotted) and clouds */
  if(m.traps)for(const tr of m.traps){
    if(!tr.seen||tr.done||!inV(tr.x,tr.y)||!m.explored[tr.y][tr.x])continue;
    wctx.drawImage(tileImg('tr_'+tr.kind),X(tr.x),Y(tr.y),TILE,TILE);
  }
  if(m.clouds)for(const cl of m.clouds){
    if(!inV(cl.x,cl.y)||!m.explored[cl.y][cl.x])continue;
    wctx.globalAlpha=.75;
    wctx.drawImage(tileImg('cl_'+cl.kind),X(cl.x),Y(cl.y),TILE,TILE);
    wctx.globalAlpha=1;
  }
  /* stairs */
  if(inV(m.stairs.x,m.stairs.y)&&m.explored[m.stairs.y][m.stairs.x])
    wctx.drawImage(tileImg('d_stairs_down'),X(m.stairs.x),Y(m.stairs.y),TILE,TILE);
  /* monsters */
  for(const mo of m.monsters){
    if(!inV(mo.x,mo.y)||!m.explored[mo.y][mo.x])continue;
    drawTile(mo.t,X(mo.x),Y(mo.y));
    if(mo.hp<mo.maxHp){
      wctx.fillStyle='#300';wctx.fillRect(X(mo.x)+2,Y(mo.y)-3,TILE-4,3);
      wctx.fillStyle='#c94f43';
      wctx.fillRect(X(mo.x)+2,Y(mo.y)-3,(TILE-4)*clamp(mo.hp/mo.maxHp,0,1),3);
    }
    if(mo.eliteAf&&mo.eliteAf.length){
      wctx.strokeStyle=ELITE_AFFIXES[mo.eliteAf[0]].col;wctx.lineWidth=2;
      wctx.strokeRect(X(mo.x)+1,Y(mo.y)+1,TILE-2,TILE-2);
      if(mo.eliteAf.length>1){
        wctx.strokeStyle=ELITE_AFFIXES[mo.eliteAf[1]].col;wctx.lineWidth=1;
        wctx.strokeRect(X(mo.x)+3,Y(mo.y)+3,TILE-6,TILE-6);
      }
    }else if(mo.uniq||mo.boss){
      wctx.strokeStyle='#e0a03c';wctx.lineWidth=1.5;
      wctx.strokeRect(X(mo.x)+1,Y(mo.y)+1,TILE-2,TILE-2);
    }
  }
  /* allies */
  if(m.allies)for(const a of m.allies){
    if(!inV(a.x,a.y))continue;
    drawTile(a.t,X(a.x),Y(a.y));
    wctx.strokeStyle='#7bc470';wctx.lineWidth=1.5;
    wctx.strokeRect(X(a.x)+1,Y(a.y)+1,TILE-2,TILE-2);
    if(a.hp<a.maxHp){
      wctx.fillStyle='#031';wctx.fillRect(X(a.x)+2,Y(a.y)-3,TILE-4,3);
      wctx.fillStyle='#7bc470';
      wctx.fillRect(X(a.x)+2,Y(a.y)-3,(TILE-4)*clamp(a.hp/a.maxHp,0,1),3);
    }
  }
  /* hero */
  if(h.state==='run'){
    for(const layer of heroLayers(h))
      wctx.drawImage(tileImg(layer),X(m.px),Y(m.py),TILE,TILE);
    wctx.strokeStyle='#ecc95e';wctx.lineWidth=1;
    wctx.strokeRect(X(m.px)+.5,Y(m.py)+.5,TILE-1,TILE-1);
  }else{
    wctx.fillStyle='#c94f43';wctx.font='16px monospace';
    wctx.fillText(h.state==='dead'?'☠':'🏆',X(m.px)+5,Y(m.py)+18);
  }
  /* info line */
  const st=heroStats(h,save);
  const hpc=clamp((h.curHp||0)/h.maxHpCache*100,0,100);
  /* stable DOM: build once, update values per frame (innerHTML would kill taps mid-click) */
  if(!$('wiName')){
    $('watchInfo').innerHTML=
      '<div class="wiRow"><b id="wiName"></b> <span class="label" id="wiMeta"></span></div>'+
      '<div class="wiRow"><div class="bar"><div id="wiHp" style="background:#c94f43"></div></div>'+
      '<span class="label" id="wiStats"></span>'+
      '<button id="wSheetBtn">Status</button></div>';
  }
  const nameEl=$('wiName');
  nameEl.className='rar'+h.rarity;
  nameEl.textContent=h.name;
  $('wiMeta').textContent=t(RACES[h.race].n)+' '+t(CLASSES[h.cls].n)+' XL'+h.xl+' · '+brTag(h)+(h.map&&h.map.elite?t(' · ELITE'):'')+
    (h.god?' · ✧'+t(GODS[h.god].n):'')+' · '+t(todayAffix().n)+
    (h.map&&h.map.fafx?' · \u2b51'+t(FLOOR_AFFIXES[h.map.fafx].n):'')+t(' · turn ')+h.turn;
  $('wiHp').style.width=hpc+'%';
  const invN=Object.values(h.inv||{}).reduce((a,b)=>a+b,0);
  const stIcons=[h.status.haste>0?'⚡':'',h.status.might>0?'💪':'',h.status.berserk>0?'🔥':'',
    h.poison?'☠':'',h.status.net>0?'🕸':'',h.banished?'🌀':''].join('');
  $('wiStats').textContent=Math.ceil(h.curHp||0)+'/'+h.maxHpCache+' HP · 🧪'+invN+
    ' · 💰'+fmt(h.gold||0)+' · ᚱ'+h.runes.length+(stIcons?' · '+stIcons:'');
  $('wSheetBtn').textContent=t('Status');
  $('wSheetBtn').onclick=()=>window.__openSheet(h.id);
  /* log: append-only so a burst of lines never rebuilds all 40 (which thrashes
     the DOM and lets the text paint fall a frame behind the canvas). Only the
     lines added since last frame are inserted; the list is trimmed to 40; and
     the view auto-scrolls only when the reader is already at the bottom, so
     scrolling up to read a fight is never yanked back down. */
  const fmtLine=e=>'<div class="lg-'+e.cls+'"><span class="t">['+e.t+']</span>'+e.txt+'</div>';
  const lg=$('wlog');
  const seq=h.logSeq||0;
  if(lastLogHero!==h.id){
    lastLogHero=h.id;lastLogLen=seq;
    lg.innerHTML=h.log.slice(-40).map(fmtLine).join('');
    lg.scrollTop=lg.scrollHeight;
  }else if(seq!==lastLogLen){
    const added=Math.min(seq-lastLogLen,h.log.length);
    lastLogLen=seq;
    const atBottom=lg.scrollHeight-lg.scrollTop-lg.clientHeight<24;
    if(added>=40){
      lg.innerHTML=h.log.slice(-40).map(fmtLine).join('');
    }else{
      lg.insertAdjacentHTML('beforeend',h.log.slice(-added).map(fmtLine).join(''));
      while(lg.children.length>40)lg.removeChild(lg.firstChild);
    }
    if(atBottom)lg.scrollTop=lg.scrollHeight;
  }
}

