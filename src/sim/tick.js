import {gXp,gGold,gDrop,gSpd,gAtk,gHp,shardMul as shardMulF,maxSlots,rollCost,freeRollAvailable} from '../core/economy.js';
import {gainMem,memEff,memHas} from '../data/memtree.js';
import {clamp,fmt} from '../core/fmt.js';
import {heroStats,rollHero,ringSlotKeys} from './hero.js';
import {genFloor,reveal,los,MW,MH} from './mapgen.js';
import {BRANCHES,buildRoute,brDepth,brTag} from '../data/branches.js';
import {RACES,aptMul} from '../data/races.js';
import {crossBoost} from '../data/skills.js';
import {CLASSES} from '../data/classes.js';
import {GODS,godField} from '../data/gods.js';
import {comboKey,SHARDS_PER} from '../data/combos.js';
import {randomItem,itemName,itemInfo,scoreItem,WEP_BASES,UNRANDS,makeUnrand} from '../data/items.js';
import {POTIONS,SCROLLS,consName,randConsumable} from '../data/consumables.js';
import {MUTS,randomMut} from '../data/mutations.js';
import {PORTALS} from '../data/portals.js';
import {zigFee,zigStartDepth} from '../core/treasury.js';
import {MONS,FAMILY_OF,familyDmgBonus} from '../data/monsters.js';
import {recordVictory,recordRunnerWin,checkContract,recordNemesisKill,avengeNemesis} from '../core/chronicle.js';
import {todayAffix} from '../data/affixes.js';
import {ELITE_AFFIXES,FLOOR_AFFIXES} from '../data/eliteAffixes.js';
import { hashSeed } from '../core/rng.js';
import { t } from '../i18n/index.js';

export const simHooks={onDeath:null,onWin:null};
/* DCSS: movement and adjacency are 8-directional (Chebyshev metric) */
const cheb=(ax,ay,bx,by)=>Math.max(Math.abs(ax-bx),Math.abs(ay-by));
const hasAf=(mo,k)=>mo.eliteAf&&mo.eliteAf.includes(k);
/* Per-hero deterministic RNG: every gameplay draw advances h.rngState, seeded
   from the account master seed — the same action sequence replays identically
   on any device. Lazy-inits for pre-determinism saves. */
function rnd(h){
  let a=(h.rngState==null?(h.rngState=(hashSeed(h.seed||0,h.id||0)|0)):h.rngState)|0;
  a=a+0x6D2B79F5|0;
  let x=Math.imul(a^a>>>15,1|a);
  x=x+Math.imul(x^x>>>7,61|x)^x;
  h.rngState=a;
  return ((x^x>>>14)>>>0)/4294967296;
}
const DIRS8=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
/* reused BFS scratch: stepToward's prev-array is transient, so allocate once and
   reset per call instead of a fresh typed array every pathfind (GC pressure) */
const _bfsPrev=new Int32Array(MW*MH);
const _bfsQ=new Int32Array(MW*MH);

/* verbose scrollback: log every action, but keep only the last LOG_MAX entries
   so the buffer (and the save) stays bounded */
export const LOG_MAX=80;
function hlog(h,txt,cls){
  h.log.push({t:brTag(h),txt,cls:cls||'sys'});
  h.logSeq=(h.logSeq||0)+1; /* monotonic counter; length is capped, so it is useless for diffing */
  if(h.log.length>LOG_MAX)h.log.shift();
}

export function startRun(h,s){
  h.state='run';h.rest=false;h.segIdx=0;h.turn=0;
  h.curHp=null;h.uniqSeen=[];h.runes=[];
  h.inv={curing:2+memEff(s,'pots')};
  h.known=[];h.status={};h.gold=0;h.keys=0;
  h.inPortal=null;h.banished=null;h.fundedZig=false;
  if(memHas(s,'k_autoequip'))equipBestFromArmory(h,s);
  const route=buildRoute(h.strategy);
  h.branch=route[0][0];h.floor=1;
  genFloor(h,s);
  const st=heroStats(h,s);
  h.curHp=st.hpMax;h.maxHpCache=st.hpMax;
  hlog(h,h.name+t(' descends into the dungeon. May the memory of Zot keep them.'),'sys');
}
/** pay the escalating fee to send a camp hero straight into a deep Ziggurat farm.
    Returns true on success. Consumes an expedition slot (the zig hero is 'run'). */
export function fundZiggurat(h,s){
  if(h.state!=='camp')return false;
  if(s.heroes.filter(x=>x.state==='run').length>=maxSlots(s))return false;
  const fee=zigFee(s);
  if(s.gold<fee)return false;
  s.gold-=fee;
  s.zigFunded=(s.zigFunded||0)+1;
  startRun(h,s);
  h.fundedZig=true; /* a glory run: it pays Memory/runes/levels, never treasury gold */
  /* drop them into a ziggurat that starts deep enough to stay lethal */
  h.portalRet={branch:'dungeon',floor:1,seg:0};
  h.portalDepth=zigStartDepth(s);
  h.inPortal={type:'zig',floor:1};
  genFloor(h,s);
  const st=heroStats(h,s);h.curHp=st.hpMax;h.maxHpCache=st.hpMax;
  hlog(h,'🏛 '+h.name+t(' is funded into a Ziggurat! (')+fmt(fee)+' 🜚)','rune');
  return true;
}
function nextFloor(h,s){
  if(h.inPortal){
    const P=PORTALS[h.inPortal.type];
    if(h.inPortal.type==='zig'){
      s.stat.zigBest=Math.max(s.stat.zigBest||0,h.inPortal.floor);
      gainMem(s,20+h.inPortal.floor*4);
      const zg=Math.floor(100*Math.pow(1.3,h.inPortal.floor));
      if(!h.fundedZig){h.gold+=zg;hlog(h,t('Ziggurat:')+h.inPortal.floor+t(' cleared (+')+fmt(zg)+' 🜚)','rune');}
      else hlog(h,t('Ziggurat:')+h.inPortal.floor+t(' conquered'),'rune');
    }
    if(h.inPortal.floor>=P.floors){exitPortal(h,s);return}
    h.inPortal.floor++;
    genFloor(h,s);
    hlog(h,h.name+t(' descends deeper: ')+brTag(h),'sys');
    return;
  }
  const route=buildRoute(h.strategy);
  const seg=route[h.segIdx];
  const br=BRANCHES[h.branch];
  h.rep.floors++;
  gainMem(s,2+brDepth(h)*.6);
  /* progress tracking */
  const short=br.short;
  const pk=short==='D'?'D':short;
  s.progress[pk]=Math.max(s.progress[pk]||0,h.floor);
  if(h.floor>=seg[1]||h.floor>=br.floors){
    /* segment done → next segment */
    h.segIdx++;
    if(h.segIdx>=route.length){h.segIdx=route.length-1}
    const ns=route[h.segIdx];
    /* zot gate check */
    if(ns[0]==='zot'&&s.runesTotal<3&&h.runes.length<3){
      hlog(h,t('The Gates of Zot are sealed — 3 runes required. ')+h.name+t(' farms the Depths.'),'sys');
      h.branch='depths';h.floor=Math.max(1,Math.min(5,h.floor));
      genFloor(h,s);return;
    }
    const prevBr=h.branch;
    h.branch=ns[0];
    /* resume dungeon at remembered depth */
    if(ns[0]==='dungeon'&&prevBr!=='dungeon')h.floor=(h.dFloor||1);
    else if(ns[0]===prevBr)h.floor=h.floor+1;
    else h.floor=1;
    if(prevBr==='dungeon')h.dFloor=Math.max(h.dFloor||1,h.floor);
  }else{
    h.floor++;
    if(h.branch==='dungeon')h.dFloor=Math.max(h.dFloor||1,h.floor);
  }
  genFloor(h,s);
  hlog(h,h.name+t(' enters ')+brTag(h),'sys');
  h.maxDepth=brTag(h);
}
/* DCSS-style training: kill XP goes into a pool, which is distributed among
   the skills in use (auto-training), factoring in aptitudes, crosstraining and
   the rising cost of levels. markUse records what the hero actually uses. */
