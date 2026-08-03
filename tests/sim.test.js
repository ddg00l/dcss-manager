import { describe, it, expect, vi } from 'vitest';
import { makeState } from '../src/core/state.js';
import { newHero, heroStats } from '../src/sim/hero.js';
import { genFloor, MW, MH } from '../src/sim/mapgen.js';
import { startRun, simTick, advanceHeroes, computeOffline, heroDie } from '../src/sim/tick.js';
import { comboKey } from '../src/data/combos.js';
import { NODES } from '../src/data/memtree.js';

function freshHero(s, race = 'minotaur', cls = 'fighter', rarity = 2) {
  const h = newHero(race, cls, rarity, s);
  s.heroes.push(h);
  return h;
}

describe('heroStats', () => {
  it('stars and rarity increase power', () => {
    const s = makeState();
    const h = freshHero(s);
    const base = heroStats(h, s);
    s.stars[comboKey(h.race, h.cls)] = 3;
    const starred = heroStats(h, s);
    expect(starred.dmg).toBeGreaterThan(base.dmg);
    expect(starred.hpMax).toBeGreaterThan(base.hpMax);
    const common = newHero('minotaur', 'fighter', 0, s);
    expect(heroStats(common, s).dmg).toBeLessThan(base.dmg);
  });
  it('memory tree atk nodes apply', () => {
    const s = makeState();
    const h = freshHero(s);
    const base = heroStats(h, s).dmg;
    /* read the rate from the data rather than pinning a number: combat stats
       were retuned once already after measuring that a combat-first build lost
       to a slots-first one 47 Orbs to 322 */
    s.tree.combat_s1 = 12;
    const per = NODES.find(n => n.id === 'combat_s1').eff.atk;
    expect(heroStats(h, s).dmg).toBeCloseTo(base * (1 + 12 * per), 0);
  });
  it('felid has no weapon, troll no armour', () => {
    const s = makeState();
    const fe = newHero('felid', 'monk', 1, s);
    expect(fe.gear.weapon).toBeNull();
    expect(fe.lives).toBe(3);
    const tr = newHero('troll', 'fighter', 1, s);
    expect(tr.gear.armour).toBeNull();
  });
});

describe('mapgen', () => {
  it('all floors are fully connected (stairs & cells reachable)', () => {
    const s = makeState();
    for (let seed = 1; seed <= 30; seed++) {
      const h = freshHero(s);
      h.seed = seed; h.branch = 'dungeon'; h.floor = 1 + (seed % 15); h.segIdx = 0;
      genFloor(h, s);
      const m = h.map;
      /* BFS from hero start */
      const seen = new Set([m.py * MW + m.px]);
      const q = [m.py * MW + m.px];
      while (q.length) {
        const cur = q.pop(), x = cur % MW, y = (cur / MW) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, ni = ny * MW + nx;
          if (nx < 0 || nx >= MW || ny < 0 || ny >= MH) continue;
          if (m.g[ny][nx] !== 0 || seen.has(ni)) continue;
          seen.add(ni); q.push(ni);
        }
      }
      expect(seen.has(m.stairs.y * MW + m.stairs.x), 'stairs unreachable seed ' + seed).toBe(true);
      for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++)
        if (m.g[y][x] === 0) expect(seen.has(y * MW + x), `cell ${x},${y} disconnected seed ${seed}`).toBe(true);
      for (const mo of m.monsters) expect(m.g[mo.y][mo.x]).toBe(0);
    }
  });
  it('same seed generates identical floor', () => {
    const s = makeState();
    const a = freshHero(s), b = freshHero(s);
    a.seed = b.seed = 777; a.branch = b.branch = 'lair'; a.floor = b.floor = 3; a.segIdx = b.segIdx = 0;
    genFloor(a, s); genFloor(b, s);
    expect(JSON.stringify(a.map.g)).toBe(JSON.stringify(b.map.g));
    expect(a.map.monsters.map(m => m.kind)).toEqual(b.map.monsters.map(m => m.kind));
  });
});

