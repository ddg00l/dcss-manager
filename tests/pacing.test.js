/* Pacing contracts introduced by the loop rebalance (Phases 1-2).
   These pin behaviours that were measured to be broken, so a future tuning pass
   cannot silently restore them. */
import { describe, it, expect } from 'vitest';
import { makeState } from '../src/core/state.js';
import { newHero } from '../src/sim/hero.js';
import { startRun, advanceHeroes, heroDie, runeBranchFor, giveRune, ZOT_RUNES } from '../src/sim/tick.js';
import { BRANCHES } from '../src/data/branches.js';
import { IN_CYCLE_PEAK, inCycleMul, nextPrestigeReq, prestigeReq, TARGET_DAYS, PREST_FLOOR } from '../src/core/prestige.js';
import { cofferCost, zigFee, provCostOf, PROVISIONS, goldScale } from '../src/core/treasury.js';
import { endgameUnlocked, ENDGAME_GATE } from '../src/data/endgame.js';

const hero = (s, race = 'minotaur', cls = 'fighter') => {
  const h = newHero(race, cls, 2, s);
  s.heroes.push(h);
  return h;
};

describe('Gates of Zot are per-delver, not per-account', () => {
  it('a runeless hero is turned away even on an account swimming in runes', () => {
    const s = makeState();
    s.runesTotal = 99;                       // the account has banked plenty
    const h = hero(s);
    startRun(h, s);
    h.runes = [];                            // this delver carries none
    /* the gate must send them after a rune instead of opening */
    expect(runeBranchFor(h)).toBeTruthy();
  });
  it('runeBranchFor only offers branches whose rune the hero lacks, then nothing', () => {
    const s = makeState();
    const h = hero(s);
    startRun(h, s);
    const runeBranches = Object.keys(BRANCHES).filter(k => BRANCHES[k].rune);
    expect(runeBranches.length).toBeGreaterThanOrEqual(ZOT_RUNES);
    h.runes = [];
    const first = runeBranchFor(h);
    expect(BRANCHES[first].rune).toBeTruthy();
    /* hand the hero every rune reachable from the ordered branches */
    h.runes = runeBranches.map(k => BRANCHES[k].rune);
    expect(runeBranchFor(h)).toBeNull();
  });
});

describe('a rune is both a key and a coin', () => {
  it('the first hero banks the rune for the guild and keeps the key', () => {
    const s = makeState();
    const name = BRANCHES.lair.rune;
    const h = hero(s);
    startRun(h, s);
    giveRune(h, name, s);
    expect(h.runes).toContain(name);          // key
    expect(s.runesTotal).toBe(1);             // coin
    expect(s.cycRunes).toContain(name);
  });
  it('the SECOND hero of a cycle still earns the key; the guild sells the duplicate', () => {
    const s = makeState();
    const name = BRANCHES.lair.rune;
    const first = hero(s); startRun(first, s);
    giveRune(first, name, s);
    const bankedAfterFirst = s.runesTotal;
    const goldBefore = s.gold;

    const second = hero(s); startRun(second, s);
    giveRune(second, name, s);
    /* This is the whole fix: before it, the duplicate returned early and the
       second delver of a cycle could NEVER hold three runes -- which is why the
       gate had to read the account total and stopped gating anything at all. */
    expect(second.runes).toContain(name);              // key: still earned
    expect(s.runesTotal).toBe(bankedAfterFirst);       // coin: banked once
    expect(s.gold).toBeGreaterThan(goldBefore);        // sold instead
  });
  it('a hero never stacks the same rune twice', () => {
    const s = makeState();
    const name = BRANCHES.lair.rune;
    const h = hero(s); startRun(h, s);
    giveRune(h, name, s);
    giveRune(h, name, s);
    expect(h.runes.filter(r => r === name)).toHaveLength(1);
  });
});

describe('the cycle escalates, and its bar is quoted in days of output', () => {
  it('escalates gently per Orb and never past the cap', () => {
    const at = (wins) => {
      const s = makeState();
      s.stat.wins = wins; s.cycBase = { wins: 0, runes: 0, uniq: 0, mem: 0 };
      return inCycleMul(s);
    };
    /* Gentle per Orb at ANY bar length. A fraction-of-the-cycle form walled short
       cycles instead of long ones: at the floor bar of 3 every victory added ~67%
       and accounts took three Orbs in thirty days, then stopped. */
    expect(at(0)).toBeCloseTo(1, 5);
    expect(at(1) / at(0)).toBeCloseTo(1.07, 2);
    expect(at(10)).toBeGreaterThan(at(5));
    /* ...and hard-capped, so no bar length can rebuild the original wall */
    expect(at(500)).toBeCloseTo(IN_CYCLE_PEAK, 5);
  });
  it('the bar asks for about TARGET_DAYS of the guild\'s own output', () => {
    const s = makeState();
    /* a brand-new account always gets a reachable first target */
    expect(nextPrestigeReq(s)).toBe(PREST_FLOOR);
    s.orbRate = 40;                       // a guild taking 40 Orbs a day
    expect(nextPrestigeReq(s)).toBe(Math.round(40 * TARGET_DAYS));
    s.orbRate = 4;                        // ...and one taking four
    expect(nextPrestigeReq(s)).toBe(Math.max(PREST_FLOOR, Math.round(4 * TARGET_DAYS)));
    /* cadence therefore holds at both ends instead of only in the middle: a
       fixed bar gave 1.8 prestiges/day at day eight and 3.9 by day twelve */
  });
});

