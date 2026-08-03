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
    expect(s.balV).toBe(7);
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
    const { zotScale, endgamePressure, ENDGAME_FROM, ENDGAME_PEAK, ZOT_LETHALITY, ZOT_EASE_FLOOR, ZOT_HARD_CEIL } = await import('../src/data/eliteAffixes.js');
    /* the pressure ramps with depth instead of stepping at the Zot boundary:
       concentrating it on one floor made every delve die in the same place */
    const mid = makeState(); mid.stars = { 'a': 12 };
    expect(endgamePressure(mid, ENDGAME_FROM - 1)).toBeCloseTo(1, 5);
    expect(endgamePressure(mid, ENDGAME_PEAK)).toBeCloseTo(zotScale(mid), 5);
    expect(endgamePressure(mid, (ENDGAME_FROM + ENDGAME_PEAK) / 2))
      .toBeGreaterThan(endgamePressure(mid, ENDGAME_FROM + 1));
    const fresh = makeState();
    const titan = makeState(); titan.stars = { 'human/fighter': 30 };
    titan.pupg = { p_legacy: 150, p_dmg: 20, p_hp: 20 };
    /* the Realm is lethal for everyone now — the Orb is meant to be an
       achievement, not a harvest unit — but it still eases for a guild that
       cannot yet finish it and hardens for one that long since could */
    expect(zotScale(fresh)).toBeLessThan(zotScale(titan));
    expect(zotScale(fresh)).toBeGreaterThanOrEqual(ZOT_LETHALITY * ZOT_EASE_FLOOR);
    expect(zotScale(titan)).toBeLessThanOrEqual(ZOT_LETHALITY * ZOT_HARD_CEIL);
  });
});


describe('the dungeon explains itself', () => {
  it('lists every pressure acting, and omits the ones that are not', async () => {
    const { dungeonPressure } = await import('../src/core/pressure.js');
    const s = makeState();
    const h = hero(s); startRun(h, s);
    const keys = p => p.map(x => x.key);
    /* a fresh account: no ladder, no cycle progress, not in Zot */
    let p = dungeonPressure(s, h);
    expect(keys(p)).not.toContain('ng');
    expect(keys(p)).not.toContain('cycle');
    expect(keys(p)).not.toContain('zot');
    expect(keys(p)).toContain('elite');       // always relevant, always shown
    /* now give it a history and put the hero in Zot */
    s.ng = 5; s.stat.wins = 7; s.cycBase = { wins: 0, runes: 0, uniq: 0, mem: 0 };
    h.branch = 'zot'; h.floor = 5;
    p = dungeonPressure(s, h);
    expect(keys(p)).toEqual(expect.arrayContaining(['ng', 'cycle', 'endgame']));
    /* every entry must carry a reason -- a number with no explanation is the
       thing this module exists to remove */
    for (const x of p) expect(x.why && x.why.length).toBeGreaterThan(10);
  });

  it('the number shown matches the multiplier the dungeon actually applies', async () => {
    const { pressureTotal } = await import('../src/core/pressure.js');
    const { ngMonMul, inCycleMul } = await import('../src/core/prestige.js');
    const { endgamePressure } = await import('../src/data/eliteAffixes.js');
    const { todayAffix } = await import('../src/data/affixes.js');
    const { brDepth } = await import('../src/data/branches.js');
    const s = makeState();
    s.ng = 6; s.stat.wins = 11; s.cycBase = { wins: 0, runes: 0, uniq: 0, mem: 0 };
    const h = hero(s); startRun(h, s); h.branch = 'zot'; h.floor = 4;
    /* mapgen multiplies monster HP/damage by exactly these terms */
    const afx = todayAffix();
    const real = ngMonMul(s) * inCycleMul(s) * endgamePressure(s, brDepth(h)) * Math.max(afx.monHp, afx.monDmg);
    expect(pressureTotal(s, h)).toBeCloseTo(real, 5);
  });
});

