import { t } from '../i18n/index.js';
export const WEP_BASES=[
  {k:'dagger',ov:'ov_w_dagger',n:'dagger',t:'w_dagger',dmg:4,spd:1.3,tier:0,school:'short_blades',mds:3},
  {k:'short_sword',ov:'ov_w_short_sword',n:'short sword',t:'w_short_sword',dmg:6,spd:1.15,tier:0,school:'short_blades',mds:5},
  {k:'hand_axe',ov:'ov_w_hand_axe',n:'hand axe',t:'w_hand_axe',dmg:7,spd:1.05,tier:0,school:'axes',mds:6},
  {k:'mace',ov:'ov_w_mace',n:'mace',t:'w_mace',dmg:8,spd:1,tier:0,school:'maces',mds:7},
  {k:'spear',ov:'ov_w_spear',n:'spear',t:'w_spear',dmg:7,spd:1.1,tier:0,reach:1,school:'polearms',mds:5},
  {k:'bow',ov:'ov_w_bow',n:'bow',t:'w_bow',dmg:7,spd:1.1,tier:0,rng:1,h2:1,school:'bows',mds:8},
  {k:'quarterstaff',ov:'ov_w_quarterstaff',n:'quarterstaff',t:'w_quarterstaff',dmg:7,spd:1.1,tier:0,mag:1,h2:1,school:'staves',mds:7},
  {k:'long_sword',ov:'ov_w_long_sword',n:'long sword',t:'w_long_sword',dmg:10,spd:1,tier:1,school:'long_blades',mds:8},
  {k:'war_axe',ov:'ov_w_war_axe',n:'war axe',t:'w_war_axe',dmg:11,spd:.95,tier:1,school:'axes',mds:10},
  {k:'morningstar',ov:'ov_w_morningstar',n:'morningstar',t:'w_morningstar',dmg:11,spd:.95,tier:1,school:'maces',mds:10},
  {k:'scimitar',ov:'ov_w_scimitar',n:'scimitar',t:'w_scimitar',dmg:11,spd:1.05,tier:1,school:'long_blades',mds:9},
  {k:'glaive',ov:'ov_w_glaive',n:'glaive',t:'w_glaive',dmg:13,spd:.85,tier:1,reach:1,h2:1,school:'polearms',mds:12},
  {k:'crossbow',ov:'ov_w_crossbow',n:'crossbow',t:'w_crossbow',dmg:13,spd:.8,tier:1,rng:1,h2:1,school:'crossbows',mds:10},
  {k:'great_sword',ov:'ov_w_great_sword',n:'great sword',t:'w_great_sword',dmg:16,spd:.8,tier:2,h2:1,school:'long_blades',mds:14},
  {k:'battleaxe',ov:'ov_w_battleaxe',n:'battleaxe',t:'w_battleaxe',dmg:17,spd:.75,tier:2,h2:1,school:'axes',mds:15},
  {k:'great_mace',ov:'ov_w_great_mace',n:'great mace',t:'w_great_mace',dmg:18,spd:.7,tier:2,h2:1,school:'maces',mds:16},
];
export const ARM_BASES=[
  {k:'robe',ov:'ov_a_robe',n:'robe',t:'a_robe',ac:2,ev:0,tier:0,enc:0},
  {k:'leather',ov:'ov_a_leather',n:'leather armour',t:'a_leather',ac:3,ev:0,tier:0,enc:1},
  {k:'ring_mail',ov:'ov_a_ring_mail',n:'ring mail',t:'a_ring_mail',ac:5,ev:-1,tier:0,enc:2},
  {k:'scale_mail',ov:'ov_a_scale_mail',n:'scale mail',t:'a_scale_mail',ac:6,ev:-1,tier:1,enc:3},
  {k:'chain_mail',ov:'ov_a_chain_mail',n:'chain mail',t:'a_chain_mail',ac:8,ev:-2,tier:1,enc:4},
  {k:'plate',ov:'ov_a_plate',n:'plate armour',t:'a_plate',ac:10,ev:-3,tier:2,enc:6},
  {k:'crystal_plate',ov:'ov_a_crystal_plate',n:'crystal plate armour',t:'a_crystal_plate',ac:14,ev:-4,tier:2,enc:7},
  {k:'dragon',ov:'ov_a_dragon',n:'dragon scale armour',t:'a_dragon',ac:11,ev:-1,tier:2,enc:5},
];
export const SH_BASES=[
  {k:'buckler',ov:'ov_s_buckler',n:'buckler',t:'s_buckler',ac:3,tier:0,enc:1},
  {k:'kite',ov:'ov_s_kite',n:'kite shield',t:'s_kite',ac:5,tier:1,enc:2},
  {k:'tower',ov:'ov_s_tower',n:'tower shield',t:'s_tower',ac:8,tier:2,enc:4},
];
export const WEP_EGOS=[
  {k:'flaming',n:'of flaming',mul:1.25},{k:'freezing',n:'of freezing',mul:1.25,chill:1},
  {k:'venom',n:'of venom',pois:1,mul:1.1},{k:'electro',n:'of electrocution',mul:1.3},
  {k:'holy',n:'of holy wrath',mul:1.2,vsUndead:1.6},{k:'speed',n:'of speed',aspd:1.3},
  {k:'vamp',n:'of vampirism',leech:.2},{k:'protect',n:'of protection',ac:4},
];
export const ARM_EGOS=[
  {k:'fire_res',n:'of fire resistance',res:1},{k:'cold_res',n:'of cold resistance',res:1},
  {k:'poison_res',n:'of poison resistance',pois_res:1},{k:'regen',n:'of regeneration',regen:1},
  {k:'ev',n:'of evasion',ev:4},{k:'mr',n:'of willpower',mr:1},
];
export const RING_KINDS=[
  {k:'r_dmg',n:'ring of slaying',t:'r_ring',dmg:.1},{k:'r_ac',n:'ring of protection',t:'r_ring2',ac:4},
  {k:'r_ev',n:'ring of evasion',t:'r_ring',ev:4},{k:'r_hp',n:'ring of vitality',t:'r_ring2',hp:.12},
  {k:'r_mp',n:'ring of magic',t:'r_ring',mag:.12},{k:'r_slay',n:'ring of slaughter',t:'r_ring2',dmg:.08,acc:4},
];
export const AMU_KINDS=[
  {k:'am_regen',n:'amulet of regeneration',t:'am_amulet',regen:1},
  {k:'am_guard',n:'amulet of the guardian',t:'am_amulet',ac:3,hp:.06},
  {k:'am_rage',n:'amulet of rage',t:'am_amulet',dmg:.12},
  {k:'am_reflect',n:'amulet of reflection',t:'am_amulet',ev:3,retal:1},
];
export const RANDART_NAMES=['Wrath','Dusk','Bane','Whisper','Winter\'s Sorrow','Devourer','Oath',
  'Shard of Dawn','Hunger','Eternity','Breath of the Abyss','Eye of the Storm','Last Argument','Serpent\'s Tongue'];

