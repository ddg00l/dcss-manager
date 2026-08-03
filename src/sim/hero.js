import {RACES} from '../data/races.js';
import {effSkill,speedMul} from '../data/skills.js';
import {CLASSES} from '../data/classes.js';
import {comboKey,RARMUL,SHARDS_PER} from '../data/combos.js';
import {WEP_BASES,ARM_BASES,SH_BASES,itemInfo} from '../data/items.js';
import {GODS,godField} from '../data/gods.js';
import {HERO_NAMES} from '../data/names.js';
import {gHp,gAtk,gSpd,freeRollAvailable,rollCost,PITY_AT,rollCombo,pickComboOfTier,shardMul, darkRollCost} from '../core/economy.js';
import {nextStream} from '../core/streams.js';
import {mpMaxOf} from '../data/spells.js';
import {hashSeed} from '../core/rng.js';

/* Ring slots a hero can actually use: a race with a fixed ring count (octopode,
   who wears rings instead of body armour) gets exactly that many; everyone else
   gets two, plus a third from the k_ring3 keystone. */
export function ringSlotKeys(h,s){
  const rd=RACES[h.race];
  const n=rd.rings?rd.rings:(2+(memHas(s,'k_ring3')?1:0));
  const out=[];for(let i=1;i<=n;i++)out.push('ring'+i);
  return out;
}
import {memEff,memHas,treeSig} from '../data/memtree.js';

/** The guild's standing orders: what the newest seeker should inherit. */
export function guildDoctrine(s){
  const last=[...(s.heroes||[])].reverse().find(h=>h.strategy);
  return {
    strategy:last?last.strategy:'classic',
    caution:last?last.caution:'normal',
    spend:last?last.spend:'balanced',
  };
}

export function newHero(race,cls,rarity,s){
  const rd=RACES[race],cd=CLASSES[cls];
  const stars=s.stars[comboKey(race,cls)]||0;
  const hid=s.nextId++;
  const h={
    id:hid,name:HERO_NAMES[hashSeed(s.masterSeed,'name',hid)%HERO_NAMES.length],
    race,cls,rarity,xl:1,xp:0,
    skills:{fighting:0,short_blades:0,long_blades:0,axes:0,maces:0,polearms:0,staves:0,
      bows:0,crossbows:0,unarmed:0,dodging:0,armour:0,stealth:0,
      spellcasting:0,conjurations:0,necromancy:0,fire:0,ice:0,summonings:0},
    god:null,piety:0,gear:{weapon:null,armour:null,shield:null,ring1:null,ring2:null,ring3:null,ring4:null,ring5:null,ring6:null,ring7:null,ring8:null,amulet:null},
    inv:{curing:2+memEff(s,'pots')},known:[],muts:[],status:{},gold:0,keys:0,
    lives:rd.lives||1,
    /* A new seeker follows the guild's standing orders, not the factory default.
       The automation keystones dispatch fresh heroes straight into the dungeon
       without touching their settings, so every auto-summoned seeker used to run
       'classic'/'normal'/'balanced' no matter what the player had chosen — a
       speedrunning guild was measured bringing home crystal and silver runes
       from branches its route never visits, because a slice of the fleet was
       quietly on a different route. That also means route, caution and spend
       were partly inert for any account with automation, which is most of them. */
    ...guildDoctrine(s),
    state:'camp', // camp | run | dead | victor
    segIdx:0,branch:null,floor:0,turn:0,
    map:null,seed:hashSeed(s.masterSeed,'map',hid)>>>0,
    rngState:hashSeed(s.masterSeed,'combat',hid)|0,
    kills:0,maxDepth:'',runes:[],deathBy:null,
    rep:{gold:0,kills:0,floors:0,notable:[]},
    log:[],
  };
  for(const s of Object.keys(cd.skills||{}))
    if(h.skills[s]!==undefined)h.skills[s]=cd.skills[s];
  if(cd.god)h.god=cd.god;
  /* "Heirs" keystone: starting XL based on the combo's best fallen ancestor */
  if(memHas(s,'k_heirs')){
    const best=s.stat.bestXL[comboKey(race,cls)];
    if(best)h.xl=Math.min(20,1+Math.floor(best/3));
  }
  /* starting kit */
  if(cd.wep&&!rd.nowep){
    const b=WEP_BASES.find(w=>w.k===cd.wep);
    h.gear.weapon={slot:'weapon',base:b.k,plus:0,ego:null,rar:0,id:'st'+h.id};
  }
  if(cd.arm&&!rd.noarm){
    const b=ARM_BASES.find(a=>a.k===cd.arm);
    h.gear.armour={slot:'armour',base:b.k,plus:0,ego:null,rar:0,id:'sa'+h.id};
  }
  /* shield classes start with a buckler (fighter/gladiator) */
  if(cd.sh)h.gear.shield={slot:'shield',base:'buckler',plus:0,ego:null,rar:0,id:'ss'+h.id};
  /* base spells unlock by level from the caster's school; h.spells holds only the
     capstone(s) learned from spellbooks found in the dungeon */
  h.spells=[];
  h.mp=mpMaxOf(h);
  return h;
}
/* hero derived stats.
   Hot path: recomputed every sim tick, so the result is cached per hero and
   revalidated by a cheap fingerprint of everything the formula reads. Any
   input change (gear/enchant, level, statuses, god, mutations, tree rev,
   shop levels, stars, fame, runes, deaths, running-party size) alters the
   fingerprint and forces a clean recompute. */
