import { describe, it, expect } from 'vitest';
import { makeState } from '../src/core/state.js';
import { doPrestige, nextPrestigeReq, PREST_CAP } from '../src/core/prestige.js';
import { maxSlots } from '../src/core/economy.js';
import {
  ASCEND_GATE, ASC_K, ascGain, canAscend, ascensionUnlocked, doAscension,
  ascNodeById, ascNodeLvl, ascHas, ascCanBuy, buyAscNode, ascNodeCost,
  ascDmgMul, ascHpMul, ascGoldMul, ascSlots, ascDeathMemMul, ascKeepGear, ascKeepTree,
} from '../src/core/ascension.js';

describe('ascension gate + gain', () => {
  it('unlocks only at the prestige gate', () => {
    const s = makeState();
    s.stat.wins = 100;
    expect(ascensionUnlocked(s)).toBe(false);
    expect(canAscend(s)).toBe(false);
    s.prestiges = ASCEND_GATE;
    expect(ascensionUnlocked(s)).toBe(true);
    expect(canAscend(s)).toBe(true);
  });

  it('gain scales sub-linearly with Orbs won since the last ascension', () => {
    const s = makeState();
    s.stat.wins = 100;
    expect(ascGain(s)).toBe(Math.floor(ASC_K * Math.sqrt(100))); // ascBase 0
    s.ascBase = 84; // 16 Orbs into a fresh ascension-cycle
    expect(ascGain(s)).toBe(Math.floor(ASC_K * Math.sqrt(16)));
    s.ascBase = 100; // nothing new since ascending
    expect(ascGain(s)).toBe(0);
    expect(canAscend({ ...s, prestiges: ASCEND_GATE })).toBe(false); // gate met but no gain
  });
});

describe('doAscension: hard reset of the prestige layer', () => {
  const rich = () => {
    const s = makeState();
    s.prestiges = 12; s.stat.wins = 100; s.legends = 500; s.zot = 200;
    s.mem = 1e6; s.gold = 1e9; s.scrap = 40; s.runes = 5; s.ng = 12;
    s.pupg = { p_dmg: 5 }; s.zupg = { zatk: 5 };
    s.tree = { root: 1, combat_s1: 3 };
    s.stars = { 'human/fighter': 3 }; s.shards = { 'human/fighter': 2 };
    s.fame = [{ won: true }]; s.pantheon = { trog: 4 }; s.bestiary = { rat: 99 };
    s.armory = [{ id: 'i1' }, { unrandId: 'x', id: 'ur_x' }];
    return s;
  };

  it('wipes the whole prestige layer and grants Ascendancy', () => {
    const s = rich();
    const g = doAscension(s);
    expect(g).toBe(Math.floor(ASC_K * Math.sqrt(100)));
    expect(s.ascendancy).toBe(g);
    expect(s.ascensions).toBe(1);
    expect(s.ascBase).toBe(100); // next cycle counts only Orbs from here
    // wiped
    expect(s.prestiges).toBe(0);
    expect(s.legends).toBe(0);
    expect(s.zot).toBe(0);
    expect(s.ng).toBe(0);
    expect(s.mem).toBe(0);
    expect(s.gold).toBe(200);
    expect(s.tree).toEqual({ root: 1 });
    expect(s.pupg).toEqual({});
    expect(s.zupg).toEqual({});
    expect(s.prestReq).toBe(1);
  });

  it('the eternal Collection survives', () => {
    const s = rich();
    doAscension(s);
    expect(s.stars['human/fighter']).toBe(3);
    expect(s.shards['human/fighter']).toBe(2);
    expect(s.fame.length).toBe(1);
    expect(s.pantheon.trog).toBe(4);
    expect(s.bestiary.rat).toBe(99);
    expect(s.stat.wins).toBe(100); // lifetime stats persist (drive the gain)
    expect(s.armory).toEqual([{ unrandId: 'x', id: 'ur_x' }]); // only artefacts kept
  });

  it('does nothing when not eligible', () => {
    const s = makeState(); s.stat.wins = 100; // gate not met (0 prestiges)
    expect(doAscension(s)).toBe(0);
    expect(s.ascensions || 0).toBe(0);
  });
});

