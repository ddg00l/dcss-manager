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
import { openModal, playForgeReveal } from './reveal.js';
/* ===================== forge & armory ===================== */

const forgeCost=slot=>fCost(save,slot);
const forgeScrap=slot=>fScrap(slot);
/* armory filter/sort state (session-scoped) so a big roster stays manageable */
const armF={slot:'all',rar:'all',asc:false};
const SLOTN={weapon:'Weapon',armour:'Armour',shield:'Shield',ring:'Ring',amulet:'Amulet'};

/** the forge modal: pick a slot, then the item reveal plays in the window with
    Keep / Dismantle so junk can be scrapped on the spot */
export function openForgeModal(){ sfx.ui(); openModal(renderForgeChoices); }
function renderForgeChoices(box){
  box.innerHTML='<div class="gmTitle">'+t('Forge an item')+'</div>';
  const grid=document.createElement('div');grid.className='gmSlots';
  for(const [slot,nm] of [['weapon',t('Weapon')],['armour',t('Armour')],['shield',t('Shield')],['ring',t('Ring')],['amulet',t('Amulet')]]){
    const b=document.createElement('button');b.className='gmPick';
    b.innerHTML='<b>'+nm+'</b><span class="label">'+fmt(forgeCost(slot))+' 🜚 + '+forgeScrap(slot)+' ⚙</span>';
    b.disabled=save.gold<forgeCost(slot)||save.scrap<forgeScrap(slot);
    b.onclick=e=>{e.stopPropagation();forgeSlot(slot);};
    grid.appendChild(b);
  }
  box.appendChild(grid);
}
function forgeSlot(slot){
  const it=doForge(save,slot);
  if(!it)return;
  persist();renderForge();
  playForgeReveal(it,[
    {label:t('Keep'),cls:'blue',onClick:()=>{}},
    {label:'⚙ '+t('Dismantle')+' +'+(2+it.rar*2),cls:'danger',onClick:()=>{
      const i=save.armory.indexOf(it);if(i>=0)save.armory.splice(i,1);
      save.scrap+=2+it.rar*2;save.stat.dismantled++;sfx.coin();persist();renderForge();
    }},
  ]);
}
$('btnForge').onclick=openForgeModal;
export function renderForge(){
  /* the forge controls live in the modal now; the tab shows the armory */
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
  /* --- filter + sort bar so a large armory stays manageable on small screens --- */
  const chip=(html,active,onclick,extra)=>{
    const c=document.createElement('button');
    c.className='fchip'+(active?' on':'')+(extra||'');
    c.innerHTML=html;c.onclick=onclick;return c;
  };
  const match=it=>(armF.slot==='all'||it.slot===armF.slot)&&(armF.rar==='all'||it.rar===armF.rar);
  const shown=save.armory.filter(match).sort((a,b)=>armF.asc?a.rar-b.rar:b.rar-a.rar);
  const bar=document.createElement('div');bar.className='armBar';
  const rowT=document.createElement('div');rowT.className='chipRow';
  rowT.appendChild(chip(t('All'),armF.slot==='all',()=>{armF.slot='all';renderForge();}));
  for(const sl of ['weapon','armour','shield','ring','amulet'])
    rowT.appendChild(chip(t(SLOTN[sl]),armF.slot===sl,()=>{armF.slot=sl;renderForge();}));
  const rowR=document.createElement('div');rowR.className='chipRow';
  rowR.appendChild(chip(t('All'),armF.rar==='all',()=>{armF.rar='all';renderForge();}));
  for(let r=RARN.length-1;r>=0;r--)
    rowR.appendChild(chip(t(RARN[r]),armF.rar===r,()=>{armF.rar=r;renderForge();},' rar'+r));
  const rowA=document.createElement('div');rowA.className='chipRow';
  rowA.appendChild(chip((armF.asc?'▲ ':'▼ ')+t('Rarity'),false,()=>{armF.asc=!armF.asc;renderForge();}));
  if(shown.length)rowA.appendChild(chip('⚙ '+t('Dismantle all shown')+' ('+shown.length+')',false,()=>{
    if(!confirm(t('Dismantle all {n} shown items for scrap?',{n:shown.length})))return;
    let sc=0;for(const it of shown){sc+=2+it.rar*2;const i=save.armory.indexOf(it);if(i>=0)save.armory.splice(i,1);save.stat.dismantled++;}
    save.scrap+=sc;sfx.coin();persist();renderForge();
  },' danger'));
  bar.appendChild(rowT);bar.appendChild(rowR);bar.appendChild(rowA);
  box.appendChild(bar);
  /* unequipped, filtered + sorted */
  header(t('Unequipped (')+shown.length+(shown.length!==save.armory.length?' / '+save.armory.length:'')+')');
  for(const it of shown.slice(0,80))itemRow(it,null);
  if(shown.length>80)header('⋯ +'+(shown.length-80));
  if(!save.armory.length)box.innerHTML+='<div class="hint">'+t('No unequipped items — forge some or wait for dungeon finds.')+'</div>';
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

