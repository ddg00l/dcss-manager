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
import {ZUPGRADES,zupg,zupgCost,zupgCap,fameMul} from '../core/economy.js';
import {heroStats} from '../sim/hero.js';
import {MW,MH} from '../sim/mapgen.js';
import {comboKey,RARN} from '../data/combos.js';
import { t } from '../i18n/index.js';
import {PUPGRADES,pupg,pupgCost,ngLevel,legendsReward,canPrestige,doPrestige,cycleProgress,prestigeReq} from '../core/prestige.js';
/* ===================== upgrades & fame ===================== */
export function renderFame(){
  const wins=(save.stat&&save.stat.wins)||0;
  $('fameSummary').innerHTML='<div class="card"><div class="nm" style="color:var(--gold)">'+t('Hall of Fame')+'</div>'+
    '<div class="meta">'+t('Victories: ')+wins+t(' → all heroes gain +')+Math.round((fameMul(save)-1)*100)+t('% damage and HP<br>')+
    t('Zot essence: ')+save.zot+t(' ⚛ · Total runes collected: ')+save.runesTotal+'</div></div>';
  /* prestige: NG+ level, cycle reward preview, Legends shop */
  const pr=$('prestigeBox');
  if(pr){
    pr.innerHTML='';
    const card=document.createElement('div');
    card.className='card';
    const cyc=cycleProgress(save);
    const reward=legendsReward(save);
    card.innerHTML='<div class="nm" style="color:var(--epic)">'+t('Prestige')+
      (ngLevel(save)>0?' · NG+'+ngLevel(save):'')+'</div>'+
      '<div class="meta">'+t('Legends: ')+(save.legends||0)+' ⚜ · '+
      t('cycle: ')+cyc.wins+' 🏆 · '+cyc.runes+' ᚱ · '+cyc.uniq+' ⚔</div>'+
      '<div class="label">'+t('Prestige resets heroes, armory, currencies and the small nodes of the Memory tree. Keystones, the Hall of Fame, the collection, unrands and zot upgrades remain. Each prestige raises NG+: monsters and rewards grow.')+'</div>';
    const pb=document.createElement('button');
    pb.className='blue';
    pb.style.marginTop='8px';
    pb.textContent=canPrestige(save)?(t('Prestige now: +')+reward+' ⚜'):
      t('Prestige needs {n} victories this cycle ({w} so far)',{n:prestigeReq(save),w:cyc.wins});
    pb.disabled=!canPrestige(save);
    pb.onclick=()=>{
      if(!confirm(t('Prestige now: +')+reward+' ⚜? '+t('Prestige resets heroes, armory, currencies and the small nodes of the Memory tree. Keystones, the Hall of Fame, the collection, unrands and zot upgrades remain. Each prestige raises NG+: monsters and rewards grow.')))return;
      doPrestige(save);
      sfx.win();persist();window.__renderAll();updTop();
    };
    card.appendChild(pb);
    pr.appendChild(card);
    for(const u of PUPGRADES){
      const lv=pupg(save,u.k),cost=pupgCost(save,u),maxed=lv>=u.max;
      const el=document.createElement('div');
      el.className='upgRow';
      el.innerHTML='<div class="tInfo"><div class="nm">'+t(u.n)+'</div><div class="ds">'+t(u.d)+
        '</div><div class="lv">'+t('lvl ')+lv+(maxed?' · MAX':'')+'</div></div>';
      const b=document.createElement('button');
      b.className='blue';
      b.textContent=maxed?'MAX':cost+' ⚜';
      b.disabled=maxed||(save.legends||0)<cost;
      b.onclick=()=>{save.legends-=cost;save.pupg[u.k]=lv+1;sfx.leg();persist();renderFame();updTop()};
      el.appendChild(b);
      pr.appendChild(el);
    }
  }
  const zbox=$('zotUpgList');zbox.innerHTML='';
  for(const u of ZUPGRADES){
    const lv=zupg(save,u.k),cost=zupgCost(save,u),cap=zupgCap(save,u),maxed=lv>=u.max,locked=!maxed&&lv>=cap;
    const el=document.createElement('div');
    el.className='upgRow';
    el.innerHTML='<div class="tInfo"><div class="nm">'+t(u.n)+'</div><div class="ds">'+t(u.d)+
      '</div><div class="lv">'+t('lvl ')+lv+(maxed?' · MAX':'')+'</div></div>';
    const b=document.createElement('button');
    b.className='blue';
    b.textContent=maxed?'MAX':locked?t('requires prestige'):cost+' ⚛';
    b.disabled=maxed||locked||save.zot<cost;
    b.onclick=()=>{save.zot-=cost;save.zupg[u.k]=lv+1;sfx.leg();persist();renderFame();updTop()};
    el.appendChild(b);
    zbox.appendChild(el);
  }
  const box=$('fameList');box.innerHTML='';
  for(const f of save.fame.slice(0,25)){
    const el=document.createElement('div');
    el.className='itemRow '+(f.won?'bord3':'bord0');
    el.innerHTML='<img src="'+tileURL(RACES[f.race].t)+'">'+
      '<div class="tInfo"><span class="'+(f.won?'rar3':'rar0')+'">'+
      (f.won?'🏆 ':'☠ ')+f.name+'</span> <span class="label">'+t(RACES[f.race].n)+' '+t(CLASSES[f.cls].n)+
      ' · XL'+f.xl+' · ᚱ'+f.runes+'</span>'+
      '<div class="label">'+(f.won?t('carried out the Orb of Zot!'):f.depth+t(' — slain by: ')+f.by)+'</div></div>';
    box.appendChild(el);
  }
  if(!save.fame.length)box.innerHTML='<div class="hint">'+t("No one has died or triumphed yet. It's all ahead.")+'</div>';
}