function markUse(h,sk,w){
  if(h.skills[sk]===undefined)return;
  h.useW=h.useW||{};
  h.useW[sk]=(h.useW[sk]||0)+w;
}
function trainFromPool(h,s){
  const pool=h.skillPool||0;
  if(pool<=0||!h.useW)return;
  let W=0;
  for(const k in h.useW)W+=h.useW[k];
  if(W<=0)return;
  for(const k in h.useW){
    const share=h.useW[k]/W;
    const cost=1+Math.pow((h.skills[k]||0)*.22,1.6); /* levels get more expensive, like skill cost growth in DCSS */
    const mul=(RACES[h.race].trainMul||1)*aptMul(h.race,k)*crossBoost(h,k);
    h.skills[k]=Math.min(27,(h.skills[k]||0)+pool*share*mul/cost);
  }
  h.skillPool=0;
  /* recent-use window decays — switching weapons retargets training */
  for(const k in h.useW){h.useW[k]*=.9;if(h.useW[k]<.05)delete h.useW[k]}
}
function gainXp(h,xp,s){
  h.xp+=xp*gXp(s);
  h.skillPool=(h.skillPool||0)+xp*gXp(s)*.07;
  trainFromPool(h,s);
  const need=()=>20*Math.pow(1.45,h.xl-1);
  while(h.xp>=need()&&h.xl<27){
    h.xp-=need();h.xl++;
    const st=heroStats(h,s);
    const inc=st.hpMax-h.maxHpCache;
    h.maxHpCache=st.hpMax;
    h.curHp=Math.min(st.hpMax,h.curHp+Math.max(inc,st.hpMax*.15));
    hlog(h,h.name+t(' reaches level ')+h.xl+'!','lvl');
    if(RACES[h.race].mut&&h.xl%3===0)applyMut(h,s,true,t('demonic blood'));
  }
}
export function heroDie(h,killer,s){
  if(h.lives>1){
    h.lives--;
    h.curHp=h.maxHpCache;
    hlog(h,h.name+t(' loses a life! Remaining: ')+h.lives+t('. The felid is reborn.'),'death');
    return;
  }
  h.state='dead';h.deathBy=killer;
  simHooks.onDeath&&simHooks.onDeath(h);
  hlog(h,'☠ '+h.name+t(' dies to ')+killer+t(' on ')+brTag(h),'death');
  /* legacy */
  s.stat.deaths++;
  const walletBack=h.gold;
  if(h.gold>0){s.gold+=h.gold;hlog(h,t('Hero\'s wallet (')+fmt(h.gold)+t(' 🜚) returns to the treasury'),'sys')}
  const ck0=comboKey(h.race,h.cls);
  s.stat.bestXL[ck0]=Math.max(s.stat.bestXL[ck0]||0,h.xl);
  const gained=gainMem(s,30+h.xl*4,true);
  hlog(h,t('🕯 Dungeon Memory: +')+gained,'sys');
  const sh=Math.max(1,Math.floor((SHARDS_PER[h.rarity]+h.xl*.4)*shardMulF(s)));
  const ck=comboKey(h.race,h.cls);
  s.shards[ck]=(s.shards[ck]||0)+sh;
  /* epitaph for the death window */
  s.pendingDeaths=s.pendingDeaths||[];
  s.pendingDeaths.push({
    name:h.name,race:h.race,cls:h.cls,rarity:h.rarity,xl:h.xl,
    by:killer,at:brTag(h),turns:h.turn,kills:h.kills,
    gold:h.rep.gold,wallet:walletBack,runes:[...h.runes],
    muts:[...h.muts],god:h.god,shards:sh,
    notable:h.rep.notable.slice(-10),
    log:h.log.slice(-14),
  });
  if(s.pendingDeaths.length>6)s.pendingDeaths.shift();
  /* gear back to armory (90%) */
  for(const slot of Object.keys(h.gear)){
    const it=h.gear[slot];
    if(it&&!it.id.startsWith('st')&&rnd(h)<.9)storeItem(s,it);
  }
  s.fame.unshift({name:h.name,race:h.race,cls:h.cls,rarity:h.rarity,xl:h.xl,
    depth:h.maxDepth||brTag(h),by:killer,won:false,runes:h.runes.length});
  if(s.fame.length>20)s.fame.length=20;
  h.rep.notable.push(t('☠ slain by ')+killer+t(' on ')+brTag(h)+' (+'+sh+t(' shards)'));
  
}
export function heroWin(h,s){
  h.state='victor';
  /* Zot essence pays out once per cycle — the FIRST Orb is the one that matters */
  const firstWin=((s.stat.wins||0)-((s.cycBase&&s.cycBase.wins)||0))===0;
  s.stat.wins=(s.stat.wins||0)+1;
  s.progress.Zot=Math.max(s.progress.Zot||0,5);
  /* eternal Pantheon: an Orb carried out while pledged deepens that god's favor */
  if(h.god)s.pantheon[h.god]=(s.pantheon[h.god]||0)+1;
  recordVictory(s,h);
  recordRunnerWin(s,h);
  const cReward=checkContract(s,h);
  if(cReward)hlog(h,'📜 '+h.name+t(' fulfils the guild contract (+')+cReward+' ⚜)','rune');
  simHooks.onWin&&simHooks.onWin(h);
  hlog(h,'🏆 '+h.name+t(' TAKES THE ORB OF ZOT! A legend forever.'),'rune');
  const walletBack=h.gold;
  if(h.gold>0)s.gold+=h.gold;
  let ess=firstWin?Math.max(6,(Math.floor(h.xl/3)+h.runes.length*2)*2):0;
  if(firstWin&&memHas(s,'k_zotplus'))ess=Math.floor(ess*1.5);
  s.zot+=ess;
  const memWin=gainMem(s,300);
  /* triumph screen (mirror of the morgue): the victor's tale */
  s.pendingWins=s.pendingWins||[];
  s.pendingWins.push({
    name:h.name,race:h.race,cls:h.cls,rarity:h.rarity,xl:h.xl,
    turns:h.turn,kills:h.kills,gold:h.rep.gold,wallet:walletBack,
    runes:[...h.runes],muts:[...h.muts],god:h.god,
    essence:ess,firstWin,mem:memWin,
    notable:h.rep.notable.slice(-10),
    log:h.log.slice(-14),
  });
  if(s.pendingWins.length>6)s.pendingWins.shift();
  s.fame.unshift({name:h.name,race:h.race,cls:h.cls,rarity:h.rarity,xl:h.xl,
    depth:t('Zot:5 — THE ORB'),by:null,won:true,runes:h.runes.length});
  if(s.fame.length>20)s.fame.length=20;
  for(const slot of Object.keys(h.gear)){
    const it=h.gear[slot];
    if(it&&!it.id.startsWith('st'))storeItem(s,it);
  }
  h.rep.notable.push(t('🏆 VICTORY! The Orb of Zot is claimed (+')+ess+' ⚛)');
  if(typeof window!=='undefined'&&window.__cloudPush)window.__cloudPush(true);
  
}
/* DCSS stealth: radius at which sleepers notice the hero (7 unskilled, down to 2 for a master) */
export const wakeRadius=h=>Math.max(2,7-Math.floor((h.skills.stealth||0)/5));
/* one hero turn */
export function simTick(h,s){
  if(h.state!=='run')return;
  h.turn++;
  const st=heroStats(h,s);
  const m=h.map;
  /* regen */
  if(h.turn%8===0)h.curHp=Math.min(h.maxHpCache,h.curHp+st.regen);
  /* status effects: tick down */
  for(const k of Object.keys(h.status)){
    if(h.status[k]>0)h.status[k]--;
    if(h.status[k]<=0)delete h.status[k];
  }
  if(h.poison&&h.poison.t>0){
    h.poison.t--;h.curHp-=h.poison.dps;
    if(h.curHp<=0){heroDie(h,t('poison'),s);return}
  }
  /* gods: Trog's berserk at 30% HP, Elyvilon's periodic healing */
  if(h.god){
    const gd=GODS[h.god];
    if(gd.berserk30&&!h.status.berserk&&h.curHp/h.maxHpCache<.3&&(h.rageT===undefined||h.turn-h.rageT>60)){
      h.rageT=h.turn;h.status.berserk=18;
      hlog(h,'🔥 '+h.name+t(' goes berserk!'),'god');
    }
    if(gd.healtick&&h.turn%20===0)
      h.curHp=Math.min(h.maxHpCache,h.curHp+h.maxHpCache*.03);
  }
  /* clouds */
  if(!m.clouds)m.clouds=[];
  if(!m.traps)m.traps=[];
  for(let ci=m.clouds.length-1;ci>=0;ci--){
    const cl=m.clouds[ci];cl.t--;
    if(cl.t<=0){m.clouds.splice(ci,1);continue}
    if(cl.x===m.px&&cl.y===m.py){
      let cd2=Math.max(2,brDepth(h)*1.2)*(1-st.resAll);
      if(cl.kind==='poison'&&st.rPois)cd2*=.15; /* rPois shrugs off poison clouds */
      h.curHp-=cd2;
      if(rnd(h)<.3)hlog(h,h.name+t(' is burned by a cloud (')+cl.kind+')!','dmg');
      if(cl.kind==='poison'&&!st.rPois)h.poison={dps:Math.max(1,brDepth(h)*.3),t:5};
      if(h.curHp<=0){heroDie(h,t('a cloud'),s);return}
    }
  }
  /* mutation flare-ups */
  if(h.muts.includes('teleportitis')&&rnd(h)<.002)trapTeleport(h,t('teleportitis'));
  if(h.muts.includes('berserkitis')&&rnd(h)<.003&&!h.status.berserk){
    h.status.berserk=20;hlog(h,h.name+t(' flies into a spontaneous rage!'),'god');
  }
  if(h.muts.includes('screamer')&&rnd(h)<.01){
    for(const mo of m.monsters)mo.awake=true;
    hlog(h,h.name+t(' screams — the whole floor wakes up!'),'dmg');
  }
  /* a net: the hero loses a turn */
  const netted=h.status.net>0;
  const hpFrac=h.curHp/h.maxHpCache;
  const cautLim=h.caution==='bold'?.15:h.caution==='cautious'?.45:.3;
  consumableAI(h,s,st,hpFrac,cautLim);
  if(h.state!=='run')return;
  /* floor affixes shape the whole turn */
  const fafx=m.fafx;
  const sight=fafx==='darkness'&&!st.lantern?3:7;
  if(fafx==='miasma'&&!st.rPois&&h.turn%4===0){
    h.curHp-=Math.max(1,brDepth(h)*.25);
    if(rnd(h)<.05)hlog(h,h.name+t(' chokes in the miasma'),'dmg');
    if(h.curHp<=0){heroDie(h,t('the miasma'),s);return}
  }
  const wading=fafx==='flooded'&&h.race!=='merfolk'&&!st.waders;
  /* find nearest visible monster; stealth delays waking them (DCSS stealth) */
  const wakeR=Math.min(wakeRadius(h),sight);
  const df=heroDistField(m); /* reachability field from the hero (also used by monsters) */
  let tgt=null,td=1e9;
  for(const mo of m.monsters){
    const d=cheb(mo.x,mo.y,m.px,m.py);
    if(d<=wakeR&&los(m,m.px,m.py,mo.x,mo.y))mo.awake=true;
    /* only lock onto foes the hero can actually reach or see — chasing a phantom
       walled off from us used to livelock the hero on its start cell */
    if(mo.awake&&d<td&&(df[mo.y*MW+mo.x]>=0||los(m,m.px,m.py,mo.x,mo.y))){td=d;tgt=mo}
  }
  /* moving unnoticed trains Stealth */
  if(!m.monsters.some(mo=>mo.awake)&&h.turn%4===0)markUse(h,'stealth',.3);
  /* basic tactical sense: a Bonecaller must die first */
  let tgtR=null,tdR=1e9;
  for(const mo of m.monsters){
    if(!mo.awake||!hasAf(mo,'raiser'))continue;
    const dR=cheb(mo.x,mo.y,m.px,m.py);
    if(dR<tdR&&dR<=sight&&los(m,m.px,m.py,mo.x,mo.y)){tdR=dR;tgtR=mo}
  }
  if(tgtR){tgt=tgtR;td=tdR}
  let acted=netted||(wading&&h.turn%2===0); /* net or deep water: the turn is lost */
  if(netted&&rnd(h)<.4)hlog(h,h.name+t(' struggles out of the net...'),'sys');
  if(!acted&&tgt){
    /* DCSS: shooting/casting requires a visible target — no firing through walls */
    if(td<=Math.min(st.rng,sight)&&(td<=1||los(m,m.px,m.py,tgt.x,tgt.y))){
      heroAttack(h,st,tgt,s);acted=true;
    }else{
      stepToward(h,tgt.x,tgt.y,s);acted=true;
    }
  }
  if(!acted){
    /* pickup here? */
    const here=m.items.findIndex(it=>it.x===m.px&&it.y===m.py);
    if(here>=0){pickup(h,m.items[here],s);m.items.splice(here,1);acted=true}
  }
  if(!acted){
    /* explore: nearest reachable item or unexplored, else stairs */
    const goal=exploreGoal(h,df);
    if(goal){stepToward(h,goal[0],goal[1],s);acted=true}
    else{
      if(m.px===m.stairs.x&&m.py===m.stairs.y){
        if(m.bossFloor&&m.monsters.some(mo=>mo.boss||mo.uniq&&BRANCHES[h.branch].boss===mo.uniq)){
          /* boss still alive: hunt it */
          const b=m.monsters.find(mo=>mo.boss||mo.uniq);
          if(b){b.awake=true}
        }else nextFloor(h,s);
      }
      else stepToward(h,m.stairs.x,m.stairs.y,s);
    }
  }
  /* class mechanics: summoning and blink */
  const cd0=CLASSES[h.cls];
  if(cd0.summon){
    h.sumCd=(h.sumCd||0)-1;
    m.allies=m.allies||[];
    const cap=1+Math.floor((h.skills.summonings||0)/5);
    if(h.sumCd<=0&&m.allies.length<cap){
      h.sumCd=10;
      summonAlly(h,s);
    }
  }
  if(cd0.blink&&h.curHp/h.maxHpCache<.3&&(h.turn-(h.blinkT||0))>60){
    const near=m.monsters.some(mo=>mo.awake&&Math.max(Math.abs(mo.x-m.px),Math.abs(mo.y-m.py))<=2);
    if(near){h.blinkT=h.turn;trapTeleport(h,t("wizard's blink"))}
  }
  /* racial attacks: draconian breath, naga spit */
  const rd0=RACES[h.race];
  if(rd0.breath&&(h.turn-(h.breathT||0))>20){
    const bt=m.monsters.find(mo=>mo.awake&&Math.max(Math.abs(mo.x-m.px),Math.abs(mo.y-m.py))<=3&&los(m,m.px,m.py,mo.x,mo.y));
    if(bt){
      h.breathT=h.turn;
      const bdmg=st.dmg*.8;
      for(const mo of m.monsters.slice()){
        if(Math.max(Math.abs(mo.x-bt.x),Math.abs(mo.y-bt.y))<=1){
          mo.hp-=bdmg;
          if(mo.hp<=0)killMon(h,mo,s);
        }
      }
      hlog(h,'🔥 '+h.name+t(' breathes fire!'),'god');
    }
  }
  if(rd0.spit&&(h.turn-(h.spitT||0))>15){
    const sp=m.monsters.find(mo=>mo.awake&&Math.max(Math.abs(mo.x-m.px),Math.abs(mo.y-m.py))<=4&&los(m,m.px,m.py,mo.x,mo.y));
    if(sp){
      h.spitT=h.turn;
      sp.hp-=st.dmg*.4;
      sp.poisonA={dps:Math.max(1,st.dmg*.15),t:5};
      if(sp.hp<=0)killMon(h,sp,s);
      else hlog(h,'🐍 '+h.name+t(' spits venom at ')+t(sp.n),'kill');
    }
  }
  /* allies act */
  if(m.allies&&m.allies.length)alliesAct(h,s,m);
  /* monsters act */
  const dfield=m.monsters.some(mo=>mo.awake)?heroDistField(m):null;
  for(const mo of m.monsters){
    if(!mo.awake)continue;
    let spdEff=mo.spd;
    if(hasAf(mo,'enrage')&&mo.hp<mo.maxHp/2)spdEff*=2; /* furious below half */
    if(fafx==='flooded')spdEff*=.7; /* monsters wade too */
    if(hasAf(mo,'painaura')&&mo.awake&&cheb(mo.x,mo.y,m.px,m.py)<=1){
      h.curHp-=mo.dmg*.15;
      if(h.curHp<=0){heroDie(h,t(mo.n),s);return}
    }
    if(mo.chill>0){mo.chill--;spdEff*=.5}
    if(mo.poisonA&&mo.poisonA.t>0){
      mo.poisonA.t--;mo.hp-=mo.poisonA.dps;
      if(mo.hp<=0){killMon(h,mo,s);continue}
    }
    mo.mv+=spdEff;
    while(mo.mv>=1){
      mo.mv-=1;
      /* an adjacent ally intercepts the hit (as in DCSS — the nearest gets attacked) */
      const adjAlly=m.allies&&m.allies.find(a=>cheb(mo.x,mo.y,a.x,a.y)<=1);
      const d=cheb(mo.x,mo.y,m.px,m.py);
      if(adjAlly&&d>1){
        adjAlly.hp-=Math.max(1,mo.dmg*(0.7+rnd(h)*.6));
        if(adjAlly.hp<=0){
          m.allies.splice(m.allies.indexOf(adjAlly),1);
          hlog(h,t('Summoned ')+t(adjAlly.n)+t(' is defeated'),'sys');
        }
      }else if(d<=(mo.rng||1)){
        monAttack(h,st,mo,s);
        if(h.state!=='run')return;
      }else{
        monStep(h,mo,dfield);
      }
    }
  }
  reveal(h,sight<7?sight:undefined);
}
export function heroAttack(h,st,mo,s){
  const cd=CLASSES[h.cls];
  /* stabbing a sleeper: guaranteed hit, assassin ×2.5, everyone else ×1.5 */
  const asleep=!mo.awake;
  const hit=asleep||rnd(h)<clamp((st.acc+10)/(st.acc+10+mo.ev),.2,.95);
  if(!hit){
    rnd(h); /* was a 30% log sample — keep the draw so the RNG stream is unchanged */
    hlog(h,h.name+t(' misses ')+t(mo.n),'sys');
  }else{
    /* elite affixes: the qualitative layer of the fight */
    if(mo.eliteAf&&!mo._met){
      mo._met=1;
      hlog(h,'\u2b51 '+t(mo.n)+': '+mo.eliteAf.map(k=>t(ELITE_AFFIXES[k].n)).join(', '),'dmg');
    }
    if(hasAf(mo,'reflector')&&st.style==='ranged'&&rnd(h)<.25){
      h.curHp-=st.dmg*.4;
      hlog(h,'\u27f2 '+t(mo.n)+t(' mirrors the shot back!'),'dmg');
      if(h.curHp<=0){heroDie(h,t(mo.n),s)}
      return;
    }
    if(mo.shield>0){
      mo.shield--;
      if(rnd(h)<.4)hlog(h,'\u26e8 '+t(mo.n)+t(' shrugs the blow off its shield'),'sys');
      return;
    }
    if(hasAf(mo,'phasing')){
      mo._ph=(mo._ph||0)+1;
      if(mo._ph%3===0){if(rnd(h)<.3)hlog(h,t(mo.n)+t(' phases through the strike'),'sys');return}
    }
    let dmg=st.dmg*(0.75+rnd(h)*.5);
    let crit=rnd(h)<st.critc;
    if(crit)dmg*=2;
    if(hasAf(mo,'antimagic')&&st.style==='magic')dmg*=.5;
    if(hasAf(mo,'stoneskin')&&mo.hp<mo.maxHp/3)dmg*=.5;
    if(asleep){
      dmg*=cd.crit?2.5:1.5;
      hlog(h,'🗡 '+h.name+t(' stabs the sleeping ')+t(mo.n)+t(' from the shadows!'),'kill');
      markUse(h,'stealth',2);
      mo.awake=true;
    }
    if(st.chill&&mo.hp>0)mo.chill=5; /* frost slows */
    if(st.vsUndead>1&&mo.special&&mo.special.und)dmg*=st.vsUndead; /* holy wrath burns the undead */
    if(st.venom&&mo.hp>0&&!(mo.special&&mo.special.und))
      mo.poisonA={dps:Math.max(1,st.dmg*.12),t:4}; /* venom blade (undead are immune to poison) */
    dmg=Math.max(1,dmg-mo.ac*.8);
    /* eternal Bestiary: capped damage bonus vs the struck monster's family */
    const fam=FAMILY_OF[mo.kind];
    if(fam){const fb=familyDmgBonus(s,fam);if(fb)dmg*=1+fb;}
    /* berserker rage */
    if(cd.rage&&h.curHp/h.maxHpCache<.5)dmg*=1.5;
    /* Okawaru-style heroism vs uniques and bosses (Pantheon favor amplifies it) */
    if(h.god&&(mo.boss||mo.uniq)){const hb=godField(s,h.god,'hero');if(hb)dmg*=hb;}
    if(cd.aoe){
      for(const o of h.map.monsters)
        if(o!==mo&&Math.abs(o.x-mo.x)<=1&&Math.abs(o.y-mo.y)<=1)o.hp-=dmg*.5;
    }
    mo.hp-=dmg;
    if(st.leech>0)h.curHp=Math.min(h.maxHpCache,h.curHp+dmg*st.leech);
    if(mo.special&&mo.special.chill){}
    if(hasAf(mo,'thorns')&&st.style==='melee'){
      h.curHp-=dmg*.2;
      if(h.curHp<=0){heroDie(h,t(mo.n),s);return}
    }
    if(hasAf(mo,'caller')&&!mo._called){
      mo._called=1;
      for(const o of h.map.monsters)o.awake=true;
      hlog(h,'\ud83d\udce2 '+t(mo.n)+t(' bellows — the whole floor answers!'),'dmg');
    }
    if(mo.hp<=0)killMon(h,mo,s);
    else{
      hlog(h,h.name+t(' hits ')+t(mo.n)+' ('+Math.round(dmg)+')','sys');
      if(hasAf(mo,'blinker')&&rnd(h)<.35){
        const m2=h.map,freeC=[];
        for(let y=0;y<MH;y++)for(let x=0;x<MW;x++)
          if(m2.g[y][x]===0&&!(x===m2.px&&y===m2.py)&&!m2.monsters.some(o=>o.x===x&&o.y===y))freeC.push([x,y]);
        if(freeC.length){const c=freeC[Math.floor(rnd(h)*freeC.length)];mo.x=c[0];mo.y=c[1]}
      }
    }
  }
  /* auto-training: mark what we fight with — the XP pool will feed these skills */
  if(st.style==='magic'){
    markUse(h,'spellcasting',1);
    for(const school of ['conjurations','necromancy','fire','ice','summonings'])
      if((CLASSES[h.cls].skills||{})[school])markUse(h,school,.8);
  }else{
    markUse(h,st.school,1);markUse(h,'fighting',.5);
  }
}
function killMon(h,mo,s){
  const m=h.map;
  m.monsters.splice(m.monsters.indexOf(mo),1);
  /* volatile elites take the killer with them */
  if(hasAf(mo,'volatile')&&cheb(mo.x,mo.y,m.px,m.py)<=1){
    h.curHp-=mo.dmg*1.5;
    hlog(h,'\ud83d\udca5 '+t(mo.n)+t(' explodes!'),'dmg');
    if(h.curHp<=0){heroDie(h,t(mo.n),s)}
  }
  /* a Bonecaller nearby raises the corpse once */
  if(!mo.revived&&!hasAf(mo,'raiser')){
    const rz=m.monsters.find(o=>o.awake&&hasAf(o,'raiser')&&(o.raiseLeft===undefined||o.raiseLeft>0)&&cheb(o.x,o.y,mo.x,mo.y)<=4);
    if(rz){
      rz.raiseLeft=(rz.raiseLeft===undefined?1:rz.raiseLeft)-1;
      const back={...mo,hp:Math.floor(mo.maxHp/2),maxHp:mo.maxHp,revived:true,awake:true,eliteAf:null,shield:0};
      m.monsters.push(back);
      hlog(h,'\u2620 '+t(rz.n)+t(' drags the fallen back to its feet!'),'dmg');
      return; /* no loot from a body that stood back up */
    }
  }
  h.kills++;h.rep.kills++;s.stat.kills++;
  /* eternal Bestiary: lifetime kills per monster kind (uniques count under their
     base kind, so they feed the same family codex) */
  if(mo.kind)s.bestiary[mo.kind]=(s.bestiary[mo.kind]||0)+1;
  const depth=brDepth(h);
  const eliteLoot=mo.eliteAf?(1+.5*mo.eliteAf.length)*(memHas(s,'k_elite')?2:1):1;
  const goldMul=(RACES[h.race].gold||1)*gGold(s)*todayAffix().gold*eliteLoot;
  const g=Math.floor((2+rnd(h)*4)*Math.pow(1.22,depth)*goldMul);
  if(h.fundedZig){h.rep.gold+=g;}else{s.gold+=Math.ceil(g*.5);h.gold+=Math.floor(g*.5);h.rep.gold+=g;}
  gainXp(h,mo.xp,s);
  if(rnd(h)<.06*gDrop(s))s.scrap++;
  if(h.god){h.piety=Math.min(200,h.piety+1);
    const gd=GODS[h.god];
    const hk=godField(s,h.god,'healkill'); /* Pantheon favor amplifies the lifesteal */
    if(hk)h.curHp=Math.min(h.maxHpCache,h.curHp+h.maxHpCache*hk);
  }
  /* the necromancer raises the fallen: Animate Dead */
  const cdN=CLASSES[h.cls];
  if(cdN.raise&&!mo.boss&&!mo.uniq&&rnd(h)<.22){
    h.map.allies=h.map.allies||[];
    const cap=1+Math.floor((h.skills.necromancy||0)/9);
    if(h.map.allies.length<cap){
      const a=summonAlly(h,s,'zombie',t('risen ')+t(mo.n));
      if(a){a.x=mo.x;a.y=mo.y}
    }
  }
  if(RACES[h.race].eat&&rnd(h)<.4)
    h.curHp=Math.min(h.maxHpCache,h.curHp+h.maxHpCache*.05);
  if(mo.uniq){
    hlog(h,'⚔ '+h.name+t(' slays the unique: ')+t(mo.n)+'!','kill');
    const grudge=avengeNemesis(s,mo.uniq);
    if(grudge>0){
      const vg=Math.floor(300*grudge*gGold(s));
      s.gold+=vg;gainMem(s,40*grudge);
      hlog(h,'⚖ '+h.name+t(' avenges the fallen: the nemesis pays ')+vg+' 🜚','rune');
    }
    h.rep.notable.push(t('⚔ unique slain: ')+t(mo.n)+' ('+brTag(h)+')');
    s.stat.uniqKills++;
    gainMem(s,10+brDepth(h));
    maybeDropUnrand(h,s,.04);
    if(rnd(h)<(.03+memEff(s,'rune')))giveRune(h,t('a unique\'s rune'),s);
    else if(rnd(h)<.35)dropForgeItem(h,s);
    const br=BRANCHES[h.branch];
    if(br.boss===mo.uniq&&br.rune)giveRune(h,br.rune,s);
  }else if(mo.boss){
    hlog(h,'⚔ '+h.name+t(' defeats the boss: ')+t(mo.n)+'!','kill');
    gainMem(s,25+brDepth(h));
    h.rep.notable.push(t('⚔ defeated ')+t(mo.n));
    const br=BRANCHES[h.branch];
    if(br.rune)giveRune(h,br.rune,s);
    dropForgeItem(h,s);
  }else{
    rnd(h); /* was a 25% log sample — keep the draw so the RNG stream is unchanged */
    hlog(h,h.name+t(' kills: ')+t(mo.n)+' (+'+g+' 🜚)','kill');
  }
}
function giveRune(h,name,s){
  /* DCSS: each named rune exists once — repeats within a cycle pay out gold */
  s.cycRunes=s.cycRunes||[];
  const generic=name===t("a unique's rune");
  if(!generic&&s.cycRunes.includes(name)){
    const g=400+40*brDepth(h);
    s.gold+=g;
    hlog(h,'ᚱ '+h.name+t(' finds a duplicate rune — the guild sells it (+')+g+' 🜚)','loot');
    return;
  }
  if(!generic)s.cycRunes.push(name);
  h.runes.push(name);
  s.runes++;s.runesTotal++;
  hlog(h,'ᚱ '+h.name+t(' collects a rune: ')+t(name)+'!','rune');
  h.rep.notable.push(t('ᚱ obtained: ')+t(name));
}
function monAttack(h,st,mo,s){
  const hit=rnd(h)<clamp((mo.acc+8)/(mo.acc+8+st.ev),.1,.92);
  if(!hit){hlog(h,t(mo.n)+t(' misses ')+h.name,'sys');return}
  if(st.dodge>0&&rnd(h)<st.dodge){
    rnd(h); /* was a 30% log sample — keep the draw so the RNG stream is unchanged */
    hlog(h,h.name+t(' dodges ')+t(mo.n),'sys');
    return;
  }
  let dmg=mo.dmg*(0.7+rnd(h)*.6);
  dmg=Math.max(1,dmg-st.ac*.7)*(1-st.resAll);
  if(RACES[h.race].shrug)dmg*=.9; /* the dwarf shrugs off part of the damage */
  const cd=CLASSES[h.cls];
  h.curHp-=dmg;
  hlog(h,t(mo.n)+t(' hits ')+h.name+' ('+Math.round(dmg)+')','dmg');
  if(hasAf(mo,'vampiric'))mo.hp=Math.min(mo.maxHp,mo.hp+dmg*.8);
  if(mo.special&&mo.special.pois&&!st.rPois&&rnd(h)<.35){
    h.poison={dps:Math.max(1,mo.dmg*.15),t:5};
    hlog(h,'☠ '+h.name+t(' is poisoned (')+t(mo.n)+')','dmg');
  }
  markUse(h,'dodging',.4);
  if(h.gear.armour)markUse(h,'armour',.4);
  if(st.retal&&cheb(mo.x,mo.y,h.map.px,h.map.py)<=1){
    mo.hp-=st.dmg*.3;
    if(mo.hp<=0){killMon(h,mo,s);return}
  }
  if(mo.special&&mo.special.drain&&rnd(h)<.3)h.xp=Math.max(0,h.xp-3);
  if(mo.special&&mo.special.mag&&mo.special.drain&&rnd(h)<.06)applyMut(h,s,false,t('malmutation from ')+t(mo.n));
  /* distortion attacks: banishment to the Abyss */
  if(!h.inPortal&&h.branch!=='abyss'&&brDepth(h)>=11&&
     (mo.kind==='wraith'||mo.kind==='lich'||mo.kind==='de_sorcerer')&&rnd(h)<.025){
    banishHero(h,s,t(mo.n));return;
  }
  if(h.curHp<=0){
    if(mo.uniq)recordNemesisKill(s,mo.uniq); /* the slayer becomes a nemesis */
    heroDie(h,t(mo.n),s);
  }
}
export function stepToward(h,tx,ty,s){
  const m=h.map;
  if(m.px===tx&&m.py===ty)return;
  const goal=ty*MW+tx;
  /* cached path? */
  if(h.pathGoal===goal&&h.path&&h.path.length){
    const ni=h.path[h.path.length-1];
    const nx=ni%MW,ny=(ni/MW)|0;
    if(m.g[ny][nx]===0){
      h.path.pop();
      return moveOrAttack(h,nx,ny,s);
    }
  }
  /* BFS */
  const N=MW*MH,start=m.py*MW+m.px;
  const prev=_bfsPrev; prev.fill(-1);
  prev[start]=-2;
  const q=_bfsQ; q[0]=start; let qn=1,qi=0,found=false;
  while(qi<qn){
    const cur=q[qi++];
    if(cur===goal){found=true;break}
    const cx=cur%MW,cy=(cur/MW)|0;
    for(const [ox,oy] of DIRS8){
      const nx=cx+ox,ny=cy+oy;
      if(nx<0||nx>=MW||ny<0||ny>=MH)continue;
      const ni=ny*MW+nx;
      if(m.g[ny][nx]!==0||prev[ni]!==-1)continue;
      prev[ni]=cur;q[qn++]=ni;
    }
  }
  if(!found){h.path=null;h.pathGoal=null;return}
  /* build path (reversed: goal→...→first step) */
  const path=[];
  let cur=goal;
  while(cur!==start){path.push(cur);cur=prev[cur]}
  h.path=path;h.pathGoal=goal;
  const ni=path.pop();
  moveOrAttack(h,ni%MW,(ni/MW)|0,s);
}
function moveOrAttack(h,nx,ny,s){
  const m=h.map;
  const mo=m.monsters.find(o=>o.x===nx&&o.y===ny);
  if(mo){heroAttack(h,heroStats(h,s),mo,s);mo.awake=true;h.path=null;return}
  m.px=nx;m.py=ny;
  checkTrap(h,s);
}
/* BFS distance field from the hero: monsters walk down the gradient (feared ones walk up) */
export function heroDistField(m){
  /* the field depends on walls (static per floor) and the hero position only —
     monsters move every tick, the hero often does not */
  const dfKey=m.py*MW+m.px;
  if(m._df&&m._dfKey===dfKey)return m._df;
  const N=MW*MH;
  const df=new Int16Array(N).fill(-1);
  const start=m.py*MW+m.px;
  df[start]=0;
  const q=[start];let qi=0;
  while(qi<q.length){
    const cur=q[qi++],cx=cur%MW,cy=(cur/MW)|0,d=df[cur];
    for(const [ox,oy] of DIRS8){
      const nx=cx+ox,ny=cy+oy;
      if(nx<0||nx>=MW||ny<0||ny>=MH)continue;
      const ni=ny*MW+nx;
      if(m.g[ny][nx]!==0||df[ni]>=0)continue;
      df[ni]=d+1;q.push(ni);
    }
  }
  m._df=df;m._dfKey=dfKey;
  return df;
}
function monStep(h,mo,df){
  const m=h.map;
  if(!df)return;
  const flee=mo.fear>0;
  if(flee)mo.fear--;
  const cur=df[mo.y*MW+mo.x];
  let bestX=-1,bestY=-1,bestV=cur;
  const dirs=[...DIRS8];
  /* slight order randomization so monsters don't line up in a perfect column */
  if(rnd(h)<.5)dirs.reverse();
  for(const [ox,oy] of dirs){
    const nx=mo.x+ox,ny=mo.y+oy;
    if(nx<0||nx>=MW||ny<0||ny>=MH)continue;
    if(m.g[ny][nx]!==0)continue;
    if(nx===m.px&&ny===m.py)continue;
    if(m.monsters.some(o=>o!==mo&&o.x===nx&&o.y===ny))continue;
    const v=df[ny*MW+nx];
    if(v<0)continue;
    if(flee?v>bestV:(v<bestV)){bestV=v;bestX=nx;bestY=ny}
  }
  if(bestX>=0){mo.x=bestX;mo.y=bestY}
}
function exploreGoal(h,df){
  const m=h.map;
  const reach=(x,y)=>!df||df[y*MW+x]>=0; /* only pursue goals the hero can path to */
  /* items first */
  let best=null,bd=1e9;
  for(const it of m.items){
    if(it.kind==='altar'&&h.god)continue;
    if(!reach(it.x,it.y))continue;
    const d=Math.abs(it.x-m.px)+Math.abs(it.y-m.py);
    if(d<bd){bd=d;best=[it.x,it.y]}
  }
  if(best)return best;
  /* unexplored (classic/cautious only) */
  if(h.caution!=='bold'||h.strategy!=='speed'){
    for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){
      if(m.g[y][x]===0&&!m.explored[y][x]&&reach(x,y)){
        const d=Math.abs(x-m.px)+Math.abs(y-m.py);
        if(d<bd){bd=d;best=[x,y]}
      }
    }
    if(best&&h.strategy==='speed'&&rnd(h)<.7)best=null;
  }
  return best;
}
function pickup(h,it,s){
  if(it.kind==='gold'){
    const g=Math.floor(it.amt*(RACES[h.race].gold||1)*gGold(s));
    if(h.fundedZig){h.rep.gold+=g;}else{s.gold+=Math.ceil(g*.5);h.gold+=Math.floor(g*.5);h.rep.gold+=g;}
    rnd(h);hlog(h,h.name+t(' picks up ')+g+t(' gold'),'loot'); /* keep the draw; log every pickup */
  }else if(it.kind==='cons'){
    h.inv[it.c.type]=(h.inv[it.c.type]||0)+1;
    hlog(h,h.name+t(' picks up: ')+consName(it.c,h.known.includes(it.c.type)),'loot');
  }else if(it.kind==='key'){
    h.keys++;hlog(h,'🗝 '+h.name+t(' finds a golden key!'),'rune');
    h.rep.notable.push(t('🗝 found a key to the Trove'));
  }else if(it.kind==='shop'){
    shopVisit(h,s,it.stype);
  }else if(it.kind==='portal'){
    enterPortal(h,s,it.ptype);
  }else if(it.kind==='abyss_exit'){
    returnFromAbyss(h,s);
  }else if(it.kind==='item'){
    /* the item was pre-rolled at floor generation — take exactly that one */
    acquireItem(h,s,it.it||randomItem(null,Math.min(2,Math.floor(brDepth(h)/8)),()=>rnd(h)));
  }else if(it.kind==='potion'){
    /* legacy saves: old maps with the basic potion */
    h.inv.curing=(h.inv.curing||0)+1;
  }else if(it.kind==='altar'){
    h.god=it.god;h.piety=30;
    hlog(h,'✧ '+h.name+t(' pledges to: ')+t(GODS[it.god].n)+' — '+t(GODS[it.god].d),'god');
    h.rep.notable.push(t('✧ faith: ')+t(GODS[it.god].n));
  }else if(it.kind==='orb'){
    heroWin(h,s);
  }
}
export function dropForgeItem(h,s){
  const depth=brDepth(h);
  acquireItem(h,s,randomItem(null,Math.min(2,Math.floor(depth/8)),()=>rnd(h)));
}
export function acquireItem(h,s,it){
  /* auto-equip if better for this hero, else armory */
  const better=tryAutoEquip(h,it,s);
  hlog(h,t('✦ found: ')+itemName(it)+(better?t(' (equipped)'):t(' (to armory)')),'loot');
  h.rep.notable.push('✦ '+itemName(it));
  if(!better)storeItem(s,it);
}
export function tryAutoEquip(h,it,s){
  /* rings fill the first free slot the race allows (octopode has up to 8); when
     all are full the ring defers to the armory and equipBestFromArmory optimizes */
  const slot=it.slot==='ring'?(ringSlotKeys(h,s).find(k=>!h.gear[k])||null):it.slot;
  if(!slot)return false;
  if(it.slot==='weapon'&&RACES[h.race].nowep)return false;
  if(it.slot==='armour'&&RACES[h.race].noarm)return false;
  const cur=h.gear[slot];
  const score=q=>scoreItem(q,h);
  if(!cur||score(it)>score(cur)){
    if(cur&&!cur.id.startsWith('st'))storeItem(s,cur);
    h.gear[slot]=it;
    /* a two-hander displaces the shield */
    if(slot==='weapon'){
      const wb=WEP_BASES.find(w=>w.k===it.base);
      if(wb&&wb.h2&&h.gear.shield){
        storeItem(s,h.gear.shield);
        h.gear.shield=null;
      }
    }
    return true;
  }
  return false;
}
/* ===================== time & offline ===================== */
export function heroTps(h,s){
  return 1.4*(RACES[h.race].spd||1)*gSpd(s);
}
let simAcc={};
/* the "Auto-summon" keystone: fills a free slot with an idle hero, or buys a
   summon when the treasury holds at least twice the price; runs inside the sim
   so it works identically online, in background tabs and in offline catch-up */
