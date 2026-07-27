/* Ascension: the meta-prestige layer above prestige. After ENOUGH prestiges the
   player may Ascend — a hard reset that wipes the whole prestige layer (prestiges,
   Legends, the Memory tree incl. keystones, Zot upgrades, gold, heroes) in return
   for Ascendancy (✦), spent on a tree of GAME-CHANGING upgrades: rule-breakers,
   meta-multipliers, new content and automation. Survives an Ascension: the eternal
   Collection (combo stars, unrands, Hall/Great, Pantheon, Bestiary) and Ascension
   itself. Leaf-ish module: imports only NODES for the full tree wipe. */

export const ASCEND_GATE = 10; /* prestiges in the current ascension-cycle before Ascension unlocks */
export const ASC = '✦';

export const ascLevel = s => s.ascensions || 0;
export const ascendancy = s => s.ascendancy || 0;
export const ascensionUnlocked = s => (s.prestiges || 0) >= ASCEND_GATE;

/* Ascendancy scales sub-linearly with the Orbs won SINCE the last Ascension, so
   the first ascension is only a taste (the tree can't be exhausted in one go) and
   later ascensions — richer, thanks to Ascension power — keep paying out instead
   of decelerating like a lifetime-highwater would. TUNABLE (calibrated via sim). */
export const ASC_K = 0.7;
export const ascGain = s => Math.floor(ASC_K * Math.sqrt(Math.max(0, (s.stat?.wins || 0) - (s.ascBase || 0))));
export const canAscend = s => ascensionUnlocked(s) && ascGain(s) > 0;

/* ---- the Ascension tree: four flavours of game-changer ---- */
export const ASC_REGIONS = {
  rule:  { n: 'Rule-breakers', col: '#e0a03c' },
  mult:  { n: 'Ascendant might', col: '#d9534f' },
  content: { n: 'New worlds', col: '#5e9ee0' },
  auto:  { n: 'Godhood', col: '#7bc470' },
};

/* the tree canvas + its centre (the Ascension hub the four arms radiate from) */
export const ASC_W = 760, ASC_H = 720, ASC_CX = 380, ASC_CY = 360;

/* id, flavour, name, desc, icon, base cost (✦), growth g, max level, req[], x, y */
export const ASC_NODES = [
  /* --- meta-multipliers: dwarf everything that came before (arm: up) --- */
  { id: 'am_might',  fam: 'mult', n: 'Ascendant Might',  d: '+30% damage to all heroes, per level', icon: 'ur_singing',      base: 2, g: 1.6, max: 10, req: [], x: 320, y: 265 },
  { id: 'am_vigor',  fam: 'mult', n: 'Divine Vigor',     d: '+30% health to all heroes, per level',  icon: 'a_crystal_plate', base: 2, g: 1.6, max: 10, req: [], x: 440, y: 265 },
  { id: 'am_fortune',fam: 'mult', n: 'Golden Ascendant', d: '×2 gold and Memory gain, per level',     icon: 'i_gold',          base: 2, g: 1.8, max: 6,  req: ['am_might'], x: 320, y: 165 },
  { id: 'am_legacy', fam: 'mult', n: 'Eternal Legacy',   d: '+3% damage and health, per level — no cap', icon: 'i_orb',        base: 3, g: 1.25, max: 999, req: ['am_fortune'], x: 320, y: 70 },

  /* --- rule-breakers: change how prestige & runs work (arm: right) --- */
  { id: 'ar_gear',   fam: 'rule', n: 'Engraved Armoury', d: 'All gear survives prestige, not just artefacts', icon: 'a_plate',  base: 3, g: 1, max: 1, req: [], x: 500, y: 305 },
  { id: 'ar_tree',   fam: 'rule', n: 'Living Memory',    d: 'Prestige keeps the whole Memory tree, not just keystones', icon: 'i_scroll', base: 4, g: 1, max: 1, req: ['ar_gear'], x: 610, y: 270 },
  { id: 'ar_martyr', fam: 'rule', n: 'Martyrdom',        d: 'Hero deaths grant ×3 Dungeon Memory',   icon: 'i_corpse',        base: 2, g: 1, max: 1, req: [], x: 500, y: 415 },
  { id: 'ar_twin',   fam: 'rule', n: 'Twin Delve',       d: '+1 expedition slot, forever',           icon: 'pc_human',        base: 3, g: 1.7, max: 3, req: ['ar_martyr'], x: 610, y: 450 },

  /* --- new content (extends the rule arm) --- */
  { id: 'ac_abyssorb', fam: 'content', n: 'Abyssal Orb', d: 'The Abyss route also carries out Orbs — endless farming now prestiges', icon: 'd_abyss', base: 5, g: 1, max: 1, req: ['ar_twin'], x: 690, y: 540 },

  /* --- automation / godhood (arm: down-left). The Memory tree already automates
     summon/dispatch/equip/dismantle via keystones — but those burn at Ascension.
     Eternal Guild makes all of it permanent; Wheel of Ages adds auto-prestige,
     which no keystone does. --- */
  { id: 'au_guild',    fam: 'auto', n: 'Eternal Guild',  d: 'All auto-management (summon, dispatch, equip, dismantle) is permanent — it never burns away when you ascend', icon: 'i_rune', base: 3, g: 1, max: 1, req: [], x: 300, y: 470 },
  { id: 'au_prestige', fam: 'auto', n: 'Wheel of Ages',  d: 'Auto-prestige the moment the cycle allows it — hands-free forever', icon: 'd_altar', base: 5, g: 1, max: 1, req: ['au_guild'], x: 250, y: 575 },
];

