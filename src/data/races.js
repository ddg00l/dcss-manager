export const RACES={
  human:{n:'Human',t:'pc_human',hp:1,dmg:1,ev:0,mp:1,spd:1,trainMul:1.15,d:'+15% training speed for all skills'},
  minotaur:{n:'Minotaur',t:'pc_minotaur',hp:1.15,dmg:1.2,ev:-2,mp:.6,spd:1,retal:1,d:'Retaliates with a headbutt when struck'},
  merfolk:{n:'Merfolk',t:'pc_merfolk',hp:1,dmg:1.05,ev:3,mp:1,spd:1,d:'+EV, master of polearms'},
  gargoyle:{n:'Gargoyle',t:'pc_gargoyle',hp:.9,dmg:1,ev:0,mp:.9,spd:1,ac:5,rPois:1,d:'+5 AC, stone skin resists poison'},
  draconian:{n:'Draconian',t:'pc_draconian',hp:1.05,dmg:1.05,ev:0,mp:1,spd:1,ac:3,breath:1,noarm:1,scales:1,d:'Breathes fire, scales instead of armour'},
  troll:{n:'Troll',t:'pc_troll',hp:1.5,dmg:1.3,ev:-3,mp:.5,spd:1,regen:3,noarm:1,d:'Mighty regeneration, no armour'},
  deep_elf:{n:'Deep Elf',t:'pc_deep_elf',hp:.75,dmg:.9,ev:2,mp:1.6,spd:1,mag:1.3,d:'+30% spell damage'},
  dwarf:{n:'Dwarf',t:'pc_dwarf',hp:1.1,dmg:1.05,ev:-1,mp:.8,spd:1,ac:2,shrug:1,d:'+AC, shrugs off damage'},
  spriggan:{n:'Spriggan',t:'pc_spriggan',hp:.7,dmg:.75,ev:6,mp:1.2,spd:1.3,d:'Very fast and slippery'},
  kobold:{n:'Kobold',t:'pc_kobold',hp:.85,dmg:.9,ev:3,mp:1,spd:1.1,gold:1.2,d:'+20% gold'},
  demonspawn:{n:'Demonspawn',t:'pc_demonspawn',hp:1.05,dmg:1.05,ev:0,mp:1.1,spd:1,mut:1,d:'Mutates as it levels'},
  ghoul:{n:'Ghoul',t:'pc_ghoul',hp:1.1,dmg:1.1,ev:-1,mp:.7,spd:.95,eat:1,und:1,rPois:1,d:'Undead: devours corpses, immune to poison and mutation'},
  naga:{n:'Naga',t:'pc_naga',hp:1.2,dmg:1.05,ev:-2,mp:1,spd:.85,ac:3,spit:1,rPois:1,d:'Spits poison and is immune to it, slow'},
  octopode:{n:'Octopode',t:'pc_octopode',hp:.85,dmg:1,ev:4,mp:1.1,spd:1,rings:8,noarm:1,d:'Eight rings, no armour'},
  felid:{n:'Felid',t:'pc_felid',hp:.65,dmg:.8,ev:5,mp:1.1,spd:1.2,lives:3,nowep:1,noarm:1,d:'Three lives, no weapons or armour'},
  tengu:{n:'Tengu',t:'pc_tengu',hp:.85,dmg:1,ev:4,mp:1.1,spd:1.15,d:'Flies, hard to hit'},
};
export const RKEYS=Object.keys(RACES);

/* Aptitudes: skill training speed = ×(1 + apt*0.2), like the DCSS aptitude tables */
export const APTS={
  human:     {},
  minotaur:  {weapon:2,fighting:2,armour:1,dodging:1,ranged:1,unarmed:1,spellcasting:-3,conjurations:-3,fire:-2,ice:-2,summonings:-2,necromancy:-2},
  merfolk:   {weapon:2,polearms:4,dodging:2,fighting:1,ice:1,armour:-2},
  gargoyle:  {armour:2,fighting:1,fire:1,dodging:-2,stealth:-1},
  draconian: {spellcasting:1,fire:2,conjurations:1,armour:-2,stealth:-1},
  troll:     {unarmed:2,fighting:1,spellcasting:-3,conjurations:-2,dodging:-2,stealth:-2,armour:-2},
  deep_elf:  {spellcasting:3,conjurations:2,necromancy:1,fire:1,ice:1,summonings:1,dodging:1,weapon:-1,armour:-2,fighting:-2},
  dwarf:     {armour:2,weapon:1,axes:2,maces:2,fighting:1,fire:1,spellcasting:-1,dodging:-1,stealth:-1},
  spriggan:  {dodging:3,stealth:3,spellcasting:1,armour:-3,weapon:-1,fighting:-2,ranged:-1},
  kobold:    {stealth:2,dodging:1,ranged:1,fighting:0},
  demonspawn:{necromancy:1,conjurations:1,invocations:0,armour:-1},
  ghoul:     {unarmed:1,fighting:1,necromancy:1,spellcasting:-1,dodging:-1},
  naga:      {stealth:2,spellcasting:1,dodging:-2,armour:-1},
  octopode:  {stealth:1,spellcasting:1,dodging:1},
  felid:     {stealth:2,dodging:2,unarmed:1,spellcasting:1},
  tengu:     {conjurations:2,dodging:2,fighting:1,armour:-2},
};
/* weapon schools inherit a generic aptitude: melee ones from weapon, missile ones from ranged */
const SCHOOL_FALLBACK={short_blades:'weapon',long_blades:'weapon',axes:'weapon',maces:'weapon',
  polearms:'weapon',staves:'weapon',bows:'ranged',crossbows:'ranged'};
export function aptMul(race,skill){
  const t=APTS[race]||{};
  let a=t[skill];
  if(a===undefined&&SCHOOL_FALLBACK[skill])a=t[SCHOOL_FALLBACK[skill]];
  return Math.max(.3,1+(a||0)*.2);
}