function autoSummonStep(s){
  if(s.heroes.filter(x=>x.state==='run').length>=maxSlots(s))return;
  const idle=s.heroes.find(x=>x.state==='camp'&&!x.rest);
  if(idle){startRun(idle,s);return}
  if(!freeRollAvailable(s)&&s.gold<2*rollCost(s))return;
  rollHero(s,false); /* the fresh hero is dispatched on the next step */
}
export function advanceHeroes(s,dtSec,silent){
  const auto=memHas(s,'k_autosummon');
  const herald=memHas(s,'k_herald');
  let left=dtSec;
  while(left>0){
    /* chunked so offline auto-summoned heroes get simulated for the rest of the span */
    const step=Math.min(left,60);
    for(const h of s.heroes){
      if(h.state!=='run')continue;
      simAcc[h.id]=(simAcc[h.id]||0)+step*heroTps(h,s);
      let n=Math.floor(simAcc[h.id]);
      simAcc[h.id]-=n;
      if(silent)n=Math.min(n,200000);
      while(n-->0&&h.state==='run')simTick(h,s);
    }
    if(auto||herald){
      s.autoT=(s.autoT||0)+step;
      if(s.autoT>=3){
        s.autoT=0;
        if(auto)autoSummonStep(s);
        else if(freeRollAvailable(s)){
          /* Guild Herald keystone: a fallen party is replaced by a free seeker */
          const r=rollHero(s,false);
          if(r&&r.kind==='hero')startRun(r.h,s);
        }
      }
    }
    left-=step;
  }
}

