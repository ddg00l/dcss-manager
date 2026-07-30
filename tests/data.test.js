import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { RACES, RKEYS } from '../src/data/races.js';
import { CLASSES, CKEYS } from '../src/data/classes.js';
import { comboRarity, LEG_COMBOS } from '../src/data/combos.js';
import { MONS, UNIQUES } from '../src/data/monsters.js';
import { BRANCHES, BR_ORDER, BR_CORE, BR_OFFSET, buildRoute, ROAD_KEYS, ROAD_INFO, roadOf } from '../src/data/branches.js';
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

describe('the themed roads', () => {
  const RUNE_OF = k => BRANCHES[k].rune;
  /* rune branches a road actually bottoms out in: a segment capped short of the
     branch floor (the arcane road passing through the Mines) yields no rune */
  const runesOf = road => buildRoute(road)
    .filter(([k, lim]) => BRANCHES[k].rune && lim >= BRANCHES[k].floors)
    .map(([k]) => RUNE_OF(k));

  it('every road reaches Zot and carries slack over the three-rune gate', () => {
    for (const road of ROAD_KEYS) {
      const segs = buildRoute(road);
      expect(segs[segs.length - 1][0], road).toBe('zot');
      /* The Gates demand three runes. A road with exactly three has no slack at
         all: one missed branch boss shuts Zot for good, which measured as 1 Orb
         against 43 and is a wrong answer rather than a fragile choice. The short
         road is the one deliberate exception -- that is its stated price. */
      expect(runesOf(road).length, road).toBeGreaterThanOrEqual(road === 'speed' ? 3 : 4);
    }
  });

  it('the three full roads differ in what they yield, not in how long they are', () => {
    const full = ['iron', 'wild', 'arcane'];
    /* Dungeon segments resume at the remembered depth rather than restarting, so a
       road that returns to the Dungeon three times still walks it once. Summing the
       caps would count those floors again and make a road look longer than it is. */
    const len = r => {
      const segs = buildRoute(r);
      const deepest = Math.max(0, ...segs.filter(([k]) => k === 'dungeon').map(([, l]) => l));
      return deepest + segs.filter(([k]) => k !== 'dungeon')
        .reduce((a, [k, lim]) => a + Math.min(lim, BRANCHES[k].floors), 0);
    };
    const lens = full.map(len);
    /* near-equal length is the whole point: length is tempo, and tempo belongs to
       the Memory tree and to attention, not to a second control wearing its name */
    expect(Math.max(...lens) / Math.min(...lens)).toBeLessThan(1.25);
    /* the three MANDATORY rune branches must be depth-matched: if one road's are
       all shallow it reaches the Gates first and the selector is tempo again */
    const mandatory = r => runesOf(r).slice(0, 3);
    const depthSum = r => buildRoute(r)
      .filter(([k, lim]) => BRANCHES[k].rune && lim >= BRANCHES[k].floors)
      .slice(0, 3).reduce((a, [k]) => a + BR_OFFSET[k], 0);
    const sums = full.map(depthSum);
    expect(Math.max(...sums) / Math.min(...sums)).toBeLessThan(1.25);
    for (const r of full) expect(mandatory(r).length, r).toBe(3);
    /* and no two roads may bring home the same set of runes */
    const sets = full.map(r => runesOf(r).sort().join('|'));
    expect(new Set(sets).size).toBe(full.length);
    for (let i = 0; i < full.length; i++)
      for (let j = i + 1; j < full.length; j++) {
        const a = new Set(runesOf(full[i])), b = runesOf(full[j]);
        const shared = b.filter(x => a.has(x)).length;
        expect(shared, full[i] + ' vs ' + full[j]).toBeLessThanOrEqual(2);
      }
  });

  it('each road has a loot character, and it is described to the player', () => {
    for (const road of ROAD_KEYS) {
      expect(ROAD_INFO[road], road).toBeDefined();
      expect(ROAD_INFO[road].yield.length, road).toBeGreaterThan(10);
      /* a road with no biased branch on it yields nothing distinctive */
      const biased = buildRoute(road).filter(([k]) => BRANCHES[k].loot);
      expect(biased.length, road).toBeGreaterThan(0);
    }
  });

  it('old saves keep a road: classic maps onto the Iron Road', () => {
    expect(roadOf('classic')).toBe('iron');
    expect(roadOf('speed')).toBe('speed');
    expect(roadOf(undefined)).toBe('iron');   /* never leave a hero routeless */
    expect(roadOf('nonsense')).toBe('iron');
  });

  it('adding a branch does not rescale the monsters the old branches use', () => {
    /* BR_CORE pins the reference set for monster depth-scaling. Mummies now also
       live in the Tomb at depth 18; if the average depth of a KIND were computed
       over every branch, that would have quietly weakened every Dungeon mummy. */
    for (const k of BR_CORE) expect(BRANCHES[k], k).toBeDefined();
    expect(BR_CORE).not.toContain('tomb');
    expect(BR_CORE).not.toContain('swamp');
    expect(BR_ORDER).toContain('tomb');
    expect(BR_ORDER).toContain('swamp');
  });
});

