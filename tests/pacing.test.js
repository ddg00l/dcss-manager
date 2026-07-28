/* Pacing contracts introduced by the loop rebalance (Phases 1-2).
   These pin behaviours that were measured to be broken, so a future tuning pass
   cannot silently restore them. */
import { describe, it, expect } from 'vitest';
import { makeState } from '../src/core/state.js';
import { newHero } from '../src/sim/hero.js';
import { startRun, advanceHeroes, heroDie, runeBranchFor, giveRune, ZOT_RUNES } from '../src/sim/tick.js';
import { BRANCHES } from '../src/data/branches.js';
import { IN_CYCLE_GROWTH, inCycleMul, nextPrestigeReq, PREST_CAP_ABS } from '../src/core/prestige.js';
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

describe('in-cycle hardening escalates, and the bar it is priced against is capped', () => {
  it('each Orb of a cycle makes the dungeon harder', () => {
    const s = makeState();
    s.cycBase = { wins: 0, runes: 0, uniq: 0, mem: 0 };
    s.stat.wins = 0;
    expect(inCycleMul(s)).toBeCloseTo(1, 5);
    s.stat.wins = 8;
    expect(inCycleMul(s)).toBeCloseTo(Math.pow(IN_CYCLE_GROWTH, 8), 5);
    /* greed costs: strictly increasing */
    const at = w => { s.stat.wins = w; return inCycleMul(s); };
    expect(at(9)).toBeGreaterThan(at(3));
  });
  it('the bar is capped, so the hardest demandable fight is a fixed constant', () => {
    const s = makeState();
    s.stat.wins = 100000; s.ascensions = 50; /* absurdly deep account */
    expect(nextPrestigeReq(s)).toBe(PREST_CAP_ABS);
    /* the worst cycle the game can ask for must stay something a growing
       account can outpace -- this is the guard against the measured loop death */
    expect(Math.pow(IN_CYCLE_GROWTH, PREST_CAP_ABS)).toBeLessThan(10);
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
    /* the measured stall case: reached Zot:4 again and again at readiness ~13 */
    const struggling = makeState(); struggling.stars = { 'human/fighter': 4 };
    const titan = makeState(); titan.stars = { 'human/fighter': 30 };
    titan.pupg = { p_legacy: 150, p_dmg: 20, p_hp: 20 };
    expect(zotScale(fresh)).toBeLessThan(1);              // a fresh guild is given a chance
    expect(zotScale(struggling)).toBeLessThan(1);
    expect(zotScale(titan)).toBeGreaterThan(1.5);         // and a titan is not
    /* bounded at both ends: never trivial, never impossible */
    expect(zotScale(fresh)).toBeGreaterThanOrEqual(ZOT_EASE_FLOOR);
    expect(zotScale(titan)).toBeLessThanOrEqual(ZOT_HARD_CEIL);
  });

  it('Zot answers to readiness harder than the dungeon at large', async () => {
    const { genFloor } = await import('../src/sim/mapgen.js');
    const hpIn = (branch, floor, mut) => {
      const s = makeState(); mut(s);
      const h = newHero('human', 'fighter', 0, s);
      s.heroes.push(h);
      h.branch = branch; h.floor = floor; h.seed = 11; h.regenN = 0;
      genFloor(h, s);
      return h.map.monsters.reduce((a, m) => a + m.maxHp, 0) / h.map.monsters.length;
    };
    const weak = s => {};
    const strong = s => { s.stars = { 'human/fighter': 30 }; s.pupg = { p_legacy: 150 }; };
    /* Affix pressure follows readiness EVERYWHERE — a strong guild meets more
       elites in the Dungeon too, which is the intended design. */
    const dungeonRatio = hpIn('dungeon', 5, strong) / hpIn('dungeon', 5, weak);
    expect(dungeonRatio).toBeGreaterThan(1);
    /* Zot carries that plus its own scaling, so it must react distinctly harder:
       it is the gate every other system sits behind, in both directions. */
    const zotRatio = hpIn('zot', 3, strong) / hpIn('zot', 3, weak);
    expect(zotRatio).toBeGreaterThan(dungeonRatio * 1.5);
  });
});

describe('losing a seeker is a real loss', () => {
  it('kit is destroyed on death, but artefacts never are', async () => {
    const { GEAR_RECOVERED } = await import('../src/sim/tick.js');
    expect(GEAR_RECOVERED).toBeLessThan(1);
    const s = makeState();
    const h = hero(s); startRun(h, s);
    h.gear.weapon = { slot: 'weapon', base: 'long_sword', plus: 0, ego: null, rar: 3, id: 'u9', unrandId: 'singing' };
    h.rep = { gold: 0, kills: 0, floors: 0, notable: [] };
    heroDie(h, 'a test', s);
    /* the eternal Collection is never destroyed */
    expect(s.armory.some(i => i.unrandId === 'singing')).toBe(true);
  });

  it('mourning prices the RATE of losses, and fades', async () => {
    const { mourningMul, MOURN_CAP } = await import('../src/core/economy.js');
    const { rollCost } = await import('../src/core/economy.js');
    const { advanceHeroes } = await import('../src/sim/tick.js');
    const s = makeState();
    const calm = rollCost(s);
    expect(mourningMul(s)).toBe(1);
    /* a conveyor: many losses in quick succession */
    s.mourning = 6;
    expect(rollCost(s)).toBeGreaterThan(calm * 2);
    expect(mourningMul(s)).toBeLessThanOrEqual(MOURN_CAP); // never unbounded
    /* ...but a guild that stops losing seekers recovers: mostly within an hour,
       clear within two. Grief is a running cost of churn, not a permanent tax. */
    advanceHeroes(s, 3600, true);
    expect(mourningMul(s)).toBeLessThan(1.25);
    advanceHeroes(s, 3600, true);
    expect(mourningMul(s)).toBeLessThan(1.02);
  });
});