/** Offline catch-up: advance heroes by elapsed minutes (cap 24h), return report or null. */
export function computeOffline(s,nowMs){
  const mins=((nowMs??Date.now())-s.last)/60000;
  if(mins<1)return null;
  const capMin=Math.min(mins,(memHas(s,'k_offcap')?72:24)*60);
  const goldBefore=s.gold;
  for(const h of s.heroes)h.rep={gold:0,kills:0,floors:0,notable:[]};
  advanceHeroes(s,capMin*60,true);
  const entries=[];
  for(const h of s.heroes){
    if(!h.rep.kills&&!h.rep.notable.length)continue;
    entries.push({hero:h,rep:h.rep,state:h.state,at:brTag(h)});
  }
  if(!entries.length)return null;
  return {mins:capMin,entries,goldGained:s.gold-goldBefore};
}

/** item goes to the armory; the "Auto-dismantle" keystone grinds grey items into scrap */
export function storeItem(s,it){
  if(memHas(s,'k_autodismantle')&&it.rar===0){
    s.scrap+=2;s.stat.dismantled++;
    return;
  }
  s.armory.push(it);
}
/** "Auto-equip" keystone: take the best gear from the armory before setting out */
export function equipBestFromArmory(h,s){
  const score=q=>scoreItem(q,h);
  const slots=['weapon','armour','shield',...ringSlotKeys(h,s),'amulet'];
  for(const slot of slots){
    if(slot==='weapon'&&RACES[h.race].nowep)continue;
    if(slot==='armour'&&RACES[h.race].noarm)continue;
    if(slot==='shield'&&h.gear.weapon){
      const wb=WEP_BASES.find(w=>w.k===h.gear.weapon.base);
      if(wb&&wb.h2)continue;
    }
    const want=slot.startsWith('ring')?'ring':slot;
    let best=null,bs=h.gear[slot]?score(h.gear[slot]):-1;
    for(const it of s.armory){
      if(it.slot!==want)continue;
      const sc=score(it);
      if(sc>bs){bs=sc;best=it}
    }
    if(best){
      const cur=h.gear[slot];
      if(cur&&!cur.id.startsWith('st'))s.armory.push(cur);
      h.gear[slot]=best;
      s.armory.splice(s.armory.indexOf(best),1);
    }
  }
}

