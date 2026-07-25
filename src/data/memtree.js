/* "Dungeon Memory" — a single radial upgrade tree (CIFI-modules style).
   Small nodes are multi-level increments; keystones are radical mechanics,
   gated by account achievements. No respec. */

export const REGIONS = {
  combat:  { a: 0,   col: '#d96055', n: 'Fighting' },
  dungeon: { a: 60,  col: '#8fbf5a', n: 'Dungeon' },
  gacha:   { a: 120, col: '#b06be0', n: 'Summoning' },
  economy: { a: 180, col: '#ecc95e', n: 'Economy' },
  forge:   { a: 240, col: '#9aa7b8', n: 'Forge' },
  heroes:  { a: 300, col: '#5e9ee0', n: 'Heroes' },
};

export const CX = 900, CY = 860;
const rad = a => a * Math.PI / 180;
const pos = (a, r) => ({ x: Math.round(CX + Math.cos(rad(a)) * r), y: Math.round(CY + Math.sin(rad(a)) * r) });

export const NODES = [];
const byId = {};
function node(id, region, a, r, def) {
  const p = pos(a, r);
  const n = { id, region, x: p.x, y: p.y, max: 1, base: 5, g: 1.16, req: [], eff: {}, ...def };
  NODES.push(n); byId[id] = n;
  return n;
}

/* DCSS icons for stat nodes */
const STAT_ICON = {
  atk: 'sk_long_blades', hp: 'sk_fighting', acc: 'sk_throwing', aspd: 'sk_short_blades',
  crit: 'sk_stealth', leech: 'sk_necromancy', ev: 'sk_dodging', ac: 'sk_armour',
  regen: 'sk_charms', spd: 'sk_translocations', gold: 'i_gold', xp: 'sk_spellcasting',
  drop: 'sk_evocations', shard: 'sk_transmutations', gdisc: 'sk_hexes', rune: 'i_rune',
  fdisc: 'sk_forgecraft', fqual: 'sk_fire_magic', pots: 'i_potion', mem: 'sk_invocations',
  slot: 'pc_human',
};

/* stat descriptions of small nodes: [effKey, "per level", label] */
const STAT = {
  atk:   [.010, '+1% damage for all heroes'],
  hp:    [.010, '+1% health for all heroes'],
  acc:   [.012, '+1.2% accuracy'],
  aspd:  [.006, '+0.6% attack speed'],
  crit:  [.002, '+0.2% crit chance'],
  leech: [.002, '+0.2% lifesteal'],
  ev:    [.010, '+1% EV'],
  ac:    [.010, '+1% AC'],
  regen: [.015, '+1.5% regeneration'],
  spd:   [.008, '+0.8% delving speed'],
  gold:  [.012, '+1.2% gold'],
  xp:    [.012, '+1.2% experience'],
  drop:  [.010, '+1% find chance'],
  shard: [.020, '+2% shards'],
  gdisc: [.006, '−0.6% summon cost'],
  rune:  [.001, '+0.1% rune chance from uniques'],
  fdisc: [.008, '−0.8% forging cost'],
  fqual: [.008, '+0.8% to forging pluses'],
  pots:  [1,    '+1 potion per delve'],
  mem:   [.015, '+1.5% Memory'],
  slot:  [1,    '+1 expedition slot'],
};

/* root — unlocked from the very start */
node('root', 'economy', 0, 0, {
  n: 'Memory Awakening', d: 'Every floor, unique and hero death leaves a trace. Memory fuels this tree.',
  icon: 'd_altar', max: 1, base: 0,
});

