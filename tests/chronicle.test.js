import { describe, it, expect } from 'vitest';
import { makeState } from '../src/core/state.js';
import { newHero, heroStats } from '../src/sim/hero.js';
import {
  recordVictory, greatRaces, greatClasses, greatMul,
  recordRunnerWin, CONTRACTS, cycleContract, checkContract, chronicleGoals,
  recordNemesisKill, nemesisLevel, avengeNemesis,
} from '../src/core/chronicle.js';
import { legendsReward } from '../src/core/prestige.js';
import { AFFIXES, affixKeyFor } from '../src/data/affixes.js';
import { PORTALS } from '../src/data/portals.js';

describe('Hall of the Great', () => {
  it('distinct victorious races and classes grant a permanent bonus', () => {
    const s = makeState();
    expect(greatMul(s)).toBe(1);
    recordVictory(s, { race: 'felid', cls: 'monk' });
    recordVictory(s, { race: 'felid', cls: 'monk' });   // repeats do not stack
    recordVictory(s, { race: 'troll', cls: 'monk' });
    expect(greatRaces(s).sort()).toEqual(['felid', 'troll']);
    expect(greatClasses(s)).toEqual(['monk']);
    expect(greatMul(s)).toBeCloseTo(1.03);
    const h = newHero('human', 'fighter', 0, s);
    const d0 = heroStats(h, s).dmg;
    recordVictory(s, { race: 'naga', cls: 'wizard' });
    expect(heroStats(h, s).dmg).toBeGreaterThan(d0); // flows into combat stats
  });
});

describe('runner arc', () => {
  it('the best rune count of the cycle multiplies the Legends payout', () => {
    const s = makeState();
    s.stat.wins = 1; s.cycBase = { wins: 0, runes: 0, uniq: 0, mem: 0 };
    const base = legendsReward(s);
    recordRunnerWin(s, { runes: ['a', 'b', 'c', 'd', 'e'] }); // 5 runes: +30%
    expect(legendsReward(s)).toBe(Math.max(1, Math.round(base * 1.3)));
    expect(s.stat.runnerBest).toBe(5);
  });
});

describe('guild contracts', () => {
  it('rotate per cycle, pay once and count lifetime completions', () => {
    const s = makeState();
    expect(cycleContract(s)).toBe(CONTRACTS[0]);
    s.prestiges = 1;
    expect(cycleContract(s)).toBe(CONTRACTS[1]); // commons
    const hero = newHero('human', 'fighter', 0, s);
    hero.rarity = 0;
    const r1 = checkContract(s, hero);
    expect(r1).toBeGreaterThan(0);
    expect(s.legends).toBe(r1);
    expect(checkContract(s, hero)).toBe(0); // once per cycle
    expect(s.stat.contracts).toBe(1);
  });
});

describe('chronicle goal feed', () => {
  it('starts with the first Orb and evolves into the mastery arcs', () => {
    const s = makeState();
    expect(chronicleGoals(s)[0].k).toBe('first_orb');
    s.stat.wins = 1; s.cycBase = { wins: 0, runes: 0, uniq: 0, mem: 0 };
    recordVictory(s, { race: 'human', cls: 'fighter' });
    const ks = chronicleGoals(s).map(g => g.k);
    expect(ks).not.toContain('first_orb');
    expect(ks.length).toBe(3);
    expect(ks).toContain('great_race');
  });
});

describe('nemeses', () => {
  it('grow with every slain hero and pay out on revenge', () => {
    const s = makeState();
    recordNemesisKill(s, 'sigmund');
    recordNemesisKill(s, 'sigmund');
    expect(nemesisLevel(s, 'sigmund')).toBe(2);
    expect(avengeNemesis(s, 'sigmund')).toBe(2);
    expect(nemesisLevel(s, 'sigmund')).toBe(0); // grudge settled
    expect(avengeNemesis(s, 'ijyb')).toBe(0);   // no grudge, no payout
  });
});

describe('daily affixes and the endless Ziggurat', () => {
  it('affix is deterministic per date and all affixes are sane', () => {
    expect(affixKeyFor('2026-07-26')).toBe(affixKeyFor('2026-07-26'));
    expect(affixKeyFor('2026-07-26')).not.toBe(undefined);
    const keys = new Set(['2026-07-26','2026-07-27','2026-07-28','2026-07-29','2026-07-30'].map(affixKeyFor));
    expect(keys.size).toBeGreaterThan(1); // days actually differ
    for (const a of Object.values(AFFIXES)) {
      expect(a.monHp).toBeGreaterThan(0);
      expect(a.gold).toBeGreaterThan(0);
    }
  });
  it('the Ziggurat is endless', () => {
    expect(PORTALS.zig.floors).toBeGreaterThan(100);
  });
});