/* ===================== consumables AI ===================== */
function know(h,type){if(!h.known.includes(type))h.known.push(type)}
function hasC(h,type){return (h.inv[type]||0)>0}
function useC(h,type){h.inv[type]--}
function drinkPotion(h,s,type,desperate){
  const wasKnown=h.known.includes(type);
  useC(h,type);know(h,type);
  const nm=t(POTIONS[type].n);
  if(!wasKnown)hlog(h,h.name+t(' drinks ')+t(POTIONS[type].un)+t('... it is ')+nm+'!','loot');
  switch(type){
    case 'curing':h.curHp=Math.min(h.maxHpCache,h.curHp+h.maxHpCache*.3);h.poison=null;
      if(wasKnown)hlog(h,h.name+t(' drinks ')+nm,'loot');break;
    case 'heal':h.curHp=Math.min(h.maxHpCache,h.curHp+h.maxHpCache*.55);
      if(wasKnown)hlog(h,h.name+t(' drinks ')+nm,'loot');break;
    case 'haste':h.status.haste=40;hlog(h,'⚡ '+h.name+t(' speeds up!'),'god');break;
    case 'might':h.status.might=45;hlog(h,'💪 '+h.name+t(' swells with might!'),'god');break;
    case 'berserk':h.status.berserk=30;hlog(h,'🔥 '+h.name+t(' goes berserk!'),'god');break;
    case 'resist':h.status.resist=45;break;
    case 'brill':h.status.brill=45;break;
    case 'agility':h.status.agility=45;break;
    case 'mutation':{
      const n=1+(rnd(h)<.4?1:0);
      for(let i=0;i<n;i++)applyMut(h,s,null,t('potion of mutation'));
      break}
  }
}
function readScroll(h,s,type){
  const wasKnown=h.known.includes(type);
  useC(h,type);know(h,type);
  const nm=t(SCROLLS[type].n);
  if(!wasKnown)hlog(h,h.name+t(' reads ')+t(SCROLLS[type].un)+t('... it is ')+nm+'!','loot');
  const m=h.map;
  switch(type){
    case 'teleport':trapTeleport(h,t('scroll of teleportation'));break;
    case t('blink'):trapTeleport(h,t('blink'));break;
    case 'ench_w':if(h.gear.weapon&&h.gear.weapon.plus<9){h.gear.weapon.plus++;
      hlog(h,t('✨ weapon enchanted: ')+itemName(h.gear.weapon),'rune')}break;
    case 'ench_a':if(h.gear.armour&&h.gear.armour.plus<9){h.gear.armour.plus++;
      hlog(h,t('✨ armour enchanted: ')+itemName(h.gear.armour),'rune')}break;
    case 'brand':if(h.gear.weapon&&!h.gear.weapon.ego){
      const egos=['flaming','freezing','venom','electro','speed','vamp'];
      h.gear.weapon.ego=egos[Math.floor(rnd(h)*egos.length)];
      hlog(h,t('✨ weapon gains a brand: ')+itemName(h.gear.weapon),'rune')}break;
    case 'mapping':for(let y=0;y<MH;y++)for(let x=0;x<MW;x++)
      if(m.g[y][x]===0)m.explored[y][x]=true;
      hlog(h,t('🗺 floor map revealed'),'sys');break;
    case 'fear':{let n=0;
      for(const mo of m.monsters){
        const d=cheb(mo.x,mo.y,m.px,m.py);
        if(d<=5&&mo.awake&&!mo.boss){mo.fear=15;n++}
      }
      hlog(h,'😱 '+n+t(' enemies flee in terror'),'god');break}
    case 'acquire':{
      const it=randomItem(null,Math.min(2,Math.floor(brDepth(h)/7)+1),()=>rnd(h));
      const eq=tryAutoEquip(h,it,s);
      hlog(h,t('🎁 acquirement: ')+itemName(it)+(eq?t(' (equipped)'):t(' (to armory)')),'rune');
      if(!eq)storeItem(s,it);break}
    case 'identify':{
      const unk=[...Object.keys(h.inv)].filter(k=>h.inv[k]>0&&!h.known.includes(k));
      if(unk.length){const k=unk[Math.floor(rnd(h)*unk.length)];
        know(h,k);
        hlog(h,t('🔍 identified: ')+(POTIONS[k]?t(POTIONS[k].n):t(SCROLLS[k].n)),'loot')}break}
  }
}
function consumableAI(h,s,st,hpFrac,cautLim){
  /* out of danger, checking once every 3 turns is enough */
  if(hpFrac>=cautLim&&h.turn%3!==0&&!h.poison)return;
  const m=h.map;
  const threats=m.monsters.filter(mo=>mo.awake&&
    cheb(mo.x,mo.y,m.px,m.py)<=4).length;
  /* mortal danger */
  if(hpFrac<.25){
    if(hasC(h,'heal')&&h.known.includes('heal'))return drinkPotion(h,s,'heal');
    if(hasC(h,'curing')&&h.known.includes('curing'))return drinkPotion(h,s,'curing');
    /* desperate potion identification */
    const unkPot=Object.keys(POTIONS).find(t=>hasC(h,t)&&!h.known.includes(t));
    if(unkPot)return drinkPotion(h,s,unkPot,true);
    if(hasC(h,'teleport')&&h.known.includes('teleport')&&threats>=2)return readScroll(h,s,'teleport');
  }
  /* normal healing at the caution threshold */
  if(hpFrac<cautLim){
    if(hasC(h,'curing')&&(h.known.includes('curing')||h.turn<50))return drinkPotion(h,s,'curing');
    if(hasC(h,'heal')&&h.known.includes('heal'))return drinkPotion(h,s,'heal');
  }
  if(h.poison&&hasC(h,'curing')&&h.known.includes('curing'))return drinkPotion(h,s,'curing');
  /* buffs against a boss/unique */
  const bigTgt=m.monsters.some(mo=>(mo.boss||mo.uniq)&&mo.awake);
  if(bigTgt){
    if(hasC(h,'might')&&h.known.includes('might')&&!h.status.might)return drinkPotion(h,s,'might');
    if(hasC(h,'haste')&&h.known.includes('haste')&&!h.status.haste)return drinkPotion(h,s,'haste');
    if(hasC(h,'berserk')&&h.known.includes('berserk')&&!h.status.berserk&&
       CLASSES[h.cls].style==='melee')return drinkPotion(h,s,'berserk');
  }
  if(threats>=3&&hpFrac<.5&&hasC(h,'fear')&&h.known.includes('fear'))return readScroll(h,s,'fear');
  /* leisurely identification and utility scrolls */
  if(threats===0&&h.turn%30===0){
    for(const t of Object.keys(SCROLLS)){
      if(hasC(h,t)&&(h.known.includes(t)?
          ['ench_w','ench_a','brand','mapping','acquire','identify'].includes(t):true)){
        if(h.known.includes(t)&&t==='mapping'&&h.map.explored.flat().filter(Boolean).length>200)continue;
        return readScroll(h,s,t);
      }
    }
  }
}
/* ===================== traps, banishment, portals, shops ===================== */
function trapTeleport(h,reason){
  const m=h.map;
  const free=[];
  for(let y=0;y<MH;y++)for(let x=0;x<MW;x++)if(m.g[y][x]===0)free.push([x,y]);
  const c=free[Math.floor(rnd(h)*free.length)];
  m.px=c[0];m.py=c[1];h.path=null;
  hlog(h,'✦ '+h.name+t(' is teleported (')+reason+')','sys');
}
export function checkTrap(h,s){
  const m=h.map;
  const tr=m.traps&&m.traps.find(t=>t.x===m.px&&t.y===m.py&&!t.done);
  if(!tr)return;
  const st=heroStats(h,s);
  if(!tr.seen&&rnd(h)<.35+st.ev*.008){
    tr.seen=true;
    hlog(h,h.name+t(' spots a trap (')+trapName(tr.kind)+t(') and walks around it'),'sys');
    return;
  }
  tr.done=true;tr.seen=true;
  switch(tr.kind){
    case 'shaft':{
      const drop=1+(rnd(h)<.3?1:0);
      hlog(h,'⬇ '+h.name+t(' falls through a shaft to ')+drop+t(' floors!'),'dmg');
      const br=BRANCHES[h.branch];
      h.floor=Math.min(br.floors,h.floor+drop);
      if(h.branch==='dungeon')h.dFloor=Math.max(h.dFloor||1,h.floor);
      genFloor(h,s);
      break}
    case 'teleport':trapTeleport(h,t('a trap'));break;
    case 'alarm':
      for(const mo of m.monsters)mo.awake=true;
      hlog(h,t('🔔 Alarm! The whole floor wakes up'),'dmg');break;
    case 'net':
      if(h.race==='tengu'){hlog(h,h.name+t(' flies over the net'),'sys');break}
      h.status.net=3;
      hlog(h,'🕸 '+h.name+t(' gets tangled in a net'),'dmg');break;
    case 'zot':
      hlog(h,t('⚠ A Zot trap!'),'death');
      banishHero(h,s,t('a Zot trap'));break;
  }
}
function trapName(k){return {shaft:t('a shaft'),teleport:t('a teleport'),alarm:t('an alarm'),net:t('a net'),zot:t('a Zot trap')}[k]}
export function banishHero(h,s,by){
  h.banished={branch:h.branch,floor:h.floor,seg:h.segIdx};
  h.branch='abyss';h.floor=Math.max(1,Math.floor(brDepth(h)/2));
  h.inPortal=null;
  genFloor(h,s);
  /* the Abyss exit sits where the stairs would be */
  h.map.items.push({x:h.map.stairs.x,y:h.map.stairs.y,kind:'abyss_exit'});
  hlog(h,'🌀 '+h.name+t(' BANISHED TO THE ABYSS (')+by+t(')! Must find a way out...'),'death');
  h.rep.notable.push(t('🌀 banished to the Abyss: ')+by);
}
export function returnFromAbyss(h,s){
  const b=h.banished;
  if(!b)return;
  h.banished=null;
  h.branch=b.branch;h.floor=b.floor;h.segIdx=b.seg;
  genFloor(h,s);
  gainMem(s,25);
  hlog(h,'🌀 '+h.name+t(' escapes the Abyss!'),'rune');
  h.rep.notable.push(t('🌀 escaped the Abyss'));
}
export function enterPortal(h,s,ptype){
  const P=PORTALS[ptype];
  if(P.needKey){
    if(h.keys<1){hlog(h,t('The Trove is locked — a golden key is required'),'sys');return}
    h.keys--;
    hlog(h,t('🗝 the key turns in the lock...'),'rune');
  }
  h.portalRet={branch:h.branch,floor:h.floor,seg:h.segIdx};
  h.portalDepth=brDepth(h);
  h.inPortal={type:ptype,floor:1};
  genFloor(h,s);
  hlog(h,'🌈 '+h.name+t(' enters a portal: ')+t(P.n)+'!','rune');
  if(ptype==='trove')maybeDropUnrand(h,s,1);
  h.rep.notable.push(t('🌈 portal: ')+t(P.n));
}
export function exitPortal(h,s){
  const r=h.portalRet;
  const wasZig=h.inPortal&&h.inPortal.type==='zig';
  const zf=h.inPortal?h.inPortal.floor:0;
  h.inPortal=null;h.portalRet=null;
  h.branch=r.branch;h.floor=r.floor;h.segIdx=r.seg;
  genFloor(h,s);
  if(wasZig){
    gainMem(s,zf*15);
    hlog(h,t('🏛 Ziggurat conquered down to floor ')+zf+'!','rune');
    h.rep.notable.push(t('🏛 Ziggurat: ')+zf+t(' floors'));
  }else hlog(h,h.name+t(' returns from the portal'),'sys');
}
export function shopVisit(h,s,stype){
  const depth=brDepth(h);
  const frac={thrifty:.3,balanced:.6,lavish:1}[h.spend||'balanced'];
  let budget=Math.floor(h.gold*frac);
  const bought=[];
  const offers=3+Math.floor(rnd(h)*3);
  for(let i=0;i<offers;i++){
    const wantGear=(stype==='weapon'||stype==='armour')?rnd(h)<.6:rnd(h)<.25;
    if(wantGear){
      const slot=stype==='weapon'?'weapon':stype==='armour'?'armour':null;
      const it=randomItem(slot,Math.min(2,Math.floor(depth/7)),()=>rnd(h));
      const price=Math.floor((60+depth*20)*(1+it.rar)*(.8+rnd(h)*.5));
      if(price<=budget){
        const eq=tryAutoEquip(h,it,s);
        if(eq){budget-=price;h.gold-=price;bought.push(itemName(it))}
      }
    }else{
      const c=randConsumable(()=>rnd(h));
      const price=Math.floor((15+depth*6)*(.8+rnd(h)*.5));
      if(price<=budget){
        budget-=price;h.gold-=price;
        h.inv[c.type]=(h.inv[c.type]||0)+1;
        bought.push(consName(c,h.known.includes(c.type)));
      }
    }
  }
  if(bought.length){
    hlog(h,'🏪 '+h.name+t(' goes shopping: ')+bought.join(', '),'loot');
  }else hlog(h,'🏪 '+h.name+t(' browses the shop but leaves empty-handed'),'sys');
}
export function applyMut(h,s,goodOnly,reason){
  /* DCSS: undead flesh does not mutate */
  if(RACES[h.race].und){hlog(h,h.name+t(' is immune to mutation'),'sys');return}
  const good=goodOnly===null?rnd(h)<.55:goodOnly;
  const mk=randomMut(h,()=>rnd(h),good);
  if(!mk)return;
  h.muts.push(mk);
  const md=MUTS[mk];
  hlog(h,t('🧬 Mutation (')+reason+'): '+t(md.n)+' — '+t(md.d),md.good?'god':'dmg');
  h.rep.notable.push('🧬 '+t(md.n));
}

