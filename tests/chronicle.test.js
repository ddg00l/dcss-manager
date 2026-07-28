import { describe, it, expect, vi } from 'vitest';
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

describe('qualitative escalation: elite affixes and floor affixes', () => {
  it('elite frequency and affix count grow slowly and endlessly with NG', async () => {
    const { eliteChance, eliteAffixCount, rollEliteAffixes, ELITE_KEYS, affixLevel, readiness } = await import('../src/data/eliteAffixes.js');
    expect(eliteChance(0)).toBeCloseTo(.05);
    expect(eliteChance(100)).toBeCloseTo(.48); // capped frequency
    expect(eliteAffixCount(0)).toBe(1);
    expect(eliteAffixCount(20)).toBe(3);
    const { mulberry32 } = await import('../src/core/rng.js');
    const af = rollEliteAffixes(20, mulberry32(7));
    expect(af.length).toBe(3);
    expect(new Set(af).size).toBe(3);          // no duplicates
    for (const k of af) expect(ELITE_KEYS).toContain(k);
    /* Affix pressure is capped by readiness AND by NG. Letting it follow
       readiness uncapped was measured as overtightening the game to a halt and
       is reverted; see eliteAffixes.js. */
    const { makeState } = await import('../src/core/state.js');
    const weak = makeState(); weak.ng = 30;
    expect(affixLevel(weak, 30)).toBeLessThan(10); // out-prestiged a weak build → eased
    const strong = makeState(); strong.ng = 30; strong.stars = { a: 12 };
    expect(affixLevel(strong, 30)).toBe(30);       // kept pace → full intensity
  });
  it('deep-NG floors spawn affixed elites deterministically per seed', async () => {
    const { genFloor } = await import('../src/sim/mapgen.js');
    const mk = () => {
      const s = makeState();
      s.ng = 15;
      const h = newHero('human', 'fighter', 2, s);
      h.branch = 'dungeon'; h.floor = 5; h.seed = 123; h.regenN = 0; h.segIdx = 0;
      genFloor(h, s);
      return h.map;
    };
    const a = mk(), b = mk();
    const elitesA = a.monsters.filter(m => m.eliteAf);
    expect(elitesA.length).toBeGreaterThan(0); // NG15 => ~35% of monsters are elite
    expect(a.monsters.map(m => (m.eliteAf || []).join())).toEqual(b.monsters.map(m => (m.eliteAf || []).join()));
    expect(a.fafx).toBe(b.fafx); // floor affix is part of the seed too
  });
  it('shielded elites really absorb the first hits', async () => {
    const { heroAttack, startRun } = await import('../src/sim/tick.js');
    const s = makeState();
    const h = newHero('human', 'fighter', 2, s);
    s.heroes.push(h);
    startRun(h, s);
    const st = heroStats(h, s);
    const mo = { n: 'test', x: h.map.px + 1, y: h.map.py, hp: 1e6, maxHp: 1e6, ac: 0, ev: 0, dmg: 1, xp: 1, spd: 1, mv: 0, awake: true, eliteAf: ['shielded'], shield: 3 };
    h.map.monsters.push(mo);
    for (let i = 0; i < 3; i++) { h.rngState = 7; heroAttack(h, st, mo, s); } // rngState 7 → guaranteed hit
    expect(mo.hp).toBe(1e6); // three hits eaten by the shield
    h.rngState = 7; heroAttack(h, st, mo, s);
    expect(mo.hp).toBeLessThan(1e6); // the fourth lands
  });
  it('lantern and waders egos exist and surface in hero stats', async () => {
    const { ARM_EGOS } = await import('../src/data/items.js');
    expect(ARM_EGOS.some(e => e.k === 'lantern')).toBe(true);
    const s = makeState();
    const h = newHero('human', 'fighter', 0, s);
    h.gear.armour = { slot: 'armour', base: 'robe', plus: 0, ego: 'waders', rar: 1, id: 'wd' };
    expect(heroStats(h, s).waders).toBe(true);
    expect(heroStats(h, s).lantern).toBe(false);
  });
});