const statCache=new WeakMap();
/* numeric fingerprint of every input heroStats reads — a rolling integer hash,
   no string allocation (was a per-tick GC/concat cost). Any input change alters
   the number; identical inputs collide to the same number → cache hit. */
function foldStr(hh,str){ for(let i=0;i<str.length;i++)hh=Math.imul(hh^str.charCodeAt(i),0x01000193)>>>0; return hh; }
function statKey(h,s){
  const g=h.gear;
  let hh=Math.imul(h.xl+1,2654435761)>>>0;
  hh=foldStr(hh,h.god||'-');
  hh=(hh^Math.imul((h.muts?h.muts.length:0)+1,40503)^Math.imul(h.piety|0,2246822519))>>>0;
  let sk=0; for(const q in h.skills)sk+=h.skills[q];
  hh=(hh^Math.imul(Math.round(sk*4)+1,3266489917))>>>0;
  for(const q in h.status)if(h.status[q]>0)hh=foldStr(hh,q);
  const slots=[g.weapon,g.armour,g.shield,g.ring1,g.ring2,g.ring3,g.ring4,g.ring5,g.ring6,g.ring7,g.ring8,g.amulet];
  for(const it of slots)hh=it?foldStr(hh,it.id+'.'+(it.plus||0)+(it.ego||'')):(Math.imul(hh,16777619)>>>0);
  let run=0; for(const x of s.heroes)if(x.state==='run')run++;
  let zp=0;
  for(const q in s.zupg)zp+=s.zupg[q];
  for(const q in s.pupg)zp+=13*s.pupg[q];
  if(s.vic){for(const q in s.vic.races)zp+=131;for(const q in s.vic.classes)zp+=257}
  const acc=run*7+treeSig(s)*13+(s.stat.wins||0)*131+(s.stat.deaths||0)*17+(s.runesTotal||0)*29+(s.stars[comboKey(h.race,h.cls)]||0)*97+zp*4099;
  return (hh^Math.imul(acc|0,2654435761))>>>0;
}
export function heroStats(h,s){
  const key=statKey(h,s);
  const hit=statCache.get(h);
  if(hit&&hit.k===key)return hit.v;
  const v=heroStatsCompute(h,s);
  statCache.set(h,{k:key,v});
  return v;
}
function heroStatsCompute(h,s){
  const rd=RACES[h.race],cd=CLASSES[h.cls];
  const starMul=1+.08*(s.stars[comboKey(h.race,h.cls)]||0);
  const rarMul=RARMUL[h.rarity];
  const g=h.gear;
  let ac=(rd.ac||0)+(cd.ac||0),ev=8+(rd.ev||0)+h.skills.dodging*.7,acc=h.xl*.9;
  if(rd.scales)ac+=Math.floor(h.xl/3); /* dragon scales grow with level instead of armour */
  let hpMax=(26+h.xl*8+h.skills.fighting*3)*rd.hp*rarMul*starMul*gHp(s);
  let wep=g.weapon?WEP_BASES.find(w=>w.k===g.weapon.base):null;
  /* DCSS: combat style is decided by the wielded weapon, not the class (casters always cast) */
  let style=cd.style;
  if(style!=='magic')style=(wep&&wep.rng)?'ranged':'melee';
  /* DCSS: skill of the specific weapon school (+cross-training), unarmed uses Unarmed Combat */
  const school=wep?wep.school:'unarmed';
  /* DCSS: Summonings has no attack spells — only combat schools deal direct damage */
  /* casters: spellpower = (spellcasting + best attack school)/2. Halved so it is
     low early (fragile start), but it climbs with skill and multiplies the spell
     tier, so damage ramps hard late — the caster arc: weak early, strong late */
  let wskill=style==='magic'?(h.skills.spellcasting+Math.max(h.skills.conjurations,h.skills.necromancy,h.skills.fire,h.skills.ice))/2:
    effSkill(h,school);
  let base=wep?wep.dmg+ (g.weapon.plus||0):(4+h.skills.unarmed*.6);
  /* casters get a LOW flat base (fragile early) — their damage comes from spellpower
     and the spell tier, so they start weaker than melee and overtake late */
  if(style==='magic')base=2+(wep&&wep.mag?3:0);
  /* racial physical might does not boost spells (strength is not spellpower) */
  const physMul=style==='magic'?1:rd.dmg;
  let dmg=(base+wskill*.9+h.xl*.55)*physMul*rarMul*starMul*gAtk(s);
  let aspd=(wep?wep.spd:1.2)*(cd.aspd||1);
  /* DCSS min delay: an untrained school swings heavy weapons slowly */
  if(style!=='magic')aspd*=speedMul(wskill,wep?wep.mds:8);
  let mag=1*(rd.mag||1)*(cd.mag||1);
  let leech=cd.drain||0,critc=.05+(cd.crit||0),regen=(rd.regen||1);
  let resAll=0,retal=rd.retal?1:0,evB=0;
  const slots=['armour','shield',...ringSlotKeys(h,s),'amulet'];
  const seen=new Set();
  const twoHanded=!!(wep&&wep.h2);
  for(const slot of slots.filter(x=>!seen.has(x)&&seen.add(x))){
    if(slot==='shield'&&twoHanded)continue; /* a two-hander occupies both hands */
    const it=g[slot];if(!it)continue;
    const info=itemInfo(it);
    ac+=info.ac||0;evB+=info.ev||0;
    if(info.hp)hpMax*=(1+info.hp);
    if(info.dmgP)dmg*=(1+info.dmgP);
    if(info.mag)mag*=(1+info.mag);
    if(info.regen)regen+=1;
    if(info.retal)retal=1;
    if(info.res)resAll+=.1;
    if(info.acc)acc+=info.acc;
  }
  if(g.armour){ac+=h.skills.armour*.5}
  ev+=evB;
  if(g.weapon){
    const info=itemInfo(g.weapon);
    if(info.mul)dmg*=info.mul;
    if(info.aspd)aspd*=info.aspd;
    if(info.leech)leech+=info.leech;
    if(info.ac)ac+=info.ac;
  }
  if(style==='magic'){
    dmg*=mag;
    if(cd.summon)dmg*=.7; /* the summoner pokes with weak darts — the army does the fighting */
    /* a low mana pool chokes casters: troll/minotaur make poor mages */
    if((rd.mp||1)<1)dmg*=(.6+.4*rd.mp);
    /* encumbrance: heavy armour and shield choke spellcasting; Armour skill mitigates */
    let enc=0;
    if(g.armour){const ab=ARM_BASES.find(a=>a.k===g.armour.base);enc+=ab.enc||0}
    if(g.shield&&!twoHanded){const sb=SH_BASES.find(a=>a.k===g.shield.base);enc+=sb.enc||0}
    const castPen=Math.max(0,enc*.08-h.skills.armour*.006)*(h.god==='sif_muna'?.5:1);
    dmg*=Math.max(.35,1-castPen);
  }
  if(h.god){const gf=f=>godField(s,h.god,f); /* Pantheon favor amplifies the bonus */
    const mel=gf('mel'),dg=gf('dmg'),mg=gf('mag'),hpb=gf('hp');
    if(mel&&style==='melee')dmg*=mel;
    if(dg)dmg*=dg;
    if(mg&&style==='magic')dmg*=mg;
    if(hpb)hpMax*=hpb;
  }
  acc+=wskill*.8+h.skills.fighting*.3;
  /* potion statuses */
  const stt=h.status||{};
  if(stt.might>0)dmg*=1.3;
  if(stt.berserk>0){dmg*=1.5;ac=Math.max(0,ac-4)}
  if(stt.haste>0)aspd*=1.4;
  if(stt.brill>0&&style==='magic')dmg*=1.3;
  if(stt.agility>0)ev+=5;
  if(stt.resist>0)resAll=Math.min(.8,resAll+.3);
  /* mutations */
  for(const mk of h.muts||[]){
    if(mk==='horns'&&style==='melee')dmg*=1.08;
    else if(mk==='claws'&&cd.wep===null)dmg*=1.15;
    else if(mk==='tough')ac+=3;
    else if(mk==='regenm')regen*=1.5;
    else if(mk==='frail')hpMax*=.9;
    else if(mk==='weak')dmg*=.92;
    else if(mk==='slowheal')regen*=.6;
    else if(mk==='fire_res'||mk==='cold_res')resAll=Math.min(.8,resAll+.05);
  }
  acc*=(1+memEff(s,'acc'));ev*=(1+memEff(s,'ev'));ac*=(1+memEff(s,'ac'));
  aspd*=(1+memEff(s,'aspd'));critc+=memEff(s,'crit');leech+=memEff(s,'leech');
  regen*=(1+memEff(s,'regen'));
  /* "Battle Bonds" keystone */
  if(memHas(s,'k_bonds')){
    const others=s.heroes.filter(x=>x.state==='run'&&x.id!==h.id).length;
    dmg*=1+.04*others;
  }
  /* class mechanics: monk dodge, chill from cryomancer/frost weapons */
  const dodge=cd.dodge?.1:0;
  let chill=cd.chill?1:0;
  if(g.weapon){const wi=itemInfo(g.weapon);if(wi.chill)chill=1}
  /* holy vs undead and venom blades */
  let vsUndead=1,venom=0,rPois=!!rd.rPois,lantern=false,waders=false; /* stone skin, naga blood, undead flesh */
  const gearAll=[g.weapon,g.armour,g.shield,g.ring1,g.ring2,g.ring3,g.ring4,g.ring5,g.ring6,g.ring7,g.ring8,g.amulet];
  for(const it of gearAll){
    if(!it)continue;
    const ii=itemInfo(it);
    if(ii.vsUndead)vsUndead=Math.max(vsUndead,ii.vsUndead);
    if(ii.venom)venom=1;
    if(ii.pois_res)rPois=true;
    if(ii.lantern)lantern=true;
    if(ii.waders)waders=true;
  }
  if(rd.und)vsUndead=1; /* DCSS: the undead cannot channel holy wrath */
  return {ac,ev,dmg,hpMax:Math.floor(hpMax),aspd,acc,leech,critc,regen,resAll,retal,dodge,chill,
    vsUndead,venom,rPois,lantern,waders,twoHanded,
    caster:style==='magic',mpMax:mpMaxOf(h),
    style,school,rng:style!=='melee'?5:(wep&&wep.reach?2:1),spd:rd.spd*gSpd(s)};
}