/** Recall a hero from the dungeon: the slot is freed, all run progress is lost. */
export function recallHero(h,s){
  if(h.state!=='run')return false;
  if(h.gold>0){s.gold+=h.gold}
  const cd=CLASSES[h.cls];
  h.state='camp';h.rest=true;
  /* full hero reset — like a fresh recruit of this combo */
  h.xl=1;h.xp=0;h.skillPool=0;h.useW={};
  for(const k of Object.keys(h.skills))h.skills[k]=0;
  for(const k of Object.keys(cd.skills||{}))
    if(h.skills[k]!==undefined)h.skills[k]=cd.skills[k];
  h.god=cd.god||null;h.piety=h.god?30:0;
  h.runes=[];h.muts=[];h.inv={};h.known=[];h.status={};h.poison=null;
  h.gold=0;h.keys=0;h.kills=0;h.turn=0;
  h.map=null;h.branch=null;h.floor=0;h.segIdx=0;h.dFloor=0;
  h.inPortal=null;h.portalRet=null;h.banished=null;h.uniqSeen=[];
  h.lives=RACES[h.race].lives||1;
  h.curHp=null;h.maxHpCache=0;
  /* heirs apply to recalled heroes too — the combo remembers its fallen ancestors */
  if(memHas(s,'k_heirs')){
    const best=s.stat.bestXL[comboKey(h.race,h.cls)];
    if(best)h.xl=Math.min(20,1+Math.floor(best/3));
  }
  h.rep={gold:0,kills:0,floors:0,notable:[]};
  h.log=[{t:'—',txt:h.name+t(' is recalled from the dungeon. The journey starts anew.'),cls:'sys'}];
  return true;
}

