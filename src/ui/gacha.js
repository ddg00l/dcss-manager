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
/* ===================== gacha ===================== */

export function doRoll(premium){
  const r=rollHero(save,premium);
  if(!r)return;
  if(r.kind==='dup'){
    revealGacha(r.res,t('Duplicate! +')+r.sh+t(' shards'));
    persist();renderGacha();updTop();
    return;
  }
  revealGacha(r.res,'');
  if(r.res.rarity===3)sfx.leg();else sfx.roll();
  persist();window.__renderAll&&window.__renderAll();
}
export function revealGacha(res,extra){
  const img=$('gachaResult').querySelector('img');
  img.src=tileURL(RACES[res.race].t);img.style.display='';
  img.className='revealAnim';
  const big=$('gachaResult').querySelector('.big');
  big.className='big rar'+res.rarity;
  big.textContent=t(RACES[res.race].n)+' '+t(CLASSES[res.cls].n);
  $('gachaResult').querySelector('.sub').innerHTML=
    '<span class="rar'+res.rarity+'">'+t(RARN[res.rarity])+'</span>'+
    (extra?' · '+extra:'')+'<br><span class="label">'+t(RACES[res.race].d)+' · '+t(CLASSES[res.cls].d)+'</span>';
  setTimeout(()=>img.className='',600);
}
$('btnRoll1').onclick=()=>doRoll(false);
$('btnRollRune').onclick=()=>doRoll(true);
export function renderGacha(){
  const free=freeRollAvailable(save);
  $('rollCost').textContent=free?t('FREE — the party has fallen'):fmt(rollCost(save));
  $('btnRoll1').disabled=!free&&save.gold<rollCost(save);
  $('btnRollRune').disabled=save.runes<1;
  $('pityTxt').textContent=t('Legendary guaranteed in: ')+(40-save.pity)+t(' summons · ')+
    t('Odds: 55/30/12/')+(3+3*zupg(save,'zluck'))+t('% (dark: 30/40/22/')+(8+3*zupg(save,'zluck'))+'%)';
  /* collection */
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