export function itemInfo(it){
  const out={};
  let b;
  if(it.slot==='weapon'){b=WEP_BASES.find(w=>w.k===it.base);out.dmgBase=b.dmg+it.plus}
  else if(it.slot==='armour'){b=ARM_BASES.find(w=>w.k===it.base);out.ac=b.ac+it.plus;out.ev=b.ev}
  else if(it.slot==='shield'){b=SH_BASES.find(w=>w.k===it.base);out.ac=b.ac+it.plus}
  else if(it.slot==='ring'){b=RING_KINDS.find(w=>w.k===it.base);
    Object.assign(out,{dmgP:b.dmg,ac:b.ac,ev:b.ev,hp:b.hp,mag:b.mag,acc:b.acc})}
  else if(it.slot==='amulet'){b=AMU_KINDS.find(w=>w.k===it.base);
    Object.assign(out,{regen:b.regen,ac:b.ac,hp:b.hp,dmgP:b.dmg,ev:b.ev,retal:b.retal})}
  if(it.ego){
    const e=WEP_EGOS.find(q=>q.k===it.ego)||ARM_EGOS.find(q=>q.k===it.ego);
    if(e)Object.assign(out,{mul:e.mul,aspd:e.aspd,leech:e.leech,chill:e.chill,res:e.res||e.pois_res,
      regen:out.regen||e.regen,ev:(out.ev||0)+(e.ev||0),ac:(out.ac||0)+(e.ac||0)});
  }
  if(it.ego){
    const e2=WEP_EGOS.find(q=>q.k===it.ego)||ARM_EGOS.find(q=>q.k===it.ego);
    if(e2){
      if(e2.pois)out.venom=1;
      if(e2.vsUndead)out.vsUndead=e2.vsUndead;
      if(e2.pois_res)out.pois_res=1;
    }
  }
  if(it.rand){out.dmgP=(out.dmgP||0)+.08;out.hp=(out.hp||0)+.05}
  if(it.unrandId){
    const u=unrandById(it.unrandId);
    if(u){
      const p=u.props;
      if(p.mul)out.mul=(out.mul||1)*p.mul;
      if(p.aspd)out.aspd=(out.aspd||1)*p.aspd;
      if(p.leech)out.leech=(out.leech||0)+p.leech;
      if(p.mag)out.mag=(out.mag||0)+p.mag;
      if(p.venom)out.venom=1;
      if(p.vsUndead)out.vsUndead=Math.max(out.vsUndead||1,p.vsUndead);
      if(p.ac)out.ac=(out.ac||0)+p.ac;
      if(p.hp)out.hp=(out.hp||0)+p.hp;
      if(p.res)out.res=1;
      if(p.pois_res)out.pois_res=1;
      if(p.regen)out.regen=1;
      if(p.dmg)out.dmgP=(out.dmgP||0)+p.dmg;
    }
  }
  return out;
}
export function itemName(it){
  let b;
  if(it.slot==='weapon')b=WEP_BASES.find(w=>w.k===it.base);
  else if(it.slot==='armour')b=ARM_BASES.find(w=>w.k===it.base);
  else if(it.slot==='shield')b=SH_BASES.find(w=>w.k===it.base);
  else if(it.slot==='ring')b=RING_KINDS.find(w=>w.k===it.base);
  else b=AMU_KINDS.find(w=>w.k===it.base);
  if(it.unrandId){const u=unrandById(it.unrandId);if(u)return t(u.n)}
  let n=(it.plus?('+'+it.plus+' '):'')+t(b.n);
  if(it.ego){const e=WEP_EGOS.find(q=>q.k===it.ego)||ARM_EGOS.find(q=>q.k===it.ego);
    if(e)n+=' '+t(e.n)}
  if(it.rand)n+=' «'+t(it.rand)+'»';
  return n;
}
export function itemTile(it){
  if(it.unrandId){const u=unrandById(it.unrandId);if(u)return u.t}
  if(it.slot==='ring')return RING_KINDS.find(w=>w.k===it.base).t;
  if(it.slot==='amulet')return AMU_KINDS.find(w=>w.k===it.base).t;
  const b=(it.slot==='weapon'?WEP_BASES:it.slot==='armour'?ARM_BASES:SH_BASES).find(w=>w.k===it.base);
  return b.t;
}