describe('the roads keep their characters', () => {
  /* The loot character is the whole point of the rework, and it is easy to undo by
     accident: raising one branch's gear rate, or putting a martial rune branch on
     the enchantment road, quietly averages the roads back together. These pin the
     measured shape rather than the measured numbers -- the numbers live in the
     ablation, but the structure that produces them belongs in a test.

     Measured on 6 paired seeds over 8 days once the structure below held:
     jewellery share iron 0.25 / wild 0.39 / arcane 0.51 (2.01x), reagents 1.38x
     apart, and days to the first Orb within 1.09x — i.e. different hauls at the
     same speed, which is what a route is supposed to decide. */
  const jewelBias = k => {
    const sl = (BRANCHES[k].loot || {}).slots;
    if (!sl) return 0.4;   /* an unbiased branch spreads over five slots, two of them jewellery */
    return sl.filter(x => x === 'ring' || x === 'amulet').length / sl.length;
  };
  /* expected gear volume, weighted by how biased toward jewellery each branch is */
  const profile = road => {
    let gear = 0, jewel = 0;
    for (const [k, lim] of buildRoute(road)) {
      const v = Math.min(lim, BRANCHES[k].floors) * ((BRANCHES[k].loot || {}).gear || 1);
      gear += v; jewel += v * jewelBias(k);
    }
    return jewel / gear;
  };

  it('the Iron Road is the martial one and the Arcane Road the enchanted one', () => {
    expect(profile('arcane') / profile('iron')).toBeGreaterThanOrEqual(1.8);
  });

  it('the Wild Road owns the reagents', () => {
    const cons = road => buildRoute(road)
      .reduce((a, [k, lim]) => a + Math.min(lim, BRANCHES[k].floors) * ((BRANCHES[k].loot || {}).cons || 1), 0);
    expect(cons('wild')).toBeGreaterThan(cons('iron') * 1.25);
    expect(cons('wild')).toBeGreaterThan(cons('arcane') * 1.25);
  });

  it('no road is forced through a branch that cancels its own character', () => {
    /* The Arcane Road used to need the Vaults for its third rune, and the Vaults'
       plate cancelled the Elven Halls' jewellery exactly. The Spider Nest exists so
       that road can reach three runes without diluting itself; if the mandatory
       three ever include a branch of the opposite character, the road is back to
       measuring like every other one. */
    const mandatory = road => buildRoute(road)
      .filter(([k, lim]) => BRANCHES[k].rune && lim >= BRANCHES[k].floors).slice(0, 3).map(([k]) => k);
    const jewelRoad = mandatory('arcane');
    for (const k of jewelRoad) expect(jewelBias(k), 'arcane via ' + k).toBeGreaterThanOrEqual(0.4);
    const ironRoad = mandatory('iron');
    expect(ironRoad.filter(k => jewelBias(k) > 0.6).length, 'iron').toBeLessThanOrEqual(1);
  });

  it('a lean branch pays in quality instead of quantity', () => {
    for (const k of Object.keys(BRANCHES)) {
      const l = BRANCHES[k].loot;
      if (l && l.gear !== undefined && l.gear < 0.6) expect(l.luck, k).toBeGreaterThan(0);
    }
  });
});
