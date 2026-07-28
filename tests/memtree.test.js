import { describe, it, expect } from 'vitest';
import { makeState, loadState } from '../src/core/state.js';
import {
  NODES, nodeById, treeLvl, memHas, nodeCost, memEff, achMet, canBuy, buyNode, gainMem,
} from '../src/data/memtree.js';
import { maxSlots, gAtk, ghostMul, runeAura, rollCost } from '../src/core/economy.js';
import { newHero } from '../src/sim/hero.js';
import { comboKey } from '../src/data/combos.js';
import { BRANCHES } from '../src/data/branches.js';
import { MONS } from '../src/data/monsters.js';
import { genFloor } from '../src/sim/mapgen.js';

describe('tree structure', () => {
  it('has CIFI scale: ≥110 nodes, ≥12 keystones', () => {
    expect(NODES.length).toBeGreaterThanOrEqual(110);
    expect(NODES.filter(n => n.keystone).length).toBeGreaterThanOrEqual(12);
  });
  it('ids are unique and req edges resolve', () => {
    const ids = new Set();
    for (const n of NODES) {
      expect(ids.has(n.id), 'dup ' + n.id).toBe(false);
      ids.add(n.id);
      for (const r of n.req) expect(nodeById(r), n.id + ' → ' + r).toBeDefined();
    }
  });
  it('every node is reachable from root through req graph', () => {
    const reach = new Set(['root']);
    let grew = true;
    while (grew) {
      grew = false;
      for (const n of NODES) {
        if (reach.has(n.id)) continue;
        if (n.req.some(r => reach.has(r))) { reach.add(n.id); grew = true; }
      }
    }
    for (const n of NODES) expect(reach.has(n.id), 'unreachable: ' + n.id).toBe(true);
  });
  it('every node has an icon backed by a real tile asset', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const files = new Set(fs.readdirSync(path.join(import.meta.dirname, '../src/assets/tiles'))
      .filter(f => f.endsWith('.png')).map(f => f.replace('.png', '')));
    for (const n of NODES) {
      expect(n.icon, 'no icon: ' + n.id).toBeTruthy();
      expect(files.has(n.icon), 'missing tile: ' + n.icon + ' (' + n.id + ')').toBe(true);
    }
  });
  it('keystones all have achievement gates, small nodes have levels', () => {
    for (const n of NODES) {
      if (n.keystone) { expect(n.ach, n.id).toBeDefined(); expect(n.max).toBe(1); }
      else if (n.id !== 'root') expect(n.max).toBeGreaterThanOrEqual(1);
      expect(n.base).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('purchasing', () => {
  it('buy flow: root neighbors purchasable, deep nodes are not', () => {
    const s = makeState();
    s.mem = 100;
    expect(canBuy(s, nodeById('combat_s1'))).toBe(true);
    expect(canBuy(s, nodeById('combat_s5'))).toBe(false);
    expect(buyNode(s, nodeById('combat_s1'))).toBe(true);
    expect(treeLvl(s, 'combat_s1')).toBe(1);
    expect(s.mem).toBeLessThan(100);
  });
  it('keystone blocked until achievement met', () => {
    const s = makeState();
    s.mem = 1e9;
    for (let i = 1; i <= 8; i++) s.tree['economy_s' + i] = 1;
    const k = nodeById('k_deathmem');
    expect(canBuy(s, k)).toBe(false);
    s.stat.deaths = 5;
    expect(canBuy(s, k)).toBe(true);
  });
  it('memEff sums levels across nodes', () => {
    const s = makeState();
    s.tree.combat_s1 = 5; // atk .01/lvl
    s.tree.combat_s4 = 3;
    expect(memEff(s, 'atk')).toBeCloseTo(0.08);
  });
  it('slots come from the heroes chain', () => {
    const s = makeState();
    expect(maxSlots(s)).toBe(1);
    s.tree.hslot0 = 1; s.tree.hslot1 = 1;
    expect(maxSlots(s)).toBe(3);
  });
});

describe('memory income', () => {
  it('death memory doubles with k_deathmem', () => {
    const a = makeState(), b = makeState();
    b.tree.k_deathmem = 1;
    const ga = gainMem(a, 50, true), gb = gainMem(b, 50, true);
    expect(gb).toBe(ga * 2);
    expect(a.stat.memEarned).toBe(ga);
  });
  it('mem nodes boost income', () => {
    const s = makeState();
    s.tree.dungeon_s6 = 10; // mem .015/lvl
    expect(gainMem(s, 100, false)).toBe(115);
  });
});

describe('keystone mechanics', () => {
  it('heirs: new hero starts with XL from best fallen ancestor', () => {
    const s = makeState();
    s.tree.k_heirs = 1;
    s.stat.bestXL[comboKey('minotaur', 'berserker')] = 15;
    const h = newHero('minotaur', 'berserker', 3, s);
    expect(h.xl).toBe(6); // 1 + floor(15/3)
    const other = newHero('human', 'monk', 0, s);
    expect(other.xl).toBe(1);
  });
  it('ghosts and rune auras multiply global attack', async () => {
    const s = makeState();
    const base = gAtk(s);
    s.tree.k_ghosts = 1; s.stat.deaths = 20;
    expect(ghostMul(s)).toBeCloseTo(1.10);
    /* Rune Auras are sub-linear: the one permanent multiplier that had neither
       a cap nor a price, it reached x12.5 on a lifetime total that just piles up
       (574 runes in ten days). sqrt keeps early runes worth roughly what they
       were while killing the runaway tail. */
    s.tree.k_runeaura = 1; s.runesTotal = 5;
    const { RUNE_AURA_K } = await import('../src/core/economy.js');
    expect(runeAura(s)).toBeCloseTo(1 + RUNE_AURA_K * Math.sqrt(5), 5);
    expect(gAtk(s)).toBeCloseTo(base * 1.1 * runeAura(s), 5);
    /* the tail is what matters: a huge lifetime total must not explode */
    s.runesTotal = 574;
    expect(runeAura(s)).toBeLessThan(4);        // was 1 + 0.02*574 = 12.5
    expect(runeAura(s)).toBeGreaterThan(2);     // still a real reward
  });
  it('gacha discount nodes reduce roll cost up to 50% cap', () => {
    const s = makeState();
    const base = rollCost(s);
    s.tree.gacha_s2 = 10; // gdisc .006/lvl → 6%
    expect(rollCost(s)).toBeLessThan(base);
  });
  it('abyss branch generates valid boss floors every 10', () => {
    for (const [kind] of BRANCHES.abyss.mobs) expect(MONS[kind], kind).toBeDefined();
    const s = makeState();
    s.tree.k_abyss = 1;
    const h = newHero('troll', 'berserker', 3, s);
    s.heroes.push(h);
    h.branch = 'abyss'; h.floor = 10; h.segIdx = 0; h.seed = 5;
    genFloor(h, s);
    expect(h.map.bossFloor).toBe(true);
    h.floor = 11;
    genFloor(h, s);
    expect(h.map.bossFloor).toBe(false);
  });
});

describe('migration', () => {
  it('old CIFI upgrade levels convert to memory', () => {
    const storage = {
      data: JSON.stringify({ gold: 500, upg: { atk: 10, hp: 5 } }),
      getItem() { return this.data; }, setItem() {},
    };
    const s = loadState(storage);
    expect(s.mem).toBe(15 * 40);
    expect(Object.keys(s.upg).length).toBe(0);
    expect(s.tree.root).toBe(1);
  });
});

describe('balance: second expedition slot pacing', () => {
  it('fresh account unlocks the 2nd seeker within ~30 minutes of play', async () => {
    const { startRun, advanceHeroes } = await import('../src/sim/tick.js');
    const { newHero } = await import('../src/sim/hero.js');
    const { mulberry32 } = await import('../src/core/rng.js');
    const { vi } = await import('vitest');
    const rng = mulberry32(42);
    const spy = vi.spyOn(Math, 'random').mockImplementation(rng);
    try {
      const s = makeState();
      let h = newHero('minotaur', 'fighter', 2, s); // the starter Krog
      s.heroes.push(h); startRun(h, s);
      const PATH = ['heroes_s1', 'heroes_s2', 'hslot0'];
      let unlockedAtMin = null;
      for (let min = 1; min <= 35; min++) {
        advanceHeroes(s, 60, true);
        /* hero died — a free summon of a new one (as in the game) */
        if (!s.heroes.some(x => x.state === 'run' || x.state === 'camp')) {
          h = newHero('human', 'fighter', 0, s);
          s.heroes.push(h); startRun(h, s);
        }
        /* the player greedily buys the path to the slot */
        for (const id of PATH) {
          const n = nodeById(id);
          if (treeLvl(s, id) < 1 && canBuy(s, n)) buyNode(s, n);
        }
        if (maxSlots(s) >= 2 && unlockedAtMin === null) unlockedAtMin = min;
      }
      expect(unlockedAtMin, 'the 2nd slot did not unlock within 35 minutes').not.toBeNull();
      /* balance corridor: greedy path 12-32 min → a real player ~20-30 */
      expect(unlockedAtMin).toBeLessThanOrEqual(32);
      expect(unlockedAtMin).toBeGreaterThanOrEqual(12);
    } finally { spy.mockRestore(); }
  });
});

describe('tree geometry', () => {
  it('no two edges of the Memory tree properly intersect', async () => {
    const { NODES, nodeById } = await import('../src/data/memtree.js');
    const edges = [];
    for (const n of NODES)
      for (const r of n.req) {
        const p = nodeById(r);
        if (p) edges.push([p.x, p.y, n.x, n.y, p.id + '->' + n.id]);
      }
    const cross = (a, b, c, d) => {
      const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
      const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
      return o1 !== o2 && o3 !== o4 && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0;
    };
    const shared = (e, f) =>
      (e[0] === f[0] && e[1] === f[1]) || (e[0] === f[2] && e[1] === f[3]) ||
      (e[2] === f[0] && e[3] === f[1]) || (e[2] === f[2] && e[3] === f[3]);
    const bad = [];
    for (let i = 0; i < edges.length; i++)
      for (let j = i + 1; j < edges.length; j++) {
        const e = edges[i], f = edges[j];
        if (shared(e, f)) continue;
        if (cross([e[0], e[1]], [e[2], e[3]], [f[0], f[1]], [f[2], f[3]])) bad.push(e[4] + ' x ' + f[4]);
      }
    expect(bad).toEqual([]);
  });
});