export const ascNodeById = id => ASC_NODES.find(n => n.id === id);
export const ascNodeLvl = (s, id) => (s.ascUpg && s.ascUpg[id]) || 0;
export const ascHas = (s, id) => ascNodeLvl(s, id) > 0;
export const ascNodeCost = (s, n) => Math.ceil(n.base * Math.pow(n.g, ascNodeLvl(s, n.id)));
export const ascCanBuy = (s, n) => {
  if (ascNodeLvl(s, n.id) >= n.max) return false;
  if (n.req.length && !n.req.every(r => ascHas(s, r))) return false;
  return ascendancy(s) >= ascNodeCost(s, n);
};
export function buyAscNode(s, n) {
  if (!ascCanBuy(s, n)) return false;
  s.ascendancy -= ascNodeCost(s, n);
  s.ascUpg = s.ascUpg || {};
  s.ascUpg[n.id] = ascNodeLvl(s, n.id) + 1;
  s.rev = (s.rev || 0) + 1; /* effects feed heroStats — bust the cache */
  return true;
}

/* ---- effect getters (imported by economy/tick/prestige) ---- */
export const ascDmgMul = s => (1 + 0.30 * ascNodeLvl(s, 'am_might')) * (1 + 0.03 * ascNodeLvl(s, 'am_legacy'));
export const ascHpMul  = s => (1 + 0.30 * ascNodeLvl(s, 'am_vigor')) * (1 + 0.03 * ascNodeLvl(s, 'am_legacy'));
export const ascGoldMul = s => Math.pow(2, ascNodeLvl(s, 'am_fortune'));
export const ascSlots  = s => ascNodeLvl(s, 'ar_twin');
export const ascDeathMemMul = s => ascHas(s, 'ar_martyr') ? 3 : 1;
export const ascKeepGear = s => ascHas(s, 'ar_gear');
export const ascKeepTree = s => ascHas(s, 'ar_tree');
export const ascAbyssOrb = s => ascHas(s, 'ac_abyssorb');
export const ascAutoGuild = s => ascHas(s, 'au_guild'); /* summon/dispatch/equip/dismantle, permanent */
export const ascAutoPrestige = s => ascHas(s, 'au_prestige');

/* ---- the Ascension itself: a hard reset of the whole prestige layer ---- */
export function doAscension(s) {
  if (!canAscend(s)) return 0;
  const gain = ascGain(s);
  s.ascendancy = ascendancy(s) + gain;
  s.ascBase = s.stat.wins || 0; /* next ascension counts only Orbs won from here */
  s.ascensions = ascLevel(s) + 1;

  /* wipe the entire prestige layer — keystones, Legends, Zot upgrades and all */
  s.prestiges = 0; s.ng = 0; s.legends = 0; s.pupg = {};
  s.zupg = {}; s.zot = 0;
  s.heroes = [];
  s.armory = s.armory.filter(it => it.unrandId); /* only artefacts survive */
  s.gold = 200; s.scrap = 0; s.runes = 0; s.rolls = 0; s.forges = 0; s.pity = 0;
  s.mem = 0; s.tree = { root: 1 }; /* the whole Memory tree burns down */
  s.pendingDeaths = []; s.pendingWins = [];
  s.progress = { D: 0, Lair: 0, Orc: 0, Elf: 0, Vaults: 0, Depths: 0, Zot: 0, Abyss: 0 };
  s.cofferBuys = 0; s.zigFunded = 0; s.provisions = {};
  s.cycRunes = []; s.cycRunnerBest = 0; s.cycContractDone = 0;
  s.prestReq = 1;
  s.cycBase = { wins: s.stat.wins || 0, runes: s.runesTotal || 0, uniq: s.stat.uniqKills || 0, mem: s.stat.memEarned || 0 };
  s.rev = (s.rev || 0) + 1;
  if (typeof window !== 'undefined' && window.__cloudPush) window.__cloudPush(true);
  return gain;
}