/** One gacha roll, pure state logic (UI adds sounds/animation on top).
    Returns {kind:'dup',res,sh} | {kind:'hero',res,h} | null when unaffordable. */
export function rollHero(s,premium,rng){
  if(premium){
    const cost=darkRollCost(s);
    if(s.runes<cost)return null;
    s.runes-=cost;
    s.darkRolls=(s.darkRolls||0)+1;
    /* the runes leave the guild's collection for good: they stop feeding the aura */
    s.runesSpent=(s.runesSpent||0)+cost;
  }
  else if(freeRollAvailable(s)){/* the guild pays when the party is gone */}
  else{const c=rollCost(s);if(s.gold<c)return null;s.gold-=c;s.rolls++}
  s.pity++;
  /* deterministic: summon #N draws the same stream on every device (unless a
     stream is passed in, e.g. by the headless simulator running CRN) */
  const r=rng||nextStream(s,'gacha');
  let res=rollCombo(s,premium,r);
  if(s.pity>=PITY_AT)res=pickComboOfTier(3,r);
  if(res.rarity===3)s.pity=0;
  const ck=comboKey(res.race,res.cls);
  const dup=s.seen[ck];
  s.seen[ck]=(s.seen[ck]||0)+1;
  if(dup&&s.heroes.some(x=>x.race===res.race&&x.cls===res.cls&&x.state!=='dead'&&x.state!=='victor')){
    const sh=Math.floor(SHARDS_PER[res.rarity]*3*shardMul(s));
    s.shards[ck]=(s.shards[ck]||0)+sh;
    return {kind:'dup',res,sh};
  }
  const h=newHero(res.race,res.cls,res.rarity,s);
  s.heroes.push(h);
  return {kind:'hero',res,h};
}
