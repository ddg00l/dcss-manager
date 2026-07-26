import {$} from './dom.js';
import {save,persist} from '../core/state.js';
import {fmt} from '../core/fmt.js';
import {sfx} from './audio.js';
import {tileURL} from '../data/tiles.js';
import {t} from '../i18n/index.js';
import {cofferCost,cofferMem,cofferCount,PROVISIONS,provStacks,provCostOf,buyCoffer,buyProvision} from '../core/treasury.js';
/* ===================== treasury: gold sinks ===================== */

export function renderTreasury(){
  const box=$('treasuryBody');if(!box)return;
  box.innerHTML='';

  /* ---- Gozag Coffers: gold → Memory ---- */
  const cCost=cofferCost(save),cMem=cofferMem(save),afford=save.gold>=cCost;
  const coffer=document.createElement('div');
  coffer.className='card';
  coffer.innerHTML=
    '<div class="rowT"><img class="pt" src="'+tileURL('i_gold')+'" alt="">'+
    '<div><div class="nm" style="color:var(--gold)">'+t('Gozag\'s Coffers')+'</div>'+
    '<div class="sub">'+t('Pour surplus gold into eternal Memory')+'</div></div></div>'+
    '<div class="meta" style="font-size:10px;line-height:1.55;color:var(--dim)">'+
    t('Gold burns to nothing at prestige — here it becomes Memory 🕯 that survives every cycle. Each exchange this cycle costs double the last, so it drains a hoard without becoming a main source.')+'</div>'+
    '<div class="kv"><span>'+t('Exchanges this cycle')+'</span><b>'+cofferCount(save)+'</b></div>'+
    '<div class="kv"><span>'+t('You receive')+'</span><b style="color:var(--gold)">+'+fmt(cMem)+' 🕯</b></div>';
  const cBtn=document.createElement('button');
  cBtn.className='blue';cBtn.style.cssText='width:100%;margin-top:10px';
  cBtn.innerHTML=''+t('Exchange')+' · '+fmt(cCost)+' 🜚';
  cBtn.disabled=!afford;
  cBtn.onclick=()=>{const m=buyCoffer(save);if(m){sfx.coin();persist();if(window.__renderAll)window.__renderAll();else renderTreasury();}};
  coffer.appendChild(cBtn);
  box.appendChild(coffer);

  /* ---- Guild Provisions: per-cycle buffs, burned at prestige ---- */
  const h=document.createElement('h3');h.textContent=t('Guild Provisions');box.appendChild(h);
  const note=document.createElement('div');
  note.className='meta';note.style.cssText='font-size:10px;line-height:1.55;color:var(--dim);margin-bottom:8px';
  note.textContent=t('Temporary guild-wide boosts for this cycle only — they burn away at prestige, just like the gold that buys them. Each stack costs more than the last.');
  box.appendChild(note);
  for(const p of PROVISIONS){
    const st=provStacks(save,p.k),cost=provCostOf(save,p),maxed=st>=p.max,ok=save.gold>=cost&&!maxed;
    const el=document.createElement('div');
    el.className='card';
    el.innerHTML=
      '<div class="rowT"><img class="pt" src="'+tileURL(p.ico)+'" alt="">'+
      '<div><div class="nm">'+t(p.n)+' <span class="label">'+st+'/'+p.max+'</span></div>'+
      '<div class="sub">'+t(p.d)+'</div></div></div>'+
      '<div class="kv"><span>'+t('Active bonus')+'</span><b class="'+(st?'':'')+'" style="color:'+(st?'var(--good)':'var(--dim)')+'">+'+Math.round(p.per*st*100)+'%</b></div>';
    const b=document.createElement('button');
    b.style.cssText='width:100%;margin-top:10px';
    b.innerHTML=maxed?t('Fully stocked'):(t('Buy')+' · '+fmt(cost)+' 🜚');
    b.disabled=!ok;
    b.onclick=()=>{if(buyProvision(save,p.k)){sfx.coin();persist();if(window.__renderAll)window.__renderAll();else renderTreasury();}};
    el.appendChild(b);
    box.appendChild(el);
  }

  /* ---- pointer to the third sink, which lives per-hero ---- */
  const hint=document.createElement('div');
  hint.className='hint';hint.style.marginTop='12px';
  hint.innerHTML='🏛 '+t('Ziggurats: fund a camp hero from the Heroes tab for a deep, escalating-fee farm run.');
  box.appendChild(hint);
}
