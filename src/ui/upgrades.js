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
import {ZUPGRADES,zupg,zupgCost,fameMul} from '../core/economy.js';
import {heroStats} from '../sim/hero.js';
import {MW,MH} from '../sim/mapgen.js';
import {comboKey,RARN} from '../data/combos.js';
import { t } from '../i18n/index.js';
/* ===================== upgrades & fame ===================== */
export function renderFame(){
  const wins=save.fame.filter(f=>f.won).length;
  $('fameSummary').innerHTML='<div class="card"><div class="nm" style="color:var(--gold)">'+t('Hall of Fame')+'</div>'+
    '<div class="meta">'+t('Victories: ')+wins+t(' → all heroes gain +')+Math.round((fameMul(save)-1)*100)+t('% damage and HP<br>')+
    t('Zot essence: ')+save.zot+t(' ⚛ · Total runes collected: ')+save.runesTotal+'</div></div>';
  const zbox=$('zotUpgList');zbox.innerHTML='';
  for(const u of ZUPGRADES){
    const lv=zupg(save,u.k),cost=zupgCost(save,u),maxed=lv>=u.max;
    const el=document.createElement('div');
    el.className='upgRow';
    el.innerHTML='<div class="tInfo"><div class="nm">'+t(u.n)+'</div><div class="ds">'+t(u.d)+
      '</div><div class="lv">'+t('lvl ')+lv+(maxed?' · MAX':'')+'</div></div>';
    const b=document.createElement('button');
    b.className='blue';
    b.textContent=maxed?'MAX':cost+' ⚛';
    b.disabled=maxed||save.zot<cost;
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