describe('prestige requirement resets with ascension (no dead-end loop)', () => {
  it('a never-ascended account climbs floor+sqrt, then stops at the cap', () => {
    const s = makeState();
    s.stat.wins = 9;
    expect(nextPrestigeReq(s)).toBe(3 + Math.floor(1.1 * Math.sqrt(9))); // ascLevel 0
    s.stat.wins = 100;                       // still climbing the sqrt curve
    expect(nextPrestigeReq(s)).toBe(3 + Math.floor(1.1 * Math.sqrt(100)));
    s.stat.wins = 100000;                    // ...and the cap eventually binds
    expect(nextPrestigeReq(s)).toBe(PREST_CAP);
  });

  it('after ascending, the bar drops back to the floor and re-climbs per cycle', () => {
    const s = makeState();
    s.stat.wins = 100; s.ascBase = 100; // just ascended
    expect(nextPrestigeReq(s)).toBe(3); // wins - ascBase = 0 → the floor
    s.stat.wins = 104; // four Orbs into the fresh ascension-cycle
    expect(nextPrestigeReq(s)).toBe(3 + Math.floor(1.1 * Math.sqrt(4)));
    // a weak post-ascension account is NOT walled by a lifetime-high bar
    expect(nextPrestigeReq(s)).toBeLessThan(3 + Math.floor(1.1 * Math.sqrt(104)));
  });
});

describe('ascension tree: buying, gating, multipliers', () => {
  it('buys nodes, enforces cost and prerequisites', () => {
    const s = makeState();
    s.ascendancy = 100;
    const might = ascNodeById('am_might');
    expect(ascCanBuy(s, might)).toBe(true);
    expect(buyAscNode(s, might)).toBe(true);
    expect(ascNodeLvl(s, 'am_might')).toBe(1);
    expect(s.ascendancy).toBe(100 - ascNodeCost(makeState(), might)); // first level cost spent

    // a gated node cannot be bought until its requirement is owned
    const abyss = ascNodeById('ac_abyssorb'); // needs ar_twin
    expect(ascHas(s, 'ar_twin')).toBe(false);
    expect(ascCanBuy(s, abyss)).toBe(false);

    // insufficient Ascendancy blocks the buy
    s.ascendancy = 0;
    expect(ascCanBuy(s, ascNodeById('am_vigor'))).toBe(false);
    expect(buyAscNode(s, ascNodeById('am_vigor'))).toBe(false);
  });

  it('effect getters read the tree', () => {
    const s = makeState();
    expect(ascDmgMul(s)).toBe(1);
    expect(ascHpMul(s)).toBe(1);
    expect(ascGoldMul(s)).toBe(1);
    expect(ascSlots(s)).toBe(0);
    expect(ascDeathMemMul(s)).toBe(1);
    s.ascUpg = { am_might: 3, am_vigor: 2, am_fortune: 2, ar_twin: 2, ar_martyr: 1 };
    expect(ascDmgMul(s)).toBeCloseTo(1 + 0.30 * 3);
    expect(ascHpMul(s)).toBeCloseTo(1 + 0.30 * 2);
    expect(ascGoldMul(s)).toBe(4); // 2^2
    expect(ascSlots(s)).toBe(2);
    expect(maxSlots(s)).toBe(1 + 2); // base + twin (no memory slots)
    expect(ascDeathMemMul(s)).toBe(3);
  });
});

describe('rule-breaker nodes change prestige', () => {
  const prestigeable = () => {
    const s = makeState();
    s.prestReq = 1; s.cycBase = { wins: 0, runes: 0, uniq: 0, mem: 0 };
    s.stat.wins = 1; // one Orb this cycle → canPrestige, positive reward
    s.armory = [{ id: 'i1' }, { unrandId: 'u', id: 'ur_u' }];
    s.tree = { root: 1, combat_s1: 2 }; // a small (non-keystone) node
    return s;
  };

  it('by default prestige keeps only artefacts and burns small tree nodes', () => {
    const s = prestigeable();
    expect(ascKeepGear(s)).toBe(false);
    expect(ascKeepTree(s)).toBe(false);
    expect(doPrestige(s)).toBeGreaterThan(0);
    expect(s.armory).toEqual([{ unrandId: 'u', id: 'ur_u' }]);
    expect(s.tree.combat_s1).toBeUndefined();
  });

  it('Engraved Armoury + Living Memory keep all gear and the whole tree', () => {
    const s = prestigeable();
    s.ascUpg = { ar_gear: 1, ar_tree: 1 };
    expect(ascKeepGear(s)).toBe(true);
    expect(ascKeepTree(s)).toBe(true);
    doPrestige(s);
    expect(s.armory.length).toBe(2); // both items kept
    expect(s.tree.combat_s1).toBe(2); // tree preserved
  });
});
