import {$} from './dom.js';
import {save,persist} from '../core/state.js';
import {fmt,clamp} from '../core/fmt.js';
import {sfx} from './audio.js';
import {tileURL,tileImg} from '../data/tiles.js';
import {RACES} from '../data/races.js';
import {CLASSES} from '../data/classes.js';
import {comboKey,comboRarity,RARN,SHARDS_PER,starNeed,starStr} from '../data/combos.js';
import {GODS} from '../data/gods.js';
import {BRANCHES,brTag} from '../data/branches.js';
import {itemName,itemTile,randomItem,itemInfo} from '../data/items.js';
import {zupg,maxSlots,rollCost,PITY_AT,rollCombo,pickComboOfTier,shardMul as shardMulF,freeRollAvailable,effectiveRollCost} from '../core/economy.js';
import {newHero,heroStats,rollHero} from '../sim/hero.js';
import {startRun,tryAutoEquip} from '../sim/tick.js';
import { t } from '../i18n/index.js';
import { openModal, playSummonReveal } from './reveal.js';
import { darkSummonUnlocked } from '../core/ftue.js';
/* ===================== gacha ===================== */

const pityText=()=>t('Legendary guaranteed in: ')+(40-save.pity)+t(' summons · ')+
  t('Odds: 55/30/12/')+(3+3*zupg(save,'zluck'))+t('% (dark: 30/40/22/')+(8+3*zupg(save,'zluck'))+'%)';

/** the summon modal: pick a summon type, then the reveal plays in the window */
export function openSummonModal(){ sfx.ui(); openModal(renderSummonChoices); }
function renderSummonChoices(box){
  const free=freeRollAvailable(save);
  box.innerHTML='<div class="gmTitle">'+t('Summon a Seeker')+'</div>'+
    '<div class="gmOdds label">'+pityText()+'</div>';
  const b1=document.createElement('button');
  b1.className='gmPick';
  b1.innerHTML='<span class="gmPickL"><img class="gmPickIco" src="'+tileURL('pc_minotaur')+'" alt=""><b>'+t('Summon')+'</b></span><span class="label">'+(free?t('FREE — the party has fallen'):fmt(rollCost(save))+' 🜚')+'</span>';
  b1.disabled=!free&&save.gold<rollCost(save);
  b1.onclick=e=>{e.stopPropagation();doRoll(false);};
  box.appendChild(b1);
  if(darkSummonUnlocked(save)){
    const b2=document.createElement('button');
    b2.className='gmPick purple';
    b2.innerHTML='<span class="gmPickL"><img class="gmPickIco" src="'+tileURL('i_rune')+'" alt=""><b>'+t('Dark summon')+'</b></span><span class="label">1 ᚱ</span>';
    b2.disabled=save.runes<1;
    b2.onclick=e=>{e.stopPropagation();doRoll(true);};
    box.appendChild(b2);
  }
}
export function doRoll(premium){
  const r=rollHero(save,premium);
  if(!r)return;
  const extra=r.kind==='dup'?(t('Duplicate! +')+r.sh+t(' shards')):'';
  playSummonReveal(r.res,extra);  /* reveal plays in the modal; returns to the picker */
  persist();
  if(window.__renderAll)window.__renderAll();
}
$('btnSummon').onclick=openSummonModal;
export function renderGacha(){
  /* the summon controls live in the modal now; the tab shows the collection */
  const box=$('comboList');box.innerHTML='';
  const rows=[];
  for(const ck of Object.keys(save.seen)){
    const [r,c]=ck.split('/');
    const rar=comboRarity(r,c);
    const stars=save.stars[ck]||0,shards=save.shards[ck]||0;
    const need=starNeed(stars);
    rows.push({ck,r,c,rar,stars,shards,need});
  }
  rows.sort((a,b)=>b.rar-a.rar);
  for(const row of rows){
    const el=document.createElement('div');
    el.className='itemRow bord'+row.rar;
    el.innerHTML='<img src="'+tileURL(RACES[row.r].t)+'">'+
      '<div class="tInfo"><span class="rar'+row.rar+'">'+t(RACES[row.r].n)+' '+t(CLASSES[row.c].n)+'</span>'+
      ' <span class="label">'+starStr(row.stars)+'</span>'+
      '<div class="label">'+t('shards: ')+row.shards+'/'+row.need+t(' · star: +8% damage and HP')+'</div></div>';
    const btn=document.createElement('button');
    btn.textContent='★+';
    btn.disabled=row.shards<row.need;
    btn.onclick=()=>{
      save.shards[row.ck]-=row.need;
      save.stars[row.ck]=(save.stars[row.ck]||0)+1;
      sfx.leg();persist();renderGacha();
    };
    el.appendChild(btn);
    box.appendChild(el);
  }
  if(!rows.length)box.innerHTML='<div class="hint">'+t('Summon your first hero!')+'</div>';
}