describe('a rune spent is a rune the guild stops drawing on', () => {
  it('the dark summoning costs aura, not just the rune', async () => {
    const { runeAura, runesKept, AURA_SPEND_WEIGHT } = await import('../src/core/economy.js');
    const { rollHero } = await import('../src/sim/hero.js');
    const s = makeState();
    s.tree.k_runeaura = 1;
    s.runesTotal = 100; s.runes = 50;
    const before = runeAura(s);
    expect(runesKept(s)).toBe(100);
    /* burn ten runes on premium summons */
    for (let i = 0; i < 10; i++) rollHero(s, true);
    expect(s.runesSpent).toBe(10);
    expect(runesKept(s)).toBe(100 - 10 * AURA_SPEND_WEIGHT);
    /* the trade is real: power actually left with them. Before this, a premium
       roll cost one rune at a flat price while the aura counted the LIFETIME
       total, so spending was free -- whale builds made 2200-3400 summons against
       a normal 411 and took twice the Orbs per day on identical trees. */
    expect(runeAura(s)).toBeLessThan(before);
  });

  it('an account that never spends keeps everything it earned', async () => {
    const { runeAura, runesKept } = await import('../src/core/economy.js');
    const s = makeState();
    s.tree.k_runeaura = 1; s.runesTotal = 400;
    expect(runesKept(s)).toBe(400);
    expect(runeAura(s)).toBeGreaterThan(1);
  });
});

describe('the dark summoning gets dearer the more you lean on it', () => {
  it('price escalates within a cycle and resets at prestige', async () => {
    const { darkRollCost, DARK_STEP } = await import('../src/core/economy.js');
    const { doPrestige } = await import('../src/core/prestige.js');
    const s = makeState();
    expect(darkRollCost(s)).toBe(1);
    s.darkRolls = DARK_STEP;      expect(darkRollCost(s)).toBe(2);
    s.darkRolls = DARK_STEP * 5;  expect(darkRollCost(s)).toBe(6);
    /* A flat price could not hold: runes accumulate faster than any fixed
       penalty grows, so charging the aura per spent rune faded exactly as its
       sqrt curve predicts -- whales led 22-29% at 8 days and 71-76% by day 30.
       Escalating attacks the conversion RATE, which cannot fade. */
    s.stat.wins = 50; s.runesTotal = 10; s.stat.uniqKills = 5; s.stat.memEarned = 5000;
    doPrestige(s);
    expect(darkRollCost(s)).toBe(1);   // a new cycle starts cheap again
  });
});

describe('portals are inside the difficulty system', () => {
  it('a ziggurat answers to readiness; a shallow portal does not', async () => {
    const { endgamePressure, ENDGAME_FROM } = await import('../src/data/eliteAffixes.js');
    const { zigStartDepth } = await import('../src/core/treasury.js');
    const strong = makeState(); strong.stars = { a: 12 }; strong.pupg = { p_legacy: 60 };
    /* Exempting portals left ziggurats outside the whole system: a strong guild
       met x9 in Zot and x1 in a Ziggurat, making the deepest content the safest
       place in the game -- measured records of 176, 177 and 260 floors against
       8-13 elsewhere. */
    expect(endgamePressure(strong, zigStartDepth(strong))).toBeGreaterThan(3);
    /* ...while a portal entered in the early Dungeon stays untouched */
    expect(endgamePressure(strong, ENDGAME_FROM - 3)).toBeCloseTo(1, 5);
  });
});

describe('a trapped delver withdraws from a portal, never descends', () => {
  it('leaves the portal instead of being pushed deeper', async () => {
    const { startRun, enterPortal, simTick, FLOOR_TURN_LIMIT } = await import('../src/sim/tick.js');
    const s = makeState();
    const h = hero(s); startRun(h, s);
    h.branch = 'dungeon'; h.floor = 5;
    enterPortal(h, s, 'sewer');
    expect(h.inPortal).toBeTruthy();
    const startFloor = h.inPortal.floor;
    /* pin the delver: pretend it has burned through the limit doing nothing */
    h.floorTurns = FLOOR_TURN_LIMIT + 1;
    simTick(h, s);
    /* Descending was the old behaviour and it was catastrophic in a Ziggurat:
       two depth levels per floor against monsters scaling as 1.4^depth meant a
       stuck seeker was pushed into strictly worse odds every 4000 turns, 998
       times over, until the portal hit its own 999-floor cap. */
    expect(h.inPortal === null || h.inPortal.floor <= startFloor).toBe(true);
  });
});