/* random item generator (forge + drops) */
let itemSeq=1;

export function randomItem(slotChoice,tier,rng){
  const slots=['weapon','armour','shield','ring','amulet'];
  const slot=slotChoice||slots[Math.floor(rng()*slots.length)];
  const roll=rng();
  const rar=roll<.5?0:roll<.8?1:roll<.95?2:3;
  const t=Math.min(2,tier+(rar>=2?1:0));
  const it={slot,plus:0,ego:null,rar,rand:null,id:'i'+(itemSeq++)+'_'+Date.now()%1e5};
  if(slot==='weapon'){
    const pool=WEP_BASES.filter(b=>b.tier<=t&&b.tier>=Math.max(0,t-1));
    it.base=pool[Math.floor(rng()*pool.length)].k;
    it.plus=Math.floor(rng()*(3+rar*2.5));
    if(rng()<.25+rar*.2)it.ego=WEP_EGOS[Math.floor(rng()*WEP_EGOS.length)].k;
  }else if(slot==='armour'){
    const pool=ARM_BASES.filter(b=>b.tier<=t&&b.tier>=Math.max(0,t-1));
    it.base=pool[Math.floor(rng()*pool.length)].k;
    it.plus=Math.floor(rng()*(2+rar*2));
    if(rng()<.2+rar*.2)it.ego=ARM_EGOS[Math.floor(rng()*ARM_EGOS.length)].k;
  }else if(slot==='shield'){
    const pool=SH_BASES.filter(b=>b.tier<=t);
    it.base=pool[Math.floor(rng()*pool.length)].k;
    it.plus=Math.floor(rng()*(2+rar*1.5));
  }else if(slot==='ring'){
    it.base=RING_KINDS[Math.floor(rng()*RING_KINDS.length)].k;
  }else{
    it.base=AMU_KINDS[Math.floor(rng()*AMU_KINDS.length)].k;
  }
  if(rar===3&&rng()<.6)it.rand=RANDART_NAMES[Math.floor(rng()*RANDART_NAMES.length)];
  return it;
}