/* ---- regions: a spine of 8 nodes + 2 side branches of 4 nodes each ---- */
const SPINES = {
  combat:  ['atk', 'acc', 'aspd', 'atk', 'crit', 'leech', 'atk', 'aspd'],
  dungeon: ['spd', 'drop', 'ev', 'spd', 'drop', 'mem', 'spd', 'drop'],
  gacha:   ['shard', 'gdisc', 'shard', 'rune', 'gdisc', 'shard', 'rune', 'shard'],
  economy: ['gold', 'xp', 'gold', 'mem', 'xp', 'gold', 'mem', 'gold'],
  forge:   ['fdisc', 'ac', 'fqual', 'fdisc', 'ac', 'fqual', 'fdisc', 'fqual'],
  heroes:  ['hp', 'regen', 'hp', 'pots', 'hp', 'regen', 'hp', 'pots'],
};
const SIDES = {
  combat:  [['crit', 'leech', 'acc', 'atk'], ['aspd', 'atk', 'crit', 'leech']],
  dungeon: [['ev', 'mem', 'drop', 'spd'], ['drop', 'ev', 'mem', 'spd']],
  gacha:   [['gdisc', 'shard', 'rune', 'shard'], ['shard', 'gdisc', 'shard', 'rune']],
  economy: [['xp', 'gold', 'mem', 'gold'], ['gold', 'mem', 'xp', 'gold']],
  forge:   [['ac', 'fqual', 'fdisc', 'ac'], ['fqual', 'ac', 'fdisc', 'fqual']],
  heroes:  [['regen', 'pots', 'hp', 'regen'], ['hp', 'hp', 'regen', 'pots']],
};
const RING_R = 82;
for (const [reg, spine] of Object.entries(SPINES)) {
  const A = REGIONS[reg].a;
  let prev = 'root';
  spine.forEach((sk, i) => {
    const ring = i + 1;
    const [per, label] = STAT[sk];
    const id = reg + '_s' + ring;
    node(id, reg, A, ring * RING_R, {
      n: label.replace(/^[+−]\S+ /, '').replace(/^./, c => c.toUpperCase()),
      d: label + ' per level',
      eff: { [sk]: per },
      icon: STAT_ICON[sk],
      max: sk === 'pots' ? 3 : sk === 'slot' ? 1 : 10 + ring * 2,
      base: Math.ceil(4 * Math.pow(2.1, ring)), g: 1.14 + ring * .008,
      req: [prev],
    });
    prev = id;
  });
  SIDES[reg].forEach((branch, bi) => {
    const off = bi === 0 ? -19 : 19;
    const startRing = bi === 0 ? 2 : 4;
    let bprev = reg + '_s' + startRing;
    branch.forEach((sk, j) => {
      const ring = startRing + j + 1;
      const [per, label] = STAT[sk];
      const id = reg + '_b' + bi + '_' + j;
      node(id, reg, A + off, ring * RING_R, {
        n: label.replace(/^[+−]\S+ /, '').replace(/^./, c => c.toUpperCase()),
        d: label + ' per level',
        eff: { [sk]: per },
        icon: STAT_ICON[sk],
        max: sk === 'pots' ? 3 : 12 + ring,
        base: Math.ceil(5 * Math.pow(2.05, ring)), g: 1.15 + ring * .007,
        req: [bprev],
      });
      bprev = id;
    });
  });
}
/* expedition slots — a chain in the heroes region (deep and expensive) */
/* the 2nd seeker is early and cheap (target: ~20-30 minutes of gameplay);
   from there the chain goes deeper and gets steeply more expensive */
['slot1', 'slot2', 'slot3', 'slot4'].forEach((id, i) => {
  node('hslot' + i, 'heroes', REGIONS.heroes.a + (i % 2 ? 8 : -8), [3, 5, 6, 7][i] * RING_R + 30, {
    n: ['2nd', '3rd', '4th', '5th'][i] + ' seeker', d: '+1 concurrent expedition',
    icon: 'pc_human', eff: { slot: 1 }, max: 1,
    base: [230, 900, 4000, 18000][i], g: 1,
    req: [i === 0 ? 'heroes_s2' : 'hslot' + (i - 1)],
  });
});
/* bridges between regions on the 4th ring */
const REGK = Object.keys(REGIONS);
REGK.forEach((reg, i) => {
  const next = REGK[(i + 1) % REGK.length];
  const a = REGIONS[reg].a + 30;
  node('bridge_' + reg, reg, a, 4 * RING_R, {
    n: 'Memory Bridge', d: '+1% damage and +1% gold per level',
    icon: 'sk_air_magic', eff: { atk: .01, gold: .01 }, max: 8,
    base: 220, g: 1.3,
    req: [reg + '_s4', next + '_s4'],
  });
});