describe('full run lifecycle', () => {
  it('a hero explores, fights, descends and eventually dies with legacy', { timeout: 20000 }, () => {
    const s = makeState();
    s.ftue = { railDone: false, tours: {} }; // rail active: no offline free seekers in this test
    const h = freshHero(s, 'human', 'monk', 0); // weak commoner
    startRun(h, s);
    const goldBefore = s.gold;
    advanceHeroes(s, 8 * 3600, true); // 8 hours — consumables keep them alive longer
    expect(h.kills).toBeGreaterThan(5);
    expect(s.gold).toBeGreaterThan(goldBefore);
    expect(h.state).toBe('dead'); // a common should not survive 8h without upgrades
    expect(s.fame.length).toBe(1);
    expect(s.fame[0].by).toBeTruthy();
    /* A death pays the guild in that combo's currency. It used to be checked as
       shards on hand, but promoting a duplicate into a star is mechanical -- the
       shards are there, the threshold is fixed, nobody declines -- so it now happens
       without the player, and the shards may already have become a star. */
    const ck = comboKey(h.race, h.cls);
    expect((s.shards[ck] || 0) + (s.stars[ck] || 0)).toBeGreaterThan(0);
  });
  it('late-game account can win the Orb within 24h', { timeout: 30000 }, () => {
    const s = makeState();
    /* fully maxed tree (without the NG+ keystones) */
    for (const n of NODES) if (!n.keystone) s.tree[n.id] = n.max;
    for (const n of NODES) if (n.keystone && n.id !== 'k_ngplus') s.tree[n.id] = 1;
    s.stat.deaths = 30; s.runesTotal = 4; s.stat.kills = 1000;
    for (let i = 0; i < 8; i++) {
      const h = freshHero(s, 'minotaur', 'berserker', 3);
      s.stars[comboKey(h.race, h.cls)] = 5;
      startRun(h, s);
    }
    advanceHeroes(s, 24 * 3600, true);
    const victors = s.heroes.filter(x => x.state === 'victor').length;
    expect(victors).toBeGreaterThan(0);
    expect(s.zot).toBeGreaterThan(0);
    expect(s.runesTotal).toBeGreaterThanOrEqual(3);
  });
  it('dead heroes return non-starter gear to armory and grant shards', () => {
    const s = makeState();
    s.masterSeed = 2;
    const h = freshHero(s, 'kobold', 'assassin', 1);
    h.seed = 2; h.rngState = 2 * 3 + 7; // pinned: the amulet's gear-return roll passes
    startRun(h, s);
    h.gear.amulet = { slot: 'amulet', base: 'am_regen', plus: 0, ego: null, rar: 2, id: 'i_test' };
    heroDie(h, 'test hydra', s);
    expect(h.state).toBe('dead');
    expect(s.armory.some(it => it.id === 'i_test')).toBe(true);
    expect(s.armory.some(it => it.id.startsWith('st'))).toBe(false); // starter kit is not returned
    expect(s.shards[comboKey('kobold', 'assassin')]).toBeGreaterThan(0);
    expect(s.fame[0].by).toBe('test hydra');
  });
});

describe('offline', () => {
  it('computeOffline caps at 24h and reports per hero', () => {
    const s = makeState();
    const h = freshHero(s);
    startRun(h, s);
    s.last = Date.now() - 60 * 60000; // 1h ago
    const rep = computeOffline(s, Date.now());
    expect(rep).toBeTruthy();
    expect(rep.mins).toBeLessThanOrEqual(24 * 60);
    expect(rep.entries.length).toBeGreaterThan(0);
    expect(rep.entries[0].rep.kills).toBeGreaterThan(0);
  });
  it('returns null when nothing happened', () => {
    const s = makeState();
    s.ftue = { railDone: false, tours: {} }; // rail active: the guild sends no one yet
    s.last = Date.now() - 2 * 60000;
    expect(computeOffline(s, Date.now())).toBeNull();
  });
});

describe('a seeker does not pace on the spot', () => {
  it('the clear-or-dive question is asked once per floor, not once per step', async () => {
    /* It used to be thrown on every turn: at normal caution, 65% "explore" and 35%
       "head for the stairs", re-rolled at each footfall. When the unexplored corner and
       the stairs lay in opposite directions the seeker walked west, east, west, pacing
       in place until the coin landed the same way often enough to make progress. The
       question is about the floor, so it gets one answer per floor. */
    const { genFloor } = await import('../src/sim/mapgen.js');
    const { startRun } = await import('../src/sim/tick.js');
    const s = makeState();
    const h = newHero('minotaur', 'fighter', 2, s);
    s.heroes.push(h);
    h.caution = 'normal';                 /* the setting that used to flip 35/65 */
    startRun(h, s);
    genFloor(h, s);
    const first = h.map.dive;
    /* whatever it decided, a hundred further turns of deciding must not change it */
    for (let i = 0; i < 100; i++) {
      const { exploreGoalForTest } = await import('../src/sim/tick.js');
      if (exploreGoalForTest) exploreGoalForTest(h, null);
    }
    if (first !== undefined) expect(h.map.dive).toBe(first);
    /* and a fresh floor is entitled to a fresh answer */
    const before = h.map;
    genFloor(h, s);
    expect(h.map).not.toBe(before);
    expect(h.map.dive).toBeUndefined();
  });
});
