import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../src/core/rng.js';
import { fmt, clamp } from '../src/core/fmt.js';
import { makeState } from '../src/core/state.js';
import { rollCombo, pickComboOfTier, rollCost, gAtk, fameMul, freeRollAvailable, effectiveRollCost } from '../src/core/economy.js';
import { NODES, nodeById, nodeCost, buyNode, canBuy, memEff, gainMem, achMet, treeLvl } from '../src/data/memtree.js';

describe('rng', () => {
  it('deterministic for same seed', () => {
    const a = mulberry32(42), b = mulberry32(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });
  it('values in [0,1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
});

describe('fmt', () => {
  it('formats magnitudes', () => {
    expect(fmt(999)).toBe('999');
    expect(fmt(15000)).toBe('15.0K');
    expect(fmt(2_500_000)).toBe('2.50M');
  });
  it('clamp works', () => expect(clamp(5, 0, 3)).toBe(3));
});

describe('economy', () => {
  it('memory node costs grow with level', () => {
    const s = makeState();
    const n = nodeById('combat_s1');
    const c0 = nodeCost(s, n);
    s.tree[n.id] = 8;
    expect(nodeCost(s, n)).toBeGreaterThan(c0 * 2);
  });
  it('roll cost inflates with rolls', () => {
    const s = makeState();
    const c0 = rollCost(s);
    s.rolls = 10;
    expect(rollCost(s)).toBeGreaterThan(c0);
  });
  it('premium rolls give more legendaries', () => {
    const s = makeState();
    let normLeg = 0, premLeg = 0;
    const rng = mulberry32(123);
    for (let i = 0; i < 4000; i++) {
      if (rollCombo(s, false, rng).rarity === 3) normLeg++;
      if (rollCombo(s, true, rng).rarity === 3) premLeg++;
    }
    expect(premLeg).toBeGreaterThan(normLeg * 1.5);
  });
  it('pickComboOfTier returns requested tier', () => {
    const rng = mulberry32(5);
    for (let t = 0; t < 4; t++) {
      const c = pickComboOfTier(t, rng);
      expect(c.rarity).toBe(t);
    }
  });
  it('free roll when the whole roster is dead', () => {
    const s = makeState();
    expect(freeRollAvailable(s)).toBe(true); // an empty account also gets a free start
    s.heroes.push({ state: 'run' });
    expect(freeRollAvailable(s)).toBe(false);
    expect(effectiveRollCost(s)).toBeGreaterThan(0);
    s.heroes[0].state = 'dead';
    s.heroes.push({ state: 'victor' });
    expect(freeRollAvailable(s)).toBe(true); // the dead and victors do not count
    expect(effectiveRollCost(s)).toBe(0);
  });
  it('fame victories raise global multipliers', () => {
    const s = makeState();
    const base = gAtk(s);
    s.fame.push({ won: true }, { won: true }, { won: false });
    expect(fameMul(s)).toBeCloseTo(1.16);
    expect(gAtk(s)).toBeGreaterThan(base);
  });
});

describe('sfx contract', () => {
  it('every sfx.<name> call site has a matching method (a missing one crashes the main loop)', async () => {
    const { sfx } = await import('../src/ui/audio.js');
    const { readFileSync, readdirSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const walk = (dir, out = []) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) { if (f !== 'assets' && f !== 'i18n') walk(p, out); }
        else if (f.endsWith('.js')) out.push(p);
      }
      return out;
    };
    const used = new Set();
    for (const p of walk('src'))
      for (const m of readFileSync(p, 'utf8').matchAll(/\bsfx\.(\w+)/g)) used.add(m[1]);
    const missing = [...used].filter(k => typeof sfx[k] !== 'function');
    expect(missing).toEqual([]);
  });
});
