import {$} from './dom.js';
import {save,persist} from '../core/state.js';
import {fmt,clamp} from '../core/fmt.js';
import {sfx} from './audio.js';
import {tileURL,tileImg} from '../data/tiles.js';
import {RACES} from '../data/races.js';
import {CLASSES} from '../data/classes.js';
import {GODS,GODKEYS,godFavor,FAVOR_TIERS} from '../data/gods.js';
import {MONS,FAMILY_KEYS,FAMILY_META,FAMILIES,familyKills,familyMastery,familyDmgBonus,monTier} from '../data/monsters.js';
import {ENDGAME_GATE,endgameUnlocked} from '../data/endgame.js';
import {BRANCHES,brTag} from '../data/branches.js';
import {itemName,itemTile,randomItem,itemInfo} from '../data/items.js';
import {ZUPGRADES,zupg,zupgCost,zupgCap,fameMul} from '../core/economy.js';
import {heroStats} from '../sim/hero.js';
import {MW,MH} from '../sim/mapgen.js';
import {comboKey,RARN} from '../data/combos.js';
import { t } from '../i18n/index.js';
import {PUPGRADES,pupg,pupgCost,ngLevel,legendsReward,canPrestige,doPrestige,cycleProgress,prestigeReq} from '../core/prestige.js';
import {chronicleGoals,greatRaces,greatClasses,greatMul,cycleContract} from '../core/chronicle.js';
import {RKEYS} from '../data/races.js';
import {CKEYS} from '../data/classes.js';
/* ===================== upgrades & fame ===================== */
export function renderFame(){
  const wins=(save.stat&&save.stat.wins)||0;
  $('fameSummary').innerHTML='<div class="card"><div class="nm" style="color:var(--gold)">'+t('Hall of Fame')+'</div>'+
    '<div class="meta">'+t('Victories: ')+wins+t(' → all heroes gain +')+Math.round((fameMul(save)-1)*100)+t('% damage and HP<br>')+
    t('Zot essence: ')+save.zot+t(' ⚛ · Total runes collected: ')+save.runesTotal+'</div></div>';
  /* the Chronicle: the top open goals of the current stage */
  const chB=$('chronicleBox');
  if(chB){
    chB.innerHTML='';
    for(const g of chronicleGoals(save)){
      const el=document.createElement('div');
      el.className='upgRow';
      el.innerHTML='<div class="tInfo"><div class="ds">'+
        (g.tr?t(g.n,{x:t(g.v.x)}):t(g.n,g.v||{}))+'</div></div>'+
        (g.p?'<span class="label">'+g.p+'</span>':'');
      chB.appendChild(el);
    }
    /* Hall of the Great: badge grid of victorious races and classes */
    const gr=greatRaces(save),gc=greatClasses(save);
    const hall=document.createElement('div');
    hall.className='card';
    hall.innerHTML='<div class="nm" style="color:var(--gold)">'+t('Hall of the Great')+
      ' · +'+Math.round((greatMul(save)-1)*100)+'%</div>'+
      '<div class="meta">'+t('A permanent +1% damage and health for every race and class that has carried the Orb')+'</div>'+
      '<div class="label" style="line-height:1.9">'+
      RKEYS.map(r=>'<span style="opacity:'+(gr.includes(r)?1:.35)+'">'+t(RACES[r].n)+'</span>').join(' · ')+'<br>'+
      CKEYS.map(c=>'<span style="opacity:'+(gc.includes(c)?1:.35)+'">'+t(CLASSES[c].n)+'</span>').join(' · ')+'</div>';
    chB.appendChild(hall);
  }
  /* the endgame powers accrue always but stay dormant until the prestige gate */
  const egOn=endgameUnlocked(save);
  const gateNote=egOn?'':' <span style="color:var(--epic)">'+
    t('Locked until {n} prestiges — {x} so far',{n:ENDGAME_GATE,x:save.prestiges||0})+'</span>';
  /* Pantheon: eternal favor per god (wins-while-pledged), gated boon amplifier */
  const pth=$('pantheonBox');
  if(pth){
    pth.innerHTML='<div class="card"><div class="nm" style="color:var(--gold)">'+t('Pantheon')+'</div>'+
      '<div class="meta">'+t("Favor deepens each god's boon — carry the Orb pledged to a god.")+gateNote+'</div>'+
      '<div class="godGrid">'+
      GODKEYS.map(g=>{
        const w=(save.pantheon&&save.pantheon[g])||0,tier=godFavor(save,g),next=FAVOR_TIERS[tier];
        return '<div class="godCell" style="opacity:'+(w?1:.4)+'">'+
          '<img src="'+tileURL(GODS[g].alt)+'" alt="">'+
          '<div><b>'+t(GODS[g].n)+'</b><br><span class="label">'+
          '★'.repeat(tier)+'☆'.repeat(4-tier)+' · '+w+' 🏆'+(next?' · '+t('next at ')+next:'')+
          '</span></div></div>';
      }).join('')+'</div></div>';
  }
  /* Bestiary: eternal per-monster codex, gated logarithmic damage bonus per family */
  const bst=$('bestiaryBox');
  if(bst){
    bst.innerHTML='<div class="card"><div class="nm" style="color:var(--gold)">'+t('Bestiary')+'</div>'+
      '<div class="meta">'+t('Every kind slain forever strengthens you against its family.')+gateNote+'</div>'+
      FAMILY_KEYS.map(fam=>{
        const meta=FAMILY_META[fam],fk=familyKills(save,fam),ms=familyMastery(save,fam),fb=familyDmgBonus(save,fam);
        return '<div style="margin-top:8px"><div class="ds">'+meta.ico+' '+t(meta.n)+
          ' · <span style="color:var(--gold)">'+(egOn?'+'+Math.round(fb*100)+'%':'—')+'</span> '+
          '<span class="label">'+t('{n} slain · mastery {t}/4',{n:fk,t:ms})+'</span></div>'+
          '<div class="label" style="line-height:1.9">'+
          FAMILIES[fam].map(k=>{
            const n=(save.bestiary&&save.bestiary[k])||0,mt=monTier(save,k);
            return '<span style="opacity:'+(n?(.55+mt*.11):.28)+'">'+t(MONS[k].n)+(n?' ×'+n:'')+'</span>';
          }).join(' · ')+'</div></div>';
      }).join('')+'</div>';
  }
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
  for(const f of save.fame.slice(0,20)){
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

