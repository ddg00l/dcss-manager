import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { RACES, RKEYS } from '../src/data/races.js';
import { CLASSES, CKEYS } from '../src/data/classes.js';
import { comboRarity, LEG_COMBOS } from '../src/data/combos.js';
import { MONS, UNIQUES } from '../src/data/monsters.js';
import { BRANCHES, BR_ORDER, buildRoute } from '../src/data/branches.js';
import { WEP_BASES, ARM_BASES, SH_BASES, RING_KINDS, AMU_KINDS, randomItem, itemName, itemInfo, itemTile } from '../src/data/items.js';
import { GODS } from '../src/data/gods.js';
import { mulberry32 } from '../src/core/rng.js';

const tileFiles = new Set(
  fs.readdirSync(path.join(import.meta.dirname, '../src/assets/tiles'))
    .filter(f => f.endsWith('.png')).map(f => f.replace('.png', ''))
);

describe('content pools', () => {
  it('has the promised scale: ≥15 races × 12 classes', () => {
    expect(RKEYS.length).toBeGreaterThanOrEqual(15);
    expect(CKEYS.length).toBe(12);
  });
  it('every combo has a valid rarity 0-3', () => {
    for (const r of RKEYS) for (const c of CKEYS) {
      const t = comboRarity(r, c);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(3);
    }
  });
  it('legendary list entries resolve to tier 3', () => {
    for (const k of LEG_COMBOS) {
      const [r, c] = k.split('/');
      expect(RACES[r], k).toBeDefined();
      expect(CLASSES[c], k).toBeDefined();
      expect(comboRarity(r, c)).toBe(3);
    }
  });
});

describe('tile references', () => {
  it('every race/monster/unique/god/item tile exists as a png asset', () => {
    const used = new Set();
    for (const r of Object.values(RACES)) used.add(r.t);
    for (const m of Object.values(MONS)) used.add(m.t);
    for (const u of Object.values(UNIQUES)) used.add(u.t);
    for (const g of Object.values(GODS)) used.add(g.alt);
    for (const b of Object.values(BRANCHES)) {
      used.add(b.floor); used.add(b.floor2); used.add(b.wall);
      if (b.bossT) used.add(b.bossT);
    }
    for (const w of [...WEP_BASES, ...ARM_BASES, ...SH_BASES, ...RING_KINDS, ...AMU_KINDS]) used.add(w.t);
    for (const w of [...WEP_BASES, ...ARM_BASES, ...SH_BASES]) if (w.ov) used.add(w.ov);
    for (const k of used) expect(tileFiles.has(k), 'missing tile: ' + k).toBe(true);
  });
});

describe('branches', () => {
  it('every branch mob range fits branch depth and exists', () => {
    for (const bk of BR_ORDER) {
      const br = BRANCHES[bk];
      for (const [kind, lo, hi] of br.mobs) {
        expect(MONS[kind], kind).toBeDefined();
        expect(lo).toBeGreaterThanOrEqual(1);
        expect(hi).toBeLessThanOrEqual(br.floors);
      }
    }
  });
  it('routes visit Zot last', () => {
    for (const strat of ['classic', 'speed']) {
      const route = buildRoute(strat);
      expect(route[route.length - 1][0]).toBe('zot');
    }
  });
});

describe('equipment overlays', () => {
  it('every weapon/armour/shield base has a player overlay tile', () => {
    for (const b of [...WEP_BASES, ...ARM_BASES, ...SH_BASES])
      expect(b.ov, 'no overlay for ' + b.k).toBeTruthy();
  });
});

describe('item generation', () => {
  it('1000 random items are valid and nameable', () => {
    const rng = mulberry32(99);
    for (let i = 0; i < 1000; i++) {
      const it = randomItem(null, Math.floor(rng() * 3), rng);
      expect(['weapon', 'armour', 'shield', 'ring', 'amulet']).toContain(it.slot);
      expect(() => itemName(it)).not.toThrow();
      expect(() => itemInfo(it)).not.toThrow();
      expect(tileFiles.has(itemTile(it)), itemTile(it)).toBe(true);
      expect(it.rar).toBeGreaterThanOrEqual(0);
      expect(it.rar).toBeLessThanOrEqual(3);
    }
  });
  it('slot choice is respected', () => {
    const rng = mulberry32(7);
    for (const slot of ['weapon', 'armour', 'shield', 'ring', 'amulet'])
      expect(randomItem(slot, 1, rng).slot).toBe(slot);
  });
});