/* ===================== allies (summoner, necromancer) ===================== */
const SUMMON_TIERS=[
  {min:0, kind:'rat',   n:'rat familiar'},
  {min:6, kind:'jackal',n:'summoned jackal'},
  {min:12,kind:'yak',   n:'summoned yak'},
  {min:18,kind:'komodo',n:'summoned monitor lizard'},
  {min:24,kind:'hydra', n:'summoned hydra'},
];
export function summonAlly(h,s,forceKind,forceN){
  const m=h.map;
  m.allies=m.allies||[];
  let kind=forceKind,name=forceN;
  if(!kind){
    const skl=h.skills.summonings||0;
    const tier=[...SUMMON_TIERS].reverse().find(t=>skl>=t.min)||SUMMON_TIERS[0];
    kind=tier.kind;name=t(tier.n);
  }
  const base=MONS[kind];
  const depth=brDepth(h);
  const powSkl=(h.skills.summonings||h.skills.necromancy||0);
  /* look for a free cell next to the hero */
  for(const [ox,oy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){
    const nx=m.px+ox,ny=m.py+oy;
    if(nx<0||nx>=MW||ny<0||ny>=MH||m.g[ny][nx]!==0)continue;
    if(m.monsters.some(o=>o.x===nx&&o.y===ny)||m.allies.some(a=>a.x===nx&&a.y===ny))continue;
    const a={kind,n:name,t:base.t,x:nx,y:ny,
      /* the army scales with the account like the summoner himself does —
         otherwise pets melt at deep NG while monsters keep growing */
      hp:Math.floor(base.hp*(1+powSkl*.20+depth*.06)*gHp(s)),
      dmg:Math.floor(base.dmg*(1+powSkl*.16+depth*.05)*gAtk(s)),
      ttl:120,mv:0,spd:base.spd||1};
    a.maxHp=a.hp;
    m.allies.push(a);
    hlog(h,'✨ '+h.name+t(' summons: ')+name,'god');
    return a;
  }
  return null;
}
export function alliesAct(h,s,mArg){
  const m=mArg||h.map;
  if(!m||!m.allies)return;
  for(let i=m.allies.length-1;i>=0;i--){
    const a=m.allies[i];
    a.ttl--;
    if(a.ttl<=0){m.allies.splice(i,1);
      hlog(h,t(a.n)+t(' dissolves into thin air'),'sys');continue}
    /* target: nearest awake monster */
    let tgt=null,td=99;
    for(const mo of m.monsters){
      const d=Math.max(Math.abs(mo.x-a.x),Math.abs(mo.y-a.y));
      if(mo.awake&&d<td){td=d;tgt=mo}
    }
    if(!tgt){
      /* stay close to the hero */
      if(Math.max(Math.abs(a.x-m.px),Math.abs(a.y-m.py))>2)allyStep(m,a,m.px,m.py);
      continue;
    }
    a.mv+=a.spd;
    while(a.mv>=1){
      a.mv-=1;
      const d=Math.max(Math.abs(tgt.x-a.x),Math.abs(tgt.y-a.y));
      if(d<=1){
        const adm=Math.max(1,a.dmg*(0.7+rnd(h)*.6)-tgt.ac*.5);
        tgt.hp-=adm;
        if(tgt.hp<=0){killMon(h,tgt,s);break}
      }else allyStep(m,a,tgt.x,tgt.y);
    }
  }
}
function allyStep(m,a,tx,ty){
  const dx=Math.sign(tx-a.x),dy=Math.sign(ty-a.y);
  const cands=[[dx,dy],[dx,0],[0,dy],[dx,-dy],[-dx,dy]];
  for(const [ox,oy] of cands){
    if(!ox&&!oy)continue;
    const nx=a.x+ox,ny=a.y+oy;
    if(nx<0||nx>=MW||ny<0||ny>=MH||m.g[ny][nx]!==0)continue;
    if((nx===m.px&&ny===m.py)||m.monsters.some(o=>o.x===nx&&o.y===ny)||
       m.allies.some(o=>o!==a&&o.x===nx&&o.y===ny))continue;
    a.x=nx;a.y=ny;return;
  }
}

/* unrand drop: only ones not yet obtained, one copy per account */
export function maybeDropUnrand(h,s,chance){
  s.unrandsOwned=s.unrandsOwned||[];
  if(rnd(h)>=chance)return false;
  const pool=UNRANDS.filter(u=>!s.unrandsOwned.includes(u.id));
  if(!pool.length)return false;
  const u=pool[Math.floor(rnd(h)*pool.length)];
  s.unrandsOwned.push(u.id);
  const it=makeUnrand(u.id);
  hlog(h,t('🌟 LEGEND! Artefact found: ')+t(u.n)+' — '+t(u.lore),'rune');
  h.rep.notable.push(t('🌟 artefact ')+t(u.n));
  const eq=tryAutoEquip(h,it,s);
  if(!eq)s.armory.push(it);
  return true;
}
