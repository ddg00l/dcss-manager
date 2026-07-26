import { describe, it, expect } from 'vitest';
import { makeState } from '../src/core/state.js';
import { MONS, FAMILIES, FAMILY_OF, FAMILY_KEYS } from '../src/data/monsters.js';
import { GODS, GODKEYS, FAVOR_TIERS, godFavor, godFavorMul, godField } from '../src/data/gods.js';
import { FAMILY_TIERS, familyKills, familyTier, familyDmgBonus, monTier, TYPE_TIERS } from '../src/data/monsters.js';

describe('Bestiary families', () => {
  it('every monster belongs to exactly one family, and families list only real monsters', () => {
    const monKeys = Object.keys(MONS);
    // every monster is placed
    for (const k of monKeys) expect(FAMILY_OF[k], `${k} has no family`).toBeDefined();
    // no family lists a non-existent or duplicated monster
    const seen = new Set();
    for (const fam of FAMILY_KEYS) for (const k of FAMILIES[fam]) {
      expect(MONS[k], `${k} in ${fam} is not a monster`).toBeDefined();
      expect(seen.has(k), `${k} is in two families`).toBe(false);
      seen.add(k);
    }
    // the partition is exact: same count both ways
    expect(seen.size).toBe(monKeys.length);
  });
});

describe('Pantheon favor', () => {
  it('the 4 new gods exist with altar tiles, for 10 total', () => {
    expect(GODKEYS.length).toBe(10);
    for (const g of ['kikubaaqudgha', 'yredelemnul', 'cheibriados', 'nemelex']) {
      expect(GODS[g]).toBeDefined();
      expect(GODS[g].alt).toMatch(/^d_altar_/);
      expect(GODS[g].n).toBeTruthy();
    }
  });
  it('favor tiers step at the thresholds and cap at 4', () => {
    const s = makeState();
    expect(godFavor(s, 'trog')).toBe(0);
    s.pantheon.trog = FAVOR_TIERS[0]; expect(godFavor(s, 'trog')).toBe(1);
    s.pantheon.trog = FAVOR_TIERS[2]; expect(godFavor(s, 'trog')).toBe(3);
    s.pantheon.trog = 9999;           expect(godFavor(s, 'trog')).toBe(4); // capped
  });
  it('favor amplifies the bonus above 1x, hard-capped at +20% of the bonus', () => {
    const s = makeState();
    // Trog melee bonus is 0.30 (mel 1.30). At max favor: 0.30 * 1.20 = 0.36 → 1.36
    expect(godField(s, 'trog', 'mel')).toBe(1.3);           // no favor
    s.pantheon.trog = 9999;
    expect(godField(s, 'trog', 'mel')).toBeCloseTo(1.36);   // +20% of the 0.30 bonus
    // a hero with no favor and a penalty field is never worsened
    expect(godField(s, 'cheibriados', 'slow')).toBe(0.75);
    s.pantheon.cheibriados = 9999;
    expect(godField(s, 'cheibriados', 'slow')).toBe(0.75);  // penalty untouched by favor
  });
});

describe('Bestiary family damage bonus (capped eternal power)', () => {
  it('sums kills across the whole family and tiers at the thresholds', () => {
    const s = makeState();
    expect(familyKills(s, 'undead')).toBe(0);
    // undead = skeleton, zombie, wight, wraith, lich, ghoul_mon, mummy
    s.bestiary = { skeleton: 60, zombie: 30, lich: 15 }; // 105 total
    expect(familyKills(s, 'undead')).toBe(105);
    expect(familyTier(s, 'undead')).toBe(1);            // ≥ FAMILY_TIERS[0]=100
  });
  it('the bonus is +3% per tier and hard-capped at +12%', () => {
    const s = makeState();
    expect(familyDmgBonus(s, 'beast')).toBe(0);
    s.bestiary = { rat: FAMILY_TIERS[3] };              // enough for tier 4
    expect(familyTier(s, 'beast')).toBe(4);
    expect(familyDmgBonus(s, 'beast')).toBeCloseTo(0.12);
    s.bestiary = { rat: 1e9 };                          // absurd overkill
    expect(familyDmgBonus(s, 'beast')).toBeCloseTo(0.12); // still capped
  });
  it('per-type codex tier steps at 1/10/50/200', () => {
    const s = makeState();
    expect(monTier(s, 'orc')).toBe(0);
    s.bestiary.orc = 1;   expect(monTier(s, 'orc')).toBe(1);   // discovered
    s.bestiary.orc = 200; expect(monTier(s, 'orc')).toBe(4);   // slayer
    expect(TYPE_TIERS).toEqual([1, 10, 50, 200]);
  });
});

describe('eternal trackers survive migration and prestige', () => {
  it('a pre-endgame save loads with empty pantheon/bestiary and balV 4', async () => {
    const { loadState } = await import('../src/core/state.js');
    const s = makeState();
    delete s.balV; delete s.pantheon; delete s.bestiary;
    const storage = { data: { 'dcssmanager.save.v2': JSON.stringify(s) },
      getItem(k) { return this.data[k]; }, setItem(k, v) { this.data[k] = v; } };
    const loaded = loadState(storage);
    expect(loaded.balV).toBe(4);
    expect(loaded.pantheon).toEqual({});
    expect(loaded.bestiary).toEqual({});
  });
  it('doPrestige preserves the eternal Pantheon and Bestiary', async () => {
    const { doPrestige } = await import('../src/core/prestige.js');
    const s = makeState();
    s.pantheon = { trog: 3 }; s.bestiary = { orc: 120, lich: 5 };
    s.prestReq = 1;
    s.cycBase = { wins: 0, runes: 0, uniq: 0, mem: 0 };
    s.stat.wins = 2;
    expect(doPrestige(s)).toBeGreaterThan(0);
    expect(s.pantheon).toEqual({ trog: 3 });          // untouched by the reset
    expect(s.bestiary).toEqual({ orc: 120, lich: 5 });
  });
});
