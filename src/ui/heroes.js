import {$} from './dom.js';
import {save,persist} from '../core/state.js';
import {fmt,clamp} from '../core/fmt.js';
import {sfx} from './audio.js';
import {tileURL,tileImg} from '../data/tiles.js';
import {RACES} from '../data/races.js';
import {CLASSES} from '../data/classes.js';
import {comboKey,comboRarity,RARN,SHARDS_PER,starStr} from '../data/combos.js';
import {GODS} from '../data/gods.js';
import {BRANCHES,brTag,ROAD_KEYS,ROAD_INFO,roadOf,roadRunes} from '../data/branches.js';
import {itemName,itemTile,randomItem,itemInfo} from '../data/items.js';
import {maxSlots} from '../core/economy.js';
import {memHas} from '../data/memtree.js';
import {newHero,heroStats} from '../sim/hero.js';
import {startRun,tryAutoEquip,recallHero,fundZiggurat} from '../sim/tick.js';
import {zigFee} from '../core/treasury.js';
import {stackHTML} from './portrait.js';
import { t } from '../i18n/index.js';
/* ===================== heroes pane ===================== */
export function renderHeroes(){
  const box=$('heroList');box.innerHTML='';
  const heroes=save.heroes.filter(h=>h.state!=='dead'&&h.state!=='victor')
    .sort((a,b)=>(b.state==='run')-(a.state==='run')); /* delving heroes first, then camp */
  for(const h of heroes){
    const st=heroStats(h,save);
    const el=document.createElement('div');
    el.className='card bord'+h.rarity;
    const ck=comboKey(h.race,h.cls);
    el.innerHTML='<div class="rowT">'+stackHTML(h)+
      '<div><div class="nm rar'+h.rarity+'">'+h.name+' <span class="label">'+starStr(save.stars[ck]||0)+'</span></div>'+
      '<div class="sub">'+t(RACES[h.race].n)+' '+t(CLASSES[h.cls].n)+' · XL '+h.xl+' · '+
      (h.state==='run'?brTag(h):t('in camp'))+'</div></div></div>'+
      '<div class="meta">HP '+Math.ceil(h.curHp||st.hpMax)+'/'+st.hpMax+' · '+t('damage ')+Math.floor(st.dmg)+
      ' · AC '+Math.floor(st.ac)+' · EV '+Math.floor(st.ev)+
      (h.god?' · ✧'+t(GODS[h.god].n):'')+
      (h.runes.length?' · ᚱ'+h.runes.length:'')+'</div>';
    /* gear */
    const gearRow=document.createElement('div');
    gearRow.className='meta';
    const gearTxt=[];
    for(const slot of ['weapon','armour','shield','ring1','ring2','amulet']){
      const it=h.gear[slot];
      if(it)gearTxt.push(itemName(it));
    }
    gearRow.textContent=t('Gear: ')+(gearTxt.join(', ')||'—');
    el.appendChild(gearRow);
    /* strategy selects */
    const selS=document.createElement('select');
    /* The roads differ in what they YIELD, not in how fast they run, so the option
       has to say what it yields — otherwise the player is picking a word. */
    const routes=ROAD_KEYS.map(k=>[k,t('Route: ')+t(ROAD_INFO[k].n)+' — '+t(ROAD_INFO[k].yield)]);
    if(memHas(save,'k_abyss'))routes.push(['abyss',t('Route: the Abyss — endless farming, no Orb')]);
    for(const [v,n] of routes){
      const o=document.createElement('option');o.value=v;o.textContent=n;
      if(ROAD_INFO[v])o.title=t('Runes on this road: ')+roadRunes(v).map(r=>t(r)).join(' · ');
      selS.appendChild(o)}
    selS.value=roadOf(h.strategy);
    selS.onchange=()=>{h.strategy=selS.value;persist()};
    selS.dataset.ftue='strategy';
    el.appendChild(selS);
    const selC=document.createElement('select');
    for(const [v,n] of [['cautious',t('Caution: cowardly (potions at 45% HP)')],
      ['normal',t('Caution: normal (30%)')],['bold',t('Caution: reckless (15%)')]]){
      const o=document.createElement('option');o.value=v;o.textContent=n;selC.appendChild(o)}
    selC.value=h.caution;
    selC.onchange=()=>{h.caution=selC.value;persist()};
    selC.dataset.ftue='caution';
    el.appendChild(selC);
    const selP=document.createElement('select');
    for(const [v,n] of [['thrifty',t('Spending: thrifty (30% of wallet)')],
      ['balanced',t('Spending: balanced (60%)')],['lavish',t('Spending: lavish (everything at the shop)')]]){
      const o=document.createElement('option');o.value=v;o.textContent=n;selP.appendChild(o)}
    selP.value=h.spend||'balanced';
    selP.onchange=()=>{h.spend=selP.value;persist()};
    selP.dataset.ftue='spend';
    el.appendChild(selP);
    const row=document.createElement('div');row.className='rowBtns';
    if(h.state==='camp'){
      const runB=document.createElement('button');
      const slots=save.heroes.filter(x=>x.state==='run').length;
      const full=slots>=maxSlots(save);
      runB.textContent=full?(t('Slots full (')+slots+'/'+maxSlots(save)+')'):(t('Delve (')+slots+'/'+maxSlots(save)+')');
      runB.disabled=full;
      runB.title=full?t('More slots: 🕯 Memory → Heroes region → “2nd seeker”'):'';
      runB.dataset.ftue='dispatch';
      runB.onclick=()=>{startRun(h,save);sfx.ui();persist();window.__renderAll()};
      row.appendChild(runB);
      /* Ziggurat funding: a paid, escalating deep-farm run — a gold sink. Shown once
         the guild has its first Orb (same gate as the Treasury tab). */
      if((save.stat.wins||0)>0){
        const fee=zigFee(save);
        const zB=document.createElement('button');
        zB.className='purple';
        zB.innerHTML='🏛 '+t('Ziggurat')+' · '+fmt(fee)+' 🜚';
        zB.disabled=full||save.gold<fee;
        zB.title=full?t('An expedition slot must be free'):t('Send this hero on a deep Ziggurat farm (escalating fee)');
        zB.onclick=()=>{if(fundZiggurat(h,save)){sfx.ui();persist();window.__renderAll()}};
        row.appendChild(zB);
      }
    }else{
      const wB=document.createElement('button');
      wB.textContent=t('Watch');
      wB.onclick=()=>{window.__setWatch(h.id);
        document.querySelector('#nav .tb[data-p="pDun"]').click()};
      row.appendChild(wB);
      const rcB=document.createElement('button');
      rcB.textContent=t('Recall');
      rcB.dataset.ftue='recall';
      rcB.style.color='var(--hp)';
      rcB.style.borderColor='rgba(201,79,67,.5)';
      rcB.onclick=()=>{
        if(!confirm(t('Recall ')+h.name+' ('+brTag(h)+t(')? ALL run progress will burn: ')+
          'XL '+h.xl+t(' → 1; skills, faith, runes, mutations and inventory will be lost. ')+
          t('The wallet returns to the treasury; equipment is kept.')))return;
        recallHero(h,save);
        sfx.ui();persist();window.__renderAll();
      };
      row.appendChild(rcB);
    }
    const eqB=document.createElement('button');
    eqB.className='blue';eqB.textContent=t('Equipment');
    eqB.onclick=()=>{window.__openEquip(h.id)};
    row.appendChild(eqB);
    if(save.heroes.filter(x=>x.state==='camp').length>0&&
       save.heroes.filter(x=>x.state==='run').length>=maxSlots(save)&&h.state==='camp'){
      const hint=document.createElement('div');
      hint.className='label';
      hint.style.color='#e8c8ff';
      hint.textContent=t('🕯 More slots: Memory → “Heroes” → “2nd seeker”');
      el.appendChild(hint);
    }
    const shB=document.createElement('button');
    shB.textContent=t('Status');
    shB.onclick=()=>{window.__openSheet(h.id)};
    row.appendChild(shB);
    el.appendChild(row);
    box.appendChild(el);
  }
  if(!heroes.length)box.innerHTML='<div class="hint">'+t('No living seekers — summon a new one above ↑')+'</div>';
}