/* ===================== unrands: named artefacts (one copy per account) ===================== */
export const UNRANDS=[
  {id:'singing',slot:'weapon',base:'long_sword',n:'the Singing Sword',t:'ur_singing',
    props:{mul:1.25,aspd:1.35},lore:'It SCREAMS. Constantly.'},
  {id:'demonaxe',slot:'weapon',base:'battleaxe',n:'the Obsidian Axe',t:'ur_demonaxe',
    props:{mul:1.6,leech:.15},lore:'Thirsts for blood, anyone\'s blood.'},
  {id:'trog',slot:'weapon',base:'war_axe',n:'the Wrath of Trog',t:'ur_trog',
    props:{mul:1.45,aspd:1.2},lore:'A god\'s rage, forged into steel.'},
  {id:'olgreb',slot:'weapon',base:'quarterstaff',n:'the Staff of Olgreb',t:'ur_olgreb',
    props:{mag:.35,venom:1},lore:'Oozes the venom of an ancient plague.'},
  {id:'vamptooth',slot:'weapon',base:'dagger',n:'the Vampire\'s Tooth',t:'ur_vamptooth',
    props:{mul:1.3,leech:.35},lore:'Drinks for two.'},
  {id:'holyaxe',slot:'weapon',base:'war_axe',n:'the Holy Axe',t:'ur_holyaxe',
    props:{mul:1.3,vsUndead:2.2},lore:'The undead remember its ring.'},
  {id:'lears',slot:'armour',base:'chain_mail',n:'Lear\'s Hauberk',t:'ur_lears',
    props:{ac:6,hp:.12},lore:'Four pieces, one legend.'},
  {id:'dragonskin',slot:'armour',base:'dragon',n:'the Dragonskin Cloak',t:'ur_dragonskin',
    props:{ac:4,res:1,pois_res:1},lore:'Supple as life, tough as death.'},
  {id:'ringmage',slot:'ring',base:'r_mp',n:'the Ring of the Mage',t:'ur_ringmage',
    props:{mag:.3},lore:'Whispered spells become a roar.'},
  {id:'bloodlust',slot:'amulet',base:'am_rage',n:'the Amulet of Bloodlust',t:'ur_bloodlust',
    props:{dmg:.2,leech:.1},lore:'Its heartbeat matches your victims\'.'},
  {id:'vitality',slot:'amulet',base:'am_regen',n:'the Amulet of Vitality',t:'ur_vitality',
    props:{hp:.2,regen:1},lore:'Refuses to let the soul go.'},
];
export const unrandById=id=>UNRANDS.find(u=>u.id===id);
export function makeUnrand(id){
  const u=unrandById(id);
  return {slot:u.slot,base:u.base,plus:5,ego:null,rar:3,
    rand:null,unrandId:id,id:'ur_'+id};
}

import { CLASSES } from './classes.js';
import { RACES } from './races.js';
import { effSkill, speedMul } from './skills.js';
/** Overall item score for auto-equip and the "better/worse" UI.
    A caster values a staff over a crossbow, and heavy armour is penalized for choking spellcasting. */
export function scoreItem(it,h){
  const i=itemInfo(it);
  let sc=(i.dmgBase||0)*2+(i.ac||0)*2+(i.dmgP||0)*40+(i.hp||0)*40+(i.mul?20:0)+(it.plus||0)*2;
  if(h&&RACES[h.race].und&&it.slot==='weapon'&&i.vsUndead)return -1e3; /* undead cannot wield holy */
  if(h&&CLASSES[h.cls].style!=='magic'&&it.slot==='weapon'){
    /* DCSS: the hero evaluates real DPS with his OWN school skill — an unfamiliar
       axe with its min delay loses to a well-trained blade */
    const b=WEP_BASES.find(w=>w.k===it.base);
    if(b){
      const eff=effSkill(h,b.school);
      sc=(b.dmg+(it.plus||0)+eff*.9)*b.spd*speedMul(eff,b.mds)*(i.mul||1)*(i.aspd||1)*2;
    }
  }
  if(h&&CLASSES[h.cls].style==='magic'){
    if(it.slot==='weapon'){
      const b=WEP_BASES.find(w=>w.k===it.base);
      sc=(b&&b.mag?40:0)+(i.dmgP||0)*40+(it.plus||0)*2+(i.mul?10:0);
    }
    const eb=it.slot==='armour'?ARM_BASES.find(a=>a.k===it.base):
             it.slot==='shield'?SH_BASES.find(a=>a.k===it.base):null;
    if(eb&&eb.enc)sc-=Math.max(0,eb.enc*.08-(h.skills.armour||0)*.006)*40;
  }
  return sc;
}