describe('death pays for reach, not for dying', () => {
  it('a deep loss is worth several shallow ones', () => {
    const mk = reach => {
      const s = makeState();
      const h = hero(s);
      startRun(h, s);
      h.maxBrDepth = reach;
      h.xl = 10;
      h.rep = { gold: 0, kills: 0, floors: 0, notable: [] };
      const before = s.stat.memEarned;
      heroDie(h, 'a test', s);
      return s.stat.memEarned - before;
    };
    const shallow = mk(3), deep = mk(26);
    expect(deep).toBeGreaterThan(shallow * 2);
  });
});

describe('gold sinks track income instead of going stale', () => {
  it('every sink is quoted against the account gold multipliers', () => {
    const poor = makeState();
    const rich = makeState();
    rich.ng = 10;                       // deep ladder: the NG gold scalar is capped here
    rich.ascUpg = { am_fortune: 3 };    // and Ascension multiplies gold on top
    expect(goldScale(rich)).toBeGreaterThan(goldScale(poor) * 10);
    expect(cofferCost(rich)).toBeGreaterThan(cofferCost(poor) * 10);
    expect(zigFee(rich)).toBeGreaterThan(zigFee(poor) * 10);
    expect(provCostOf(rich, PROVISIONS[0])).toBeGreaterThan(provCostOf(poor, PROVISIONS[0]) * 10);
  });
});

describe('Ascension does not switch off the eternal endgame', () => {
  it('the endgame gate counts lifetime prestiges', () => {
    const s = makeState();
    s.prestiges = ENDGAME_GATE; s.prestigesTotal = ENDGAME_GATE;
    expect(endgameUnlocked(s)).toBe(true);
    s.prestiges = 0;                    // an Ascension just wiped the layer
    expect(endgameUnlocked(s)).toBe(true);
  });
});

describe('the loop does not livelock', () => {
  it('a hero driven for a long stretch keeps making progress or dies trying', () => {
    const s = makeState();
    s.ftue = { railDone: true, tours: {} };
    const h = hero(s);
    startRun(h, s);
    advanceHeroes(s, 6 * 3600, true);   // six hours of delving
    /* either the delve ended, or it is still descending somewhere real --
       never parked on floor 1 of the starting branch with nothing happening */
    const moved = h.state !== 'run' || (h.turn > 1000 && (h.maxBrDepth || 0) > 1);
    expect(moved).toBe(true);
  });
});

describe('Rune Aura curve change is not retroactive punishment', () => {
  const fakeStore = (save) => ({ getItem: () => JSON.stringify(save) });

  it('a veteran keeps the exact multiplier they had, and stops compounding', async () => {
    const { loadState } = await import('../src/core/state.js');
    const { runeAura } = await import('../src/core/economy.js');
    const RUNES = 574;
    /* a pre-migration save: the old aura was a flat +2% per lifetime rune */
    const old = { balV: 5, runesTotal: RUNES, tree: { root: 1, k_runeaura: 1 }, stat: {}, fame: [] };
    const s = loadState(fakeStore(old));
    expect(s.balV).toBe(6);
    /* nothing is taken away: the migrated aura equals the old one */
    expect(runeAura(s)).toBeCloseTo(1 + 0.02 * RUNES, 5);
    /* but it no longer runs away — 400 further runes add far less than the old
       linear curve would have (+8.0) */
    const before = runeAura(s);
    s.runesTotal += 400;
    expect(runeAura(s) - before).toBeLessThan(2);
  });

  it('an account without the keystone is granted nothing', async () => {
    const { loadState } = await import('../src/core/state.js');
    const old = { balV: 5, runesTotal: 300, tree: { root: 1 }, stat: {}, fame: [] };
    const s = loadState(fakeStore(old));
    expect(s.runeAuraLegacy).toBe(0);
  });

  it('a fresh account carries no legacy term', async () => {
    const { makeState } = await import('../src/core/state.js');
    expect(makeState().runeAuraLegacy).toBe(0);
  });
});

describe('the Realm of Zot answers to the guild that enters it', () => {
  it('eases for a guild that cannot land its first Orb, hardens for a titan', async () => {
    const { zotScale, ZOT_EASE_FLOOR, ZOT_HARD_CEIL } = await import('../src/data/eliteAffixes.js');
    const fresh = makeState();
    const titan = makeState(); titan.stars = { 'human/fighter': 30 };
    titan.pupg = { p_legacy: 150, p_dmg: 20, p_hp: 20 };
    expect(zotScale(fresh)).toBeLessThan(1);        // a fresh guild is given a chance
    expect(zotScale(titan)).toBeGreaterThan(1.5);   // and a titan is not
    expect(zotScale(fresh)).toBeGreaterThanOrEqual(ZOT_EASE_FLOOR);
    expect(zotScale(titan)).toBeLessThanOrEqual(ZOT_HARD_CEIL);
  });
});

