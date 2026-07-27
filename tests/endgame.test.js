import { describe, it, expect } from 'vitest';
import { makeState } from '../src/core/state.js';
import { MONS, FAMILIES, FAMILY_OF, FAMILY_KEYS, familyKills, familyDmgBonus, familyMastery, monTier, TYPE_TIERS, FAM_STEP, FAM_CAP } from '../src/data/monsters.js';
import { GODS, GODKEYS, FAVOR_TIERS, FAVOR_STEP, godFavor, godFavorMul, godField } from '../src/data/gods.js';
import { ENDGAME_GATE, endgameUnlocked } from '../src/data/endgame.js';

describe('Bestiary families', () => {
  it('every monster belongs to exactly one family, and families list only real monsters', () => {
    const monKeys = Object.keys(MONS);
    for (const k of monKeys) expect(FAMILY_OF[k], `${k} has no family`).toBeDefined();
    const seen = new Set();
    for (const fam of FAMILY_KEYS) for (const k of FAMILIES[fam]) {
      expect(MONS[k], `${k} in ${fam} is not a monster`).toBeDefined();
      expect(seen.has(k), `${k} is in two families`).toBe(false);
      seen.add(k);
    }
    expect(seen.size).toBe(monKeys.length);
  });
});

describe('endgame gate', () => {
  it('locks all combat power until ENDGAME_GATE prestiges', () => {
    const s = makeState();
    expect(endgameUnlocked(s)).toBe(false);
    s.prestiges = ENDGAME_GATE - 1; expect(endgameUnlocked(s)).toBe(false);
    s.prestiges = ENDGAME_GATE;     expect(endgameUnlocked(s)).toBe(true);
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
  it('favor tiers step at the thresholds and cap at 4 — tracked from the first cycle', () => {
    const s = makeState();
    expect(godFavor(s, 'trog')).toBe(0);
    s.pantheon.trog = FAVOR_TIERS[0]; expect(godFavor(s, 'trog')).toBe(1);
    s.pantheon.trog = FAVOR_TIERS[2]; expect(godFavor(s, 'trog')).toBe(3);
    s.pantheon.trog = 9999;           expect(godFavor(s, 'trog')).toBe(4); // capped
  });
  it('amplifies the bonus above 1x (+40% max), but only past the gate', () => {
    const s = makeState();
    s.pantheon.trog = 9999;                               // max favor
    expect(godFavorMul(s, 'trog')).toBe(1);               // gated: no prestiges → no amp
    expect(godField(s, 'trog', 'mel')).toBe(1.3);
    s.prestiges = ENDGAME_GATE;                           // unlocked
    expect(godFavorMul(s, 'trog')).toBeCloseTo(1 + 4 * FAVOR_STEP);
    expect(godField(s, 'trog', 'mel')).toBeCloseTo(1.42); // 0.30 bonus * 1.40
  });
});

describe('Bestiary family damage bonus (gated, logarithmic, capped)', () => {
  it('sums kills across the whole family', () => {
    const s = makeState();
    expect(familyKills(s, 'undead')).toBe(0);
    s.bestiary = { skeleton: 60, zombie: 30, lich: 15 }; // undead members
    expect(familyKills(s, 'undead')).toBe(105);
  });
  it('is zero until the gate, then a log curve capped at FAM_CAP', () => {
    const s = makeState();
    s.bestiary = { rat: 100000 };
    expect(familyDmgBonus(s, 'beast')).toBe(0);           // gated
    s.prestiges = ENDGAME_GATE;
    expect(familyDmgBonus(s, 'beast')).toBeCloseTo(FAM_STEP * 5); // 0.05*log10(1e5)=0.25
    s.bestiary = { rat: 1e12 };
    expect(familyDmgBonus(s, 'beast')).toBe(FAM_CAP);     // capped
  });
  it('log compresses the ~30x spread between fast and slow families', () => {
    const s = makeState(); s.prestiges = ENDGAME_GATE;
    s.bestiary = { rat: 200000, war_gargoyle: 6000 };     // beast 200k vs construct 6k
    const beast = familyDmgBonus(s, 'beast'), con = familyDmgBonus(s, 'construct');
    expect(beast).toBeGreaterThan(con);
    expect(beast - con).toBeLessThan(0.08);               // ~33x kills → small gap
    expect(familyMastery(s, 'beast')).toBeGreaterThanOrEqual(familyMastery(s, 'construct'));
  });
  it('per-type codex tier steps at 1/10/50/200 (display, ungated)', () => {
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
    expect(loaded.balV).toBe(5);
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
    expect(s.pantheon).toEqual({ trog: 3 });
    expect(s.bestiary).toEqual({ orc: 120, lich: 5 });
  });
});
