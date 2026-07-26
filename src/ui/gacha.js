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
/* ---- Heroes tab sub-tabs: Seekers / Collection ---- */
let activeHeroSub='heroesSeekers';
const HERO_SUBTABS=[
  {id:'heroesSeekers',tile:'pc_human',label:'Seekers'},
  {id:'heroesCollection',tile:'i_orb',label:'Collection'},
];
function renderHeroTabs(){
  const bar=$('heroTabs'); if(!bar)return;
  bar.innerHTML='';
  for(const st of HERO_SUBTABS){
    const b=document.createElement('button');
    b.className='fst'+(st.id===activeHeroSub?' active':'');
    b.innerHTML='<img src="'+tileURL(st.tile)+'" alt=""><span>'+t(st.label)+'</span>';
    b.onclick=()=>{sfx.ui();activeHeroSub=st.id;renderHeroTabs();};
    bar.appendChild(b);
  }
  for(const st of HERO_SUBTABS){const p=$(st.id);if(p)p.classList.toggle('shown',st.id===activeHeroSub);}
}

/* ---- combo detail: spend shards on stars, with an explanation of what stars do ---- */
function openCombo(ck){
  sfx.ui();
  const [r,c]=ck.split('/');
  const rar=comboRarity(r,c);
  const box=$('comboBox');
  const draw=()=>{
    const stars=save.stars[ck]||0,shards=save.shards[ck]||0,need=starNeed(stars);
    box.innerHTML=
      '<div class="sheetHead"><img src="'+tileURL(RACES[r].t)+'" class="pt">'+
      '<div><div class="nm rar'+rar+'">'+t(RACES[r].n)+' '+t(CLASSES[c].n)+'</div>'+
      '<div class="label">'+t(RARN[rar])+' · '+(starStr(stars)||t('no stars yet'))+'</div></div></div>'+
      '<div class="meta" style="font-size:10px;line-height:1.55;color:var(--dim);margin:6px 0 12px">'+
      t('Stars permanently strengthen every hero of this race and class — +8% damage and +8% HP per star, forever, kept through every prestige. Summoning a combo you already own turns into shards for it; spend them here to add stars.')+'</div>'+
      '<div class="kv"><span>'+t('Stars')+'</span><b class="rar'+rar+'">'+(starStr(stars)||'—')+'</b></div>'+
      '<div class="kv"><span>'+t('Current bonus')+'</span><b>+'+(stars*8)+'% '+t('damage & HP')+'</b></div>'+
      '<div class="kv"><span>'+t('Shards')+'</span><b>'+shards+' / '+need+'</b></div>'+
      '<button id="comboUp" class="blue" style="width:100%;margin-top:12px">★ '+t('Add a star')+' · '+need+' '+t('shards')+'</button>'+
      '<button id="comboClose" style="width:100%;margin-top:8px">'+t('Done')+'</button>';
    const up=$('comboUp'); up.disabled=shards<need;
    up.onclick=()=>{ save.shards[ck]-=need; save.stars[ck]=(save.stars[ck]||0)+1; sfx.leg(); persist(); draw(); renderGacha(); };
    $('comboClose').onclick=()=>{sfx.ui();$('combo').classList.remove('show')};
  };
  draw();
  $('combo').classList.add('show');
}
$('combo').addEventListener('click',e=>{if(e.target.id==='combo')$('combo').classList.remove('show')});

export function renderGacha(){
  renderHeroTabs();
  /* the collection: every summoned combo; tap one to spend shards on stars */
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
    const ready=row.shards>=row.need;
    const el=document.createElement('div');
    el.className='itemRow bord'+row.rar;el.style.cursor='pointer';
    el.innerHTML='<img src="'+tileURL(RACES[row.r].t)+'">'+
      '<div class="tInfo"><span class="rar'+row.rar+'">'+t(RACES[row.r].n)+' '+t(CLASSES[row.c].n)+'</span>'+
      ' <span class="label">'+starStr(row.stars)+'</span>'+
      '<div class="label">'+t('shards: ')+row.shards+'/'+row.need+
      (ready?' · <span style="color:var(--good)">'+t('★ ready')+'</span>':'')+'</div></div>'+
      '<span class="label" style="font-size:14px;color:'+(ready?'var(--gold)':'var(--dim)')+'">'+(ready?'★+':'›')+'</span>';
    el.onclick=()=>openCombo(row.ck);
    box.appendChild(el);
  }
  if(!rows.length)box.innerHTML='<div class="hint">'+t('Summon your first hero!')+'</div>';
}