/* ---- keystones: radical mechanics, gated by an achievement ---- */
function keystone(id, region, aOff, ring, def) {
  const A = REGIONS[region].a + aOff;
  return node(id, region, A, ring * RING_R + 40, { keystone: true, max: 1, g: 1, ...def });
}
keystone('k_bonds', 'combat', 0, 9, {
  n: '⟐ Battle Bonds', d: 'Each hero in the dungeon grants the others +4% damage.',
  icon:'sk_shields',base: 900, req: ['combat_s8'], ach: { kills: 500, t: '500 kills' },
});
keystone('k_runeaura', 'combat', 26, 6, {
  n: '⟐ Rune Auras', d: 'Every rune collected grants a permanent +2% damage and +2% gold.',
  icon:'i_rune',base: 700, req: ['bridge_combat'], ach: { runes: 1, t: 'collect a rune' },
});
keystone('k_abyss', 'dungeon', 0, 9, {
  n: '⟐ Abyssal Rift', d: 'Unlocks the Abyss: an endless branch with every monster, +50% gold, a rune every 10 floors.',
  icon:'d_abyss',base: 1500, req: ['dungeon_s8'], ach: { runes: 3, t: '3 runes' },
});
keystone('k_elite', 'dungeon', -26, 7, {
  n: '⟐ Elite Floors', d: '15% of floors are elite: monsters +50% HP, but loot and Memory ×2.',
  icon:'m_two_headed_ogre',base: 600, req: ['dungeon_b0_3'], ach: { uniq: 3, t: 'kill 3 uniques' },
});
keystone('k_autosummon', 'gacha', 0, 9, {
  n: '⟐ Auto-Summon', d: 'A free slot and gold ≥ 2× the cost — summoning happens on its own.',
  icon:'sk_summonings',base: 800, req: ['gacha_s8'], ach: { rolls: 20, t: '20 summons' },
});
keystone('k_heirs', 'gacha', 26, 7, {
  n: '⟐ Heirs', d: 'A new hero of the combo starts at XL = 1 + a third of its best fallen ancestor\'s XL.',
  icon:'i_scroll',base: 1000, req: ['gacha_b1_2'], ach: { deaths: 10, t: '10 deaths' },
});
keystone('k_deathmem', 'economy', 0, 9, {
  n: '⟐ Lessons of Defeat', d: 'Memory from hero deaths ×2.',
  icon:'i_corpse',base: 500, req: ['economy_s8'], ach: { deaths: 5, t: '5 deaths' },
});
keystone('k_offcap', 'economy', -26, 7, {
  n: '⟐ Sleepless Caravans', d: 'Offline progress cap 24h → 72h.',
  icon:'d_stairs_up',base: 900, req: ['economy_b0_3'], ach: { memEarned: 2000, t: 'accumulate 2000 Memory' },
});
keystone('k_zotplus', 'economy', 26, 6, {
  n: '⟐ Zot\'s Bounty', d: '+50% Zot essence from victories.',
  icon:'i_orb',base: 1200, req: ['bridge_economy'], ach: { wins: 1, t: 'victory' },
});
keystone('k_autodismantle', 'forge', -26, 7, {
  n: '⟐ Auto-Dismantle', d: 'Common (grey) items are dismantled into scrap automatically.',
  icon:'w_hand_axe',base: 500, req: ['forge_b0_3'], ach: { dismantled: 10, t: 'dismantle 10 items' },
});
keystone('k_autoequip', 'forge', 0, 9, {
  n: '⟐ Auto-Equip', d: 'Before departing, the hero equips the best gear from the armory automatically.',
  icon:'a_chain_mail',base: 800, req: ['forge_s8'], ach: { forged: 10, t: 'forge 10 items' },
});
keystone('k_ring3', 'forge', 26, 8, {
  n: '⟐ Third Ring', d: 'All heroes gain a third ring slot.',
  icon:'r_ring',base: 1400, req: ['forge_b1_3'], ach: { forged: 20, t: 'forge 20 items' },
});
keystone('k_ghosts', 'heroes', -26, 8, {
  n: '⟐ Ghosts of the Fallen', d: 'Each fallen hero permanently grants +0.5% damage (up to +30%).',
  icon:'m_wraith',base: 700, req: ['heroes_b0_3'], ach: { deaths: 25, t: '25 deaths' },
});
keystone('k_ngplus', 'heroes', 26, 9, {
  n: '⟐ New Depth', d: 'NG+: monsters ×2 stronger, all rewards ×2.5. Forever.',
  icon:'m_orb_of_fire',base: 2000, req: ['hslot2'], ach: { wins: 1, t: 'victory' },
});

/* ---- API ---- */
export const nodeById = id => byId[id];
export const treeLvl = (s, id) => s.tree[id] || 0;
export const memHas = (s, id) => treeLvl(s, id) > 0;
export function nodeCost(s, n) { return Math.ceil(n.base * Math.pow(n.g, treeLvl(s, n.id))); }
export function memEff(s, key) {
  let sum = 0;
  for (const n of NODES) {
    const l = s.tree[n.id];
    if (l && n.eff[key]) sum += n.eff[key] * l;
  }
  return sum;
}
export function achMet(s, n) {
  if (!n.ach) return true;
  const a = n.ach, st = s.stat;
  if (a.kills && st.kills < a.kills) return false;
  if (a.deaths && st.deaths < a.deaths) return false;
  if (a.uniq && st.uniqKills < a.uniq) return false;
  if (a.rolls && s.rolls < a.rolls) return false;
  if (a.forged && st.forged < a.forged) return false;
  if (a.dismantled && st.dismantled < a.dismantled) return false;
  if (a.runes && s.runesTotal < a.runes) return false;
  if (a.wins && !s.fame.some(f => f.won)) return false;
  if (a.memEarned && st.memEarned < a.memEarned) return false;
  return true;
}
export function canBuy(s, n) {
  if (treeLvl(s, n.id) >= n.max) return false;
  if (n.id !== 'root' && !n.req.some(r => memHas(s, r))) return false;
  if (!achMet(s, n)) return false;
  return s.mem >= nodeCost(s, n);
}
export function buyNode(s, n) {
  if (!canBuy(s, n)) return false;
  s.mem -= nodeCost(s, n);
  s.tree[n.id] = treeLvl(s, n.id) + 1;
  return true;
}
/** Memory gain with tree multipliers applied */
export function gainMem(s, amount, isDeath) {
  let v = amount * (1 + memEff(s, 'mem'));
  if (isDeath && memHas(s, 'k_deathmem')) v *= 2;
  v = Math.ceil(v);
  s.mem += v; s.stat.memEarned += v;
  return v;
}
