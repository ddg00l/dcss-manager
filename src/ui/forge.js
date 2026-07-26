import {$} from './dom.js';
import {save,persist} from '../core/state.js';
import {fmt,clamp} from '../core/fmt.js';
import {sfx} from './audio.js';
import {tileURL,tileImg} from '../data/tiles.js';
import {RACES} from '../data/races.js';
import {CLASSES} from '../data/classes.js';
import {GODS} from '../data/gods.js';
import {BRANCHES,brTag} from '../data/branches.js';
import {itemName,itemTile,randomItem,itemInfo,doForge,forgeCost as fCost,forgeScrap as fScrap} from '../data/items.js';
import {forgeDisc} from '../core/economy.js';
import {memEff} from '../data/memtree.js';
import {heroStats} from '../sim/hero.js';
import {MW,MH} from '../sim/mapgen.js';
import {comboKey,RARN} from '../data/combos.js';
import { t } from '../i18n/index.js';
/* ===================== forge & armory ===================== */

const forgeCost=slot=>fCost(save,slot);
const forgeScrap=slot=>fScrap(slot);
export function renderForge(){
  const btns=$('forgeBtns');btns.innerHTML='';
  for(const [slot,nm] of [['weapon',t('Weapon')],['armour',t('Armour')],['shield',t('Shield')],['ring',t('Ring')],['amulet',t('Amulet')]]){
    const b=document.createElement('button');
    b.innerHTML=nm+'<br><span class="label">'+fmt(forgeCost(slot))+'🜚 + '+forgeScrap(slot)+'⚙</span>';
    b.disabled=save.gold<forgeCost(slot)||save.scrap<forgeScrap(slot);
    b.onclick=()=>{
      const it=doForge(save,slot);
      if(!it)return;
      sfx.forge();
      $('forgeResult').innerHTML='<div class="itemRow bord'+it.rar+'" style="margin-top:8px">'+
        '<img src="'+tileURL(itemTile(it))+'" class="revealAnim">'+
        '<div class="tInfo"><span class="rar'+it.rar+'">'+itemName(it)+'</span>'+
        '<div class="label">'+t(RARN[it.rar])+(it.rand?t(' · RANDART'):'')+'</div></div></div>';
      persist();renderForge();updTop();
    };
    btns.appendChild(b);
  }
  /* armory */
  const box=$('armoryList');box.innerHTML='';
  const header=txt=>{
    const hd=document.createElement('div');
    hd.className='label';
    hd.style.cssText='margin:10px 0 6px;letter-spacing:.14em';
    hd.innerHTML=txt;
    box.appendChild(hd);
  };
  const itemRow=(it,wearer)=>{
    const el=document.createElement('div');
    el.className='itemRow bord'+it.rar;
    el.innerHTML='<img src="'+tileURL(itemTile(it))+'">'+
      '<div class="tInfo"><span class="rar'+it.rar+'">'+itemName(it)+'</span>'+
      '<div class="label">'+it.slot+(it.rand?t(' · randart'):'')+
      (wearer?' · <span style="color:var(--rare)">'+t('⚔ worn by: ')+wearer.name+'</span>':'')+
      '</div></div>';
    if(wearer){
      const b=document.createElement('button');
      b.className='blue';
      b.textContent=t('Equipment');
      b.onclick=()=>window.__openEquip(wearer.id);
      el.appendChild(b);
    }else{
      const d=document.createElement('button');
      d.textContent='⚙+'+(2+it.rar*2);
      d.title=t('Dismantle');
      d.onclick=()=>{
        save.scrap+=2+it.rar*2;
        save.stat.dismantled++;
        save.armory.splice(save.armory.indexOf(it),1);
        sfx.coin();persist();renderForge();updTop();
      };
      el.appendChild(d);
    }
    box.appendChild(el);
  };
  /* unequipped first, sorted by rarity */
  const sorted=[...save.armory].sort((a,b)=>b.rar-a.rar);
  header(t('Unequipped (')+sorted.length+')');
  for(const it of sorted.slice(0,60))itemRow(it,null);
  if(!sorted.length)box.innerHTML+='<div class="hint">'+t('No unequipped items — forge some or wait for dungeon finds.')+'</div>';
  /* then worn items, grouped by hero */
  for(const hh of save.heroes){
    if(hh.state==='dead'||hh.state==='victor')continue;
    const worn=Object.values(hh.gear).filter(Boolean);
    if(!worn.length)continue;
    header('<span class="rar'+hh.rarity+'">'+hh.name+'</span> — '+
      t(RACES[hh.race].n)+' '+t(CLASSES[hh.cls].n));
    for(const it of worn.sort((a,b)=>b.rar-a.rar))itemRow(it,hh);
  }
}

