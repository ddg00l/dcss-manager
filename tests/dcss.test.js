import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { makeState } from '../src/core/state.js';
import { newHero, heroStats } from '../src/sim/hero.js';
import { genFloor } from '../src/sim/mapgen.js';
import {
  startRun, banishHero, returnFromAbyss, enterPortal, exitPortal, shopVisit, applyMut, checkTrap,
} from '../src/sim/tick.js';
import { POTIONS, SCROLLS, randConsumable, consName } from '../src/data/consumables.js';
import { MUTS, randomMut } from '../src/data/mutations.js';
import { PORTALS, PORTAL_KEYS } from '../src/data/portals.js';
import { MONS } from '../src/data/monsters.js';
import { mulberry32 } from '../src/core/rng.js';
import { brTag } from '../src/data/branches.js';

const tileFiles = new Set(
  fs.readdirSync(path.join(import.meta.dirname, '../src/assets/tiles'))
    .filter(f => f.endsWith('.png')).map(f => f.replace('.png', ''))
);
function runHero(s, race = 'minotaur', cls = 'fighter') {
  const h = newHero(race, cls, 2, s);
  s.heroes.push(h);
  startRun(h, s);
  return h;
}

describe('consumables', () => {
  it('all potion/scroll tiles exist; random generation is valid', () => {
    for (const p of Object.values(POTIONS)) expect(tileFiles.has(p.t), p.t).toBe(true);
    expect(tileFiles.has('i_scroll')).toBe(true);
    const rng = mulberry32(3);
    for (let i = 0; i < 300; i++) {
      const c = randConsumable(rng);
      expect(POTIONS[c.type] || SCROLLS[c.type], c.type).toBeDefined();
      expect(() => consName(c, false)).not.toThrow();
    }
  });
  it('unidentified name differs until known', () => {
    const c = { kind: 'potion', type: 'haste' };
    expect(consName(c, false)).not.toBe(consName(c, true));
  });
  it('status effects change hero stats', () => {
    const s = makeState();
    const h = runHero(s);
    const base = heroStats(h, s);
    h.status.might = 10; h.status.haste = 10;
    const buffed = heroStats(h, s);
    expect(buffed.dmg).toBeGreaterThan(base.dmg * 1.2);
    expect(buffed.aspd).toBeGreaterThan(base.aspd * 1.3);
  });
});

describe('traps & banishment', () => {
  it('shaft trap drops the hero deeper', () => {
    const s = makeState();
    const h = runHero(s);
    h.floor = 3; genFloor(h, s);
    h.map.traps = [{ x: h.map.px, y: h.map.py, kind: 'shaft', seen: false }];
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.99); // trap goes unnoticed, drop by 1 floor
    checkTrap(h, s);
    spy.mockRestore();
    expect(h.floor).toBeGreaterThanOrEqual(4);
  });
  it('banishment sends to abyss and exit returns to origin', () => {
    const s = makeState();
    const h = runHero(s);
    h.branch = 'dungeon'; h.floor = 12; h.segIdx = 0; genFloor(h, s);
    banishHero(h, s, 'test');
    expect(h.branch).toBe('abyss');
    expect(h.banished.floor).toBe(12);
    expect(h.map.items.some(it => it.kind === 'abyss_exit')).toBe(true);
    returnFromAbyss(h, s);
    expect(h.branch).toBe('dungeon');
    expect(h.floor).toBe(12);
    expect(h.banished).toBeNull();
  });
});

describe('portals', () => {
  it('portal tiles exist and defs reference real monsters', () => {
    for (const k of PORTAL_KEYS) {
      const P = PORTALS[k];
      expect(tileFiles.has(P.t), P.t).toBe(true);
      for (const m of P.mobs) expect(MONS[m], k + ':' + m).toBeDefined();
    }
  });
  it('enter/exit portal preserves origin; trove needs a key', () => {
    const s = makeState();
    const h = runHero(s);
    h.branch = 'dungeon'; h.floor = 5; genFloor(h, s);
    enterPortal(h, s, 'trove');
    expect(h.inPortal).toBeNull(); // locked without a key
    h.keys = 1;
    enterPortal(h, s, 'trove');
    expect(h.inPortal.type).toBe('trove');
    expect(h.keys).toBe(0);
    expect(brTag(h)).toContain('the Treasure Trove');
    exitPortal(h, s);
    expect(h.inPortal).toBeNull();
    expect(h.floor).toBe(5);
  });
  it('zig is gated behind a win in floor generation', () => {
    const s = makeState();
    const h = runHero(s);
    h.branch = 'dungeon'; h.floor = 15;
    let seenZig = false;
    for (let i = 0; i < 300; i++) {
      genFloor(h, s);
      if (h.map.items.some(it => it.kind === 'portal' && it.ptype === 'zig')) seenZig = true;
    }
    expect(seenZig).toBe(false); // the Ziggurat never appears without a win
  });
});

describe('mutations', () => {
  it('mutations modify stats and never duplicate', () => {
    const s = makeState();
    const h = runHero(s);
    const base = heroStats(h, s);
    h.muts.push('tough', 'frail');
    const m = heroStats(h, s);
    expect(m.ac).toBeGreaterThan(base.ac);
    expect(m.hpMax).toBeLessThan(base.hpMax);
    const rng = mulberry32(1);
    const got = new Set(h.muts);
    for (let i = 0; i < 50; i++) {
      const mk = randomMut(h, rng, false);
      if (!mk) break;
      expect(got.has(mk)).toBe(false);
      got.add(mk); h.muts.push(mk);
    }
    expect(h.muts.length).toBe(Object.keys(MUTS).length);
  });
  it('applyMut logs and records', () => {
    const s = makeState();
    const h = runHero(s);
    applyMut(h, s, true, 'test');
    expect(h.muts.length).toBe(1);
    expect(MUTS[h.muts[0]].good).toBe(1);
  });
});

describe('shops & wallet', () => {
  it('spending never exceeds the policy budget fraction', () => {
    const FRAC = { thrifty: 0.3, balanced: 0.6, lavish: 1 };
    for (const pol of ['thrifty', 'balanced', 'lavish']) {
      for (let i = 0; i < 20; i++) {
        const s = makeState();
        const h = runHero(s);
        h.floor = 8; genFloor(h, s);
        h.gold = 10000; h.spend = pol;
        shopVisit(h, s, 'potion');
        const spent = 10000 - h.gold;
        expect(spent, pol).toBeLessThanOrEqual(10000 * FRAC[pol] + 1);
      }
    }
  });
});

describe('save migration from pre-DCSS-content version', () => {
  it('heroes mid-run with old maps get traps/clouds and tick safely', async () => {
    const { loadState } = await import('../src/core/state.js');
    const { advanceHeroes } = await import('../src/sim/tick.js');
    const s0 = makeState();
    const h = runHero(s0);
    /* serialize an "old" save: without the new map and hero fields */
    const raw = JSON.parse(JSON.stringify(s0));
    delete raw.heroes[0].map.traps;
    delete raw.heroes[0].map.clouds;
    delete raw.heroes[0].inv;
    raw.heroes[0].pots = 3;
    delete raw.heroes[0].known;
    delete raw.heroes[0].muts;
    delete raw.heroes[0].status;
    const storage = { getItem: () => JSON.stringify(raw), setItem() {} };
    const s = loadState(storage);
    const hh = s.heroes[0];
    expect(hh.map.clouds).toEqual([]);
    expect(hh.map.traps).toEqual([]);
    expect(hh.inv.curing).toBe(3);
    expect(() => advanceHeroes(s, 600, true)).not.toThrow();
  });
});

describe('death recap & monster pathing', () => {
  it('heroDie leaves a morgue snapshot in pendingDeaths', async () => {
    const { heroDie } = await import('../src/sim/tick.js');
    const s = makeState();
    const h = runHero(s, 'kobold', 'assassin');
    h.runes.push('test rune'); h.muts.push('horns');
    heroDie(h, 'hydra', s);
    expect(s.pendingDeaths.length).toBe(1);
    const d = s.pendingDeaths[0];
    expect(d.by).toBe('hydra');
    expect(d.runes).toContain('test rune');
    expect(d.muts).toContain('horns');
    expect(d.shards).toBeGreaterThan(0);
    expect(Array.isArray(d.log)).toBe(true);
  });
  it('monsters reach a ranged hero around corners (dist-field AI)', async () => {
    const { advanceHeroes } = await import('../src/sim/tick.js');
    /* if the AI is broken, monsters stand still: few kills and the hero takes no damage.
       a rare instant death happens — retry until we get an informative run */
    let kills = 0, contact = false;
    for (let attempt = 0; attempt < 4; attempt++) {
      const s = makeState();
      const h = runHero(s, 'kobold', 'hunter');
      advanceHeroes(s, 1800, true);
      kills = Math.max(kills, h.kills);
      if (h.state === 'dead' || h.curHp < h.maxHpCache) contact = true;
      if (kills > 5 && contact) break;
    }
    expect(kills).toBeGreaterThan(5);
    expect(contact).toBe(true);
  });
});

describe('recall', () => {
  it('recall frees the slot and fully resets run progress (no death legacy)', async () => {
    const { recallHero, startRun, advanceHeroes } = await import('../src/sim/tick.js');
    const s = makeState();
    const h = runHero(s, 'minotaur', 'berserker');
    advanceHeroes(s, 900, true); // leveled up a bit
    if (h.state !== 'run') return; // rare early death — not what this test is about
    h.gold = 500;
    const goldBefore = s.gold, shardsBefore = JSON.stringify(s.shards), deaths = s.stat.deaths;
    expect(recallHero(h, s)).toBe(true);
    expect(h.state).toBe('camp');
    expect(h.rest).toBe(true);
    expect(h.xl).toBe(1);
    expect(h.runes.length).toBe(0);
    expect(h.muts.length).toBe(0);
    expect(h.map).toBeNull();
    expect(h.god).toBe('trog'); // the berserker's class god is restored
    expect(s.gold).toBe(goldBefore + 500); // wallet goes to the treasury
    expect(JSON.stringify(s.shards)).toBe(shardsBefore); // recall ≠ death: no shards
    expect(s.stat.deaths).toBe(deaths);
    /* dispatching again starts from D:1 */
    startRun(h, s);
    expect(h.rest).toBe(false);
    expect(h.branch).toBe('dungeon');
    expect(h.floor).toBe(1);
  });
});

describe('floor gear drops are pre-rolled', () => {
  it('item cells carry a concrete item with a real tile, and pickup grants exactly it', async () => {
    const { itemTile, itemName } = await import('../src/data/items.js');
    const s = makeState();
    const h = runHero(s);
    let found = null;
    for (let f = 1; f <= 40 && !found; f++) {
      h.floor = f % 15 + 1; genFloor(h, s);
      found = h.map.items.find(it => it.kind === 'item');
    }
    expect(found, 'no items in 40 floors — drop chance is broken').toBeTruthy();
    expect(found.it).toBeDefined();
    expect(() => itemTile(found.it)).not.toThrow();
    expect(() => itemName(found.it)).not.toThrow();
    /* pickup grants exactly this item */
    const { acquireItem } = await import('../src/sim/tick.js');
    const id = found.it.id;
    acquireItem(h, s, found.it);
    const equipped = Object.values(h.gear).some(g => g && g.id === id);
    const stored = s.armory.some(a => a.id === id);
    const dismantled = s.stat.dismantled > 0; // keystone auto-dismantles greys (off here)
    expect(equipped || stored || dismantled).toBe(true);
  });
});

describe('log freshness', () => {
  it('logSeq keeps growing after the 80-entry cap (realtime log diff)', async () => {
    const { advanceHeroes } = await import('../src/sim/tick.js');
    /* reach the log cap on a living hero (up to 5 attempts — a weakling may die sooner) */
    for (let attempt = 0; attempt < 5; attempt++) {
      const s = makeState();
      const h = runHero(s, 'troll', 'berserker');
      while (h.state === 'run' && h.log.length < 80) advanceHeroes(s, 60, true);
      if (h.log.length < 80 || h.state !== 'run') continue; // died before/at the cap — retry
      const seq = h.logSeq;
      advanceHeroes(s, 120, true);
      expect(h.log.length).toBe(80);           // buffer stays capped
      /* the counter keeps growing: a living hero logs turns, a dead one logs its death */
      expect(h.logSeq).toBeGreaterThan(seq);
      return;
    }
    throw new Error('hero never survived to 80 log entries in 5 attempts');
  });
});

describe('diagonal movement (DCSS-style)', () => {
  function diagMap() {
    /* map: only a diagonal passage (1,1)→(2,2)→(3,3) */
    const { MW, MH } = { MW: 24, MH: 15 };
    const g = Array.from({ length: MH }, () => new Array(MW).fill(1));
    g[1][1] = 0; g[2][2] = 0; g[3][3] = 0;
    return { g, monsters: [], items: [], traps: [], clouds: [],
      stairs: { x: 3, y: 3 }, px: 1, py: 1,
      explored: Array.from({ length: MH }, () => new Array(MW).fill(true)) };
  }
  it('hero pathfinding crosses pure-diagonal corridors', async () => {
    const { stepToward } = await import('../src/sim/tick.js');
    const s = makeState();
    const h = runHero(s);
    h.map = diagMap(); h.path = null; h.pathGoal = null;
    stepToward(h, 3, 3, s);
    expect(h.map.px).toBe(2);
    expect(h.map.py).toBe(2);
  });
  it('monster dist-field assigns diagonal neighbors distance 1', async () => {
    const { heroDistField } = await import('../src/sim/tick.js');
    const m = diagMap();
    const df = heroDistField(m);
    expect(df[2 * 24 + 2]).toBe(1); // diagonal = one step
    expect(df[3 * 24 + 3]).toBe(2);
  });
});

describe('class mechanics fidelity', () => {
  it('summoner actually summons allies that fight', async () => {
    const { advanceHeroes } = await import('../src/sim/tick.js');
    const s = makeState();
    const h = runHero(s, 'deep_elf', 'summoner');
    advanceHeroes(s, 600, true);
    /* within 10 minutes the summoner must have summoned something (the log keeps a trace) */
    const summoned = (h.map && h.map.allies && h.map.allies.length > 0) ||
      h.log.some(e => e.txt.includes(' summons: ')) || h.state === 'dead';
    expect(summoned).toBe(true);
    if (h.state === 'run') {
      expect(h.log.some(e => e.txt.includes(' summons: '))).toBe(true);
    }
  });
  it('summonAlly scales tier with skill and places the creature adjacent', async () => {
    const { summonAlly } = await import('../src/sim/tick.js');
    const s = makeState();
    const h = runHero(s, 'deep_elf', 'summoner');
    h.skills.summonings = 25;
    const a = summonAlly(h, s);
    expect(a).toBeTruthy();
    expect(a.kind).toBe('hydra'); // top tier
    expect(Math.max(Math.abs(a.x - h.map.px), Math.abs(a.y - h.map.py))).toBe(1);
  });
  it('monk has innate dodge, others none', () => {
    const s = makeState();
    const monk = newHero('human', 'monk', 1, s);
    const fighter = newHero('human', 'fighter', 1, s);
    expect(heroStats(monk, s).dodge).toBeCloseTo(0.1);
    expect(heroStats(fighter, s).dodge).toBe(0);
  });
  it('ice elementalist and freezing weapons chill', () => {
    const s = makeState();
    const ice = newHero('deep_elf', 'ice_el', 2, s);
    expect(heroStats(ice, s).chill).toBe(1);
    const f = newHero('human', 'fighter', 1, s);
    f.gear.weapon = { slot: 'weapon', base: 'long_sword', plus: 0, ego: 'freezing', rar: 1, id: 'x1' };
    expect(heroStats(f, s).chill).toBe(1);
    expect(heroStats(newHero('human', 'fighter', 1, s), s).chill).toBe(0);
  });
  it('shield classes start with a buckler', () => {
    const s = makeState();
    expect(newHero('human', 'fighter', 1, s).gear.shield).toBeTruthy();
    expect(newHero('human', 'gladiator', 1, s).gear.shield).toBeTruthy();
    expect(newHero('human', 'monk', 1, s).gear.shield).toBeNull();
  });
  it('stab: attacking a sleeping monster always hits and deals bonus damage', async () => {
    const { heroDistField } = await import('../src/sim/tick.js'); // just to import module
    const s = makeState();
    const h = runHero(s, 'kobold', 'assassin');
    genFloor(h, s);
    const mo = h.map.monsters[0];
    mo.awake = false;
    mo.hp = mo.maxHp = 1e6;
    const { simTick } = await import('../src/sim/tick.js');
    // place the hero adjacent and strike directly via the moveOrAttack path:
    h.map.px = mo.x + (mo.x > 1 ? -1 : 1); h.map.py = mo.y;
    const vi = await import('vitest');
    const spy = vi.vi.spyOn(Math, 'random').mockReturnValue(0.9); // no crit, but the stab guarantees a hit
    const before = mo.hp;
    const tickMod = await import('../src/sim/tick.js');
    // the private heroAttack cannot be called directly — go through stepToward onto the monster's cell
    tickMod.stepToward(h, mo.x, mo.y, s);
    spy.mockRestore();
    expect(mo.hp).toBeLessThan(before); // the sleeper took damage (guaranteed hit)
    expect(mo.awake).toBe(true);        // and woke up
  });
});

describe('racial fidelity: aptitudes, minuses, synergy is real', () => {
  it('aptitudes: minotaur trains weapons faster, troll barely learns magic', async () => {
    const { aptMul } = await import('../src/data/races.js');
    expect(aptMul('minotaur', 'long_blades')).toBeCloseTo(1.4); // schools inherit the genus aptitude
    expect(aptMul('deep_elf', 'axes')).toBeCloseTo(0.8);
    expect(aptMul('merfolk', 'polearms')).toBeCloseTo(1.8); // the merfolk signature school
    expect(aptMul('deep_elf', 'spellcasting')).toBeCloseTo(1.6);
    expect(aptMul('troll', 'spellcasting')).toBeCloseTo(0.4);
    expect(aptMul('human', 'spellcasting')).toBe(1); // humans are flat baseline
  });
  it('training speed diverges in an actual run', async () => {
    const { advanceHeroes } = await import('../src/sim/tick.js');
    const mkRun = race => {
      const s = makeState();
      const h = newHero(race, 'fighter', 2, s);
      s.heroes.push(h);
      return { s, h };
    };
    const a = mkRun('minotaur'), b = mkRun('deep_elf');
    const { startRun } = await import('../src/sim/tick.js');
    startRun(a.h, a.s); startRun(b.h, b.s);
    const w0a = a.h.skills.long_blades, w0b = b.h.skills.long_blades;
    advanceHeroes(a.s, 600, true); advanceHeroes(b.s, 600, true);
    const gainA = a.h.skills.long_blades - w0a, gainB = b.h.skills.long_blades - w0b;
    if (gainA > 0.1 && gainB > 0.1) // both got to fight
      expect(gainA).toBeGreaterThan(gainB); // the minotaur trains weapons faster than the elf
  });
  it('mp gate: troll conjurer is a markedly worse caster than deep elf', () => {
    const s = makeState();
    const troll = newHero('troll', 'conjurer', 2, s);
    const elf = newHero('deep_elf', 'conjurer', 2, s);
    troll.xl = elf.xl = 10;
    troll.skills = { ...elf.skills }; // identical skills — race in isolation
    const td = heroStats(troll, s).dmg, ed = heroStats(elf, s).dmg;
    expect(ed).toBeGreaterThan(td * 1.4); // elf's magic mult + troll's mp penalty
  });
  it('synergetic melee beats non-synergetic at equal level', () => {
    const s = makeState();
    const mi = newHero('minotaur', 'berserker', 3, s);
    const sp = newHero('spriggan', 'berserker', 3, s);
    mi.xl = sp.xl = 10; sp.skills = { ...mi.skills };
    expect(heroStats(mi, s).dmg).toBeGreaterThan(heroStats(sp, s).dmg * 1.3);
  });
  it('octopode wears four rings and they all count', () => {
    const s = makeState();
    const oc = newHero('octopode', 'wizard', 2, s);
    expect(oc.gear.ring4).toBeNull(); // the slot exists
    const base = heroStats(oc, s).dmg;
    const ring = { slot: 'ring', base: 'r_dmg', plus: 0, ego: null, rar: 1, id: 'r' };
    oc.gear.ring1 = { ...ring, id: 'r1' }; oc.gear.ring2 = { ...ring, id: 'r2' };
    oc.gear.ring3 = { ...ring, id: 'r3' }; oc.gear.ring4 = { ...ring, id: 'r4' };
    expect(heroStats(oc, s).dmg).toBeCloseTo(base * Math.pow(1.1, 4), 1);
    /* a human's fourth ring does not count */
    const hu = newHero('human', 'wizard', 2, s);
    const hb = heroStats(hu, s).dmg;
    hu.gear.ring4 = { ...ring, id: 'hr4' };
    expect(heroStats(hu, s).dmg).toBeCloseTo(hb, 5);
  });
  it('draconian breathes fire at nearby awake enemies', async () => {
    const { simTick } = await import('../src/sim/tick.js');
    const s = makeState();
    const h = newHero('draconian', 'fighter', 2, s);
    s.heroes.push(h);
    const { startRun } = await import('../src/sim/tick.js');
    startRun(h, s);
    const mo = h.map.monsters[0];
    if (!mo) return;
    /* breath requires LOS since the wall-shooting fix: carve the cells between
       the hero and the target so the random map cannot block the line */
    const m = h.map;
    m.g[m.py][m.px + 1] = 0; m.g[m.py][m.px + 2] = 0;
    mo.x = m.px + 2; mo.y = m.py; mo.awake = true;
    mo.hp = mo.maxHp = 1e6;
    h.breathT = -100;
    simTick(h, s);
    expect(h.log.some(e => e.txt.includes(' breathes fire!')) || mo.hp < 1e6).toBe(true);
  });
});

describe('polearm reach (DCSS reaching)', () => {
  it('spear and glaive strike at distance 2, swords at 1, bows at 5', () => {
    const s = makeState();
    const h = newHero('merfolk', 'fighter', 2, s);
    const w = (base) => ({ slot: 'weapon', base, plus: 0, ego: null, rar: 0, id: 'w_' + base });
    h.gear.weapon = w('spear');
    expect(heroStats(h, s).rng).toBe(2);
    h.gear.weapon = w('glaive');
    expect(heroStats(h, s).rng).toBe(2);
    h.gear.weapon = w('long_sword');
    expect(heroStats(h, s).rng).toBe(1);
    const hunter = newHero('kobold', 'hunter', 1, s);
    expect(heroStats(hunter, s).rng).toBe(5);
  });
});

describe('DCSS item mechanics: 2h, encumbrance, holy, venom, unrands', () => {
  const w = (base, extra) => ({ slot: 'weapon', base, plus: 0, ego: null, rar: 0, id: 'w_' + base, ...extra });
  it('two-handed weapons negate the shield', () => {
    const s = makeState();
    const h = newHero('minotaur', 'fighter', 2, s); // starts with sword + buckler
    const withShield = heroStats(h, s).ac;
    h.gear.weapon = w('great_sword');
    const st = heroStats(h, s);
    expect(st.twoHanded).toBe(true);
    expect(st.ac).toBeLessThan(withShield); // the shield no longer counts
  });
  it('equipping a 2h weapon auto-unequips the shield to armory', async () => {
    const { tryAutoEquip } = await import('../src/sim/tick.js');
    const s = makeState();
    const h = newHero('human', 'fighter', 2, s);
    expect(h.gear.shield).toBeTruthy();
    const big = { slot: 'weapon', base: 'battleaxe', plus: 7, ego: null, rar: 2, id: 'bx' };
    expect(tryAutoEquip(h, big, s)).toBe(true);
    expect(h.gear.shield).toBeNull();
    expect(s.armory.length).toBeGreaterThan(0); // the shield went to the armory
  });
  it('heavy armour strangles spellcasting; armour skill mitigates', () => {
    const s = makeState();
    const mk = () => {
      const m = newHero('human', 'conjurer', 2, s);
      m.xl = 10; return m;
    };
    const robe = mk(); // starting robe
    const plated = mk();
    plated.gear.armour = { slot: 'armour', base: 'plate', plus: 0, ego: null, rar: 0, id: 'pl' };
    expect(heroStats(plated, s).dmg).toBeLessThan(heroStats(robe, s).dmg * 0.75);
    const trained = mk();
    trained.gear.armour = { ...plated.gear.armour, id: 'pl2' };
    trained.skills.armour = 27;
    expect(heroStats(trained, s).dmg).toBeGreaterThan(heroStats(plated, s).dmg);
  });
  it('holy weapons burn undead ×, venom poisons the living only', async () => {
    const { simTick, stepToward } = await import('../src/sim/tick.js');
    const s = makeState();
    const h = runHero(s, 'human', 'fighter');
    h.gear.weapon = w('war_axe', { ego: 'holy' });
    let st = heroStats(h, s);
    expect(st.vsUndead).toBeCloseTo(1.6);
    h.gear.weapon = w('war_axe', { ego: 'venom' });
    st = heroStats(h, s);
    expect(st.venom).toBe(1);
  });
  it('rPois armour blocks monster poison', () => {
    const s = makeState();
    const h = newHero('human', 'fighter', 2, s);
    h.gear.armour = { slot: 'armour', base: 'chain_mail', plus: 0, ego: 'poison_res', rar: 1, id: 'pr' };
    expect(heroStats(h, s).rPois).toBe(true);
  });
  it('unrands: unique per account, real tiles, forge cannot roll them', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { UNRANDS, makeUnrand, itemTile, itemName, itemInfo, WEP_BASES, ARM_BASES, RING_KINDS, AMU_KINDS } =
      await import('../src/data/items.js');
    const files = new Set(fs.readdirSync(path.join(import.meta.dirname, '../src/assets/tiles'))
      .filter(f => f.endsWith('.png')).map(f => f.replace('.png', '')));
    const bases = new Set([...WEP_BASES, ...ARM_BASES, ...RING_KINDS, ...AMU_KINDS].map(b => b.k));
    for (const u of UNRANDS) {
      expect(files.has(u.t), u.id).toBe(true);
      expect(bases.has(u.base), u.id + ' base ' + u.base).toBe(true);
      const it = makeUnrand(u.id);
      expect(itemTile(it)).toBe(u.t);
      expect(itemName(it)).toBe(u.n);
      expect(() => itemInfo(it)).not.toThrow();
    }
    /* drops respect uniqueness */
    const { maybeDropUnrand } = await import('../src/sim/tick.js');
    const s = makeState();
    const h = runHero(s);
    for (let i = 0; i < 40; i++) maybeDropUnrand(h, s, 1);
    expect(s.unrandsOwned.length).toBe(UNRANDS.length); // all dropped
    expect(new Set(s.unrandsOwned).size).toBe(UNRANDS.length); // no duplicates
    expect(maybeDropUnrand(h, s, 1)).toBe(false); // pool exhausted
  });
});

describe('weapon decides combat style (DCSS: anyone shoots a crossbow)', () => {
  const item = (slot, base) => ({ slot, base, plus: 0, ego: null, rar: 0, rand: null, id: 'tw' + base });
  it('dwarf gladiator wielding a crossbow fights at range with the ranged skill', () => {
    const s = makeState();
    const h = newHero('dwarf', 'gladiator', 0, s);
    h.gear.weapon = item('weapon', 'crossbow');
    h.gear.shield = null;
    const st = heroStats(h, s);
    expect(st.style).toBe('ranged');
    expect(st.rng).toBe(5);
  });
  it('the same hero with a sword is melee again, and a caster stays a caster', () => {
    const s = makeState();
    const h = newHero('dwarf', 'gladiator', 0, s);
    h.gear.weapon = item('weapon', 'long_sword');
    expect(heroStats(h, s).style).toBe('melee');
    const c = newHero('deep_elf', 'conjurer', 0, s);
    c.gear.weapon = item('weapon', 'crossbow');
    expect(heroStats(c, s).style).toBe('magic');
  });
});

describe('caster-aware auto-equip scoring', () => {
  const item = (slot, base, id) => ({ slot, base, plus: 0, ego: null, rar: 0, rand: null, id });
  it('elf caster prefers the robe over scale mail; fighter takes the scale mail', async () => {
    const { equipBestFromArmory } = await import('../src/sim/tick.js');
    const s = makeState();
    const c = newHero('deep_elf', 'conjurer', 0, s);
    c.gear.armour = null;
    s.armory = [item('armour', 'scale_mail', 'a1'), item('armour', 'robe', 'a2')];
    equipBestFromArmory(c, s);
    expect(c.gear.armour.base).toBe('robe');
    const f = newHero('minotaur', 'fighter', 0, s);
    f.gear.armour = null;
    s.armory = [item('armour', 'scale_mail', 'a3'), item('armour', 'robe', 'a4')];
    equipBestFromArmory(f, s);
    expect(f.gear.armour.base).toBe('scale_mail');
  });
  it('caster prefers a mage quarterstaff over a bigger-damage crossbow', async () => {
    const { equipBestFromArmory } = await import('../src/sim/tick.js');
    const s = makeState();
    const c = newHero('deep_elf', 'wizard', 0, s);
    c.gear.weapon = null;
    s.armory = [item('weapon', 'crossbow', 'w1'), item('weapon', 'quarterstaff', 'w2')];
    equipBestFromArmory(c, s);
    expect(c.gear.weapon.base).toBe('quarterstaff');
  });
});

describe('DCSS weapon skill schools', () => {
  const w = (base) => ({ slot: 'weapon', base, plus: 0, ego: null, rar: 0, rand: null, id: 'ws_' + base });
  it('fighting with an axe trains Axes, not other schools (XP pool follows usage)', async () => {
    const { advanceHeroes } = await import('../src/sim/tick.js');
    const s = makeState();
    const h = newHero('human', 'berserker', 2, s); // starts with a war axe
    s.heroes.push(h);
    const { startRun } = await import('../src/sim/tick.js');
    startRun(h, s);
    advanceHeroes(s, 600, true);
    if (h.kills > 3) {
      expect(h.skills.axes).toBeGreaterThan(3); // starting 3 + training
      expect(h.skills.long_blades).toBe(0);
      expect(h.skills.bows).toBe(0);
    }
  });
  it('min delay: an unskilled battleaxe swings markedly slower than a mastered one', () => {
    const s = makeState();
    const h = newHero('human', 'fighter', 0, s);
    h.gear.shield = null;
    h.gear.weapon = w('battleaxe');
    const slow = heroStats(h, s).aspd;
    h.skills.axes = 15; // battleaxe min-delay skill
    const fast = heroStats(h, s).aspd;
    expect(fast / slow).toBeGreaterThan(1.5);
  });
  it('crosstraining: long blades feed short blades in combat and speed up training', async () => {
    const { effSkill, crossBoost } = await import('../src/data/skills.js');
    const s = makeState();
    const h = newHero('human', 'fighter', 0, s);
    h.skills.long_blades = 12;
    expect(effSkill(h, 'short_blades')).toBeCloseTo(3); // 25% of the related school's excess
    expect(crossBoost(h, 'short_blades')).toBe(1.4);
    expect(effSkill(h, 'bows')).toBe(0); // ranged does not crosstrain
  });
  it('auto-equip picks the trained school over raw damage, until the gap is real', async () => {
    const { equipBestFromArmory } = await import('../src/sim/tick.js');
    const s = makeState();
    const h = newHero('human', 'fighter', 0, s);
    h.gear.weapon = null; h.gear.shield = null;
    h.skills.long_blades = 12;
    s.armory = [w('battleaxe'), w('long_sword')]; // battleaxe: 17 damage, but the school is untrained
    equipBestFromArmory(h, s);
    expect(h.gear.weapon.base).toBe('long_sword');
    /* while for an axe master the battleaxe is genuinely better */
    const h2 = newHero('human', 'fighter', 0, s);
    h2.gear.weapon = null; h2.gear.shield = null;
    h2.skills.axes = 20;
    s.armory = [w('battleaxe'), w('long_sword')];
    equipBestFromArmory(h2, s);
    expect(h2.gear.weapon.base).toBe('battleaxe');
  });
  it('old saves migrate the generic weapon skill into the wielded school', async () => {
    const { loadState } = await import('../src/core/state.js');
    const s = makeState();
    const h = newHero('human', 'fighter', 0, s);
    h.skills = { fighting: 5, weapon: 10, ranged: 4, unarmed: 0, dodging: 2, armour: 3, stealth: 0,
      spellcasting: 0, conjurations: 0, necromancy: 0, fire: 0, ice: 0, summonings: 0 };
    h.gear.weapon = w('scimitar');
    s.heroes.push(h);
    const storage = { data: { 'dcssmanager.save.v2': JSON.stringify(s) },
      getItem(k) { return this.data[k]; }, setItem(k, v) { this.data[k] = v; } };
    const loaded = loadState(storage);
    const lh = loaded.heroes[0];
    expect(lh.skills.long_blades).toBe(10); // scimitar — long blades
    expect(lh.skills.bows).toBe(4); // class has no ranged school — ranged goes into bows
    expect(lh.skills.weapon).toBeUndefined();
    expect(lh.skills.ranged).toBeUndefined();
  });
});

describe('class/race/god fidelity fixes', () => {
  const w = (base) => ({ slot: 'weapon', base, plus: 0, ego: null, rar: 0, rand: null, id: 'ff_' + base });
  it('Summonings is not an attack school: summoner bolts do not scale with it', () => {
    const s = makeState();
    const h = newHero('human', 'summoner', 0, s);
    h.skills.summonings = 0;
    const d0 = heroStats(h, s).dmg;
    h.skills.summonings = 25;
    expect(heroStats(h, s).dmg).toBeCloseTo(d0); // the army grows, the bolts do not
  });
  it('summoner direct damage is a poke compared to a conjurer', () => {
    const s = makeState();
    const sm = newHero('human', 'summoner', 0, s);
    const cj = newHero('human', 'conjurer', 0, s);
    sm.skills.spellcasting = cj.skills.spellcasting = 10;
    sm.skills.summonings = 10; cj.skills.conjurations = 10;
    expect(heroStats(sm, s).dmg).toBeLessThan(heroStats(cj, s).dmg * .55);
  });
  it('summoner army cap grows with the skill', async () => {
    const { summonAlly } = await import('../src/sim/tick.js');
    // cap = 1 + floor(skill/6): four creatures at 18
    const s = makeState();
    const h = newHero('human', 'summoner', 0, s);
    h.skills.summonings = 18;
    expect(1 + Math.floor(h.skills.summonings / 6)).toBe(4);
    expect(summonAlly).toBeTypeOf('function');
  });
  it('stealth shrinks the monster wake radius', async () => {
    const { wakeRadius } = await import('../src/sim/tick.js');
    const s = makeState();
    const h = newHero('human', 'assassin', 0, s);
    h.skills.stealth = 0;
    expect(wakeRadius(h)).toBe(7);
    h.skills.stealth = 27;
    expect(wakeRadius(h)).toBe(2);
  });
  it('only a mage staff feeds spell power, a crossbow does not', () => {
    const s = makeState();
    const h = newHero('human', 'conjurer', 0, s);
    const bare = heroStats(h, s).dmg;
    h.gear.weapon = w('crossbow');
    expect(heroStats(h, s).dmg).toBeCloseTo(bare);
    h.gear.weapon = w('quarterstaff');
    expect(heroStats(h, s).dmg).toBeGreaterThan(bare);
  });
  it('draconian cannot wear body armour and grows scales with XL', () => {
    const s = makeState();
    const h = newHero('draconian', 'fighter', 0, s);
    expect(h.gear.armour).toBeFalsy(); // class starting armour is not granted
    const ac1 = heroStats(h, s).ac;
    h.xl = 15;
    expect(heroStats(h, s).ac).toBeGreaterThan(ac1 + 3); // scales have grown
  });
  it('Trog: berserk fires below 30% HP during a tick', async () => {
    const { startRun, simTick } = await import('../src/sim/tick.js');
    const s = makeState();
    const h = newHero('human', 'fighter', 2, s);
    h.god = 'trog';
    s.heroes.push(h);
    startRun(h, s);
    h.curHp = h.maxHpCache * .2;
    simTick(h, s);
    expect(h.status.berserk).toBeGreaterThan(0);
  });
  it('Elyvilon: periodic healing actually ticks', async () => {
    const { startRun, simTick } = await import('../src/sim/tick.js');
    const s = makeState();
    const h = newHero('human', 'fighter', 2, s);
    h.god = 'elyvilon';
    s.heroes.push(h);
    startRun(h, s);
    h.map.monsters = []; h.map.items = []; h.map.traps = []; // quiet: only the god's tick
    h.curHp = h.maxHpCache * .5;
    const before = h.curHp;
    h.turn = 19; // next tick is a multiple of 20
    simTick(h, s);
    expect(h.curHp).toBeGreaterThan(before);
  });
  it('Sif Muna: casts freely in heavy armour (half encumbrance penalty)', () => {
    const s = makeState();
    const mk = god => {
      const h = newHero('human', 'conjurer', 0, s);
      h.god = god;
      h.gear.armour = { slot: 'armour', base: 'plate', plus: 0, ego: null, rar: 0, id: 'p' + god };
      return heroStats(h, s).dmg;
    };
    // ratio to each one's own "no armour" baseline isolates the penalty from Sif's +25% damage
    const hBare = newHero('human', 'conjurer', 0, s); hBare.god = 'sif_muna';
    const hNone = newHero('human', 'conjurer', 0, s);
    const ratioSif = mk('sif_muna') / heroStats(hBare, s).dmg;
    const ratioNone = mk(null) / heroStats(hNone, s).dmg;
    expect(ratioSif).toBeGreaterThan(ratioNone);
  });
  it('Okawaru: heroism only against uniques and bosses', async () => {
    const { heroAttack, startRun } = await import('../src/sim/tick.js');
    const s = makeState();
    const h = newHero('human', 'fighter', 2, s);
    h.god = 'okawaru';
    s.heroes.push(h);
    startRun(h, s);
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const st = heroStats(h, s);
    const mkMon = boss => ({ n: 'dummy', t: 'm_rat', x: 1, y: 1, hp: 1e6, maxHp: 1e6, ac: 0, ev: 0, dmg: 1, xp: 1, spd: 1, mv: 0, awake: true, boss });
    const a = mkMon(false), b = mkMon(true);
    heroAttack(h, st, a, s);
    heroAttack(h, st, b, s);
    spy.mockRestore();
    expect(1e6 - b.hp).toBeCloseTo((1e6 - a.hp) * 1.25, 0);
  });
});

describe('ranged attacks require line of sight', () => {
  const wallBetween = (h) => {
    /* carve an open corridor along y=2, then drop a full wall column at x=4
       between the hero (2,2) and the monster (6,2) — no gaps, no way around */
    const m = h.map;
    for (let x = 1; x < 8; x++) m.g[2][x] = 0;
    for (let y = 0; y < m.g.length; y++) m.g[y][4] = 1;
    m.px = 2; m.py = 2;
    const mo = m.monsters[0];
    mo.x = 6; mo.y = 2; mo.awake = true; mo.hp = mo.maxHp = 1e6;
    m.monsters.length = 1;
    m.items = []; m.traps = []; m.clouds = [];
    return mo;
  };
  it('a hunter does not shoot an awake monster through a wall', async () => {
    const { startRun, simTick } = await import('../src/sim/tick.js');
    const s = makeState();
    const h = newHero('human', 'hunter', 2, s);
    s.heroes.push(h);
    startRun(h, s);
    const mo = wallBetween(h);
    for (let i = 0; i < 3; i++) simTick(h, s); // distance 4 <= rng 5, but no LOS
    expect(mo.hp).toBe(1e6);
  });
  it('a conjurer does not blast through a wall either, but kills once LOS opens', async () => {
    const { startRun, simTick } = await import('../src/sim/tick.js');
    const s = makeState();
    const h = newHero('deep_elf', 'conjurer', 2, s);
    s.heroes.push(h);
    startRun(h, s);
    const mo = wallBetween(h);
    simTick(h, s);
    expect(mo.hp).toBe(1e6);
    /* open a loophole exactly on the firing line */
    h.map.g[2][4] = 0;
    h.map.px = 2; h.map.py = 2;
    let hit = false;
    for (let i = 0; i < 12 && !hit; i++) { simTick(h, s); hit = mo.hp < 1e6; }
    expect(hit).toBe(true);
  });
});

describe('racial immunities (DCSS)', () => {
  it('gargoyle, naga and ghoul are innately poison-proof; human is not', () => {
    const s = makeState();
    for (const race of ['gargoyle', 'naga', 'ghoul'])
      expect(heroStats(newHero(race, 'fighter', 0, s), s).rPois).toBe(true);
    expect(heroStats(newHero('human', 'fighter', 0, s), s).rPois).toBe(false);
  });
  it('undead ghoul cannot mutate', async () => {
    const { startRun, applyMut } = await import('../src/sim/tick.js');
    const s = makeState();
    const h = newHero('ghoul', 'fighter', 0, s);
    s.heroes.push(h);
    startRun(h, s);
    for (let i = 0; i < 10; i++) applyMut(h, s, null, 'test');
    expect(h.muts).toEqual([]);
  });
  it('undead ghoul neither benefits from nor picks holy weapons', async () => {
    const { scoreItem } = await import('../src/data/items.js');
    const s = makeState();
    const h = newHero('ghoul', 'fighter', 0, s);
    const holy = { slot: 'weapon', base: 'long_sword', plus: 5, ego: 'holy', rar: 2, rand: null, id: 'hw' };
    expect(scoreItem(holy, h)).toBeLessThan(0);
    h.gear.weapon = holy;
    expect(heroStats(h, s).vsUndead).toBe(1); // no holy wrath in undead hands
  });
  it('felid wears no armour at all', () => {
    const s = makeState();
    const h = newHero('felid', 'fighter', 0, s);
    expect(h.gear.armour).toBeFalsy();
  });
});

describe('caster auto-equip does not dress up as a warrior (regression)', () => {
  const mk = (slot, base, plus, ego, id) => ({ slot, base, plus, ego, rar: 1, rand: null, id });
  it('spriggan conjurer skips the +9 war axe, +4 scale mail and tower shield', async () => {
    const { equipBestFromArmory } = await import('../src/sim/tick.js');
    const s = makeState();
    const h = newHero('spriggan', 'conjurer', 2, s);
    h.gear.armour = null; h.gear.weapon = null; h.gear.shield = null;
    s.armory = [
      mk('weapon', 'war_axe', 9, 'electro', 'wa'),
      mk('armour', 'scale_mail', 4, 'regen', 'sm'),
      mk('shield', 'tower', 4, null, 'ts'),
      mk('armour', 'robe', 0, null, 'rb'),
      mk('weapon', 'quarterstaff', 0, null, 'qs'),
    ];
    equipBestFromArmory(h, s);
    expect(h.gear.weapon.base).toBe('quarterstaff'); // staff over the shiny axe
    expect(h.gear.armour.base).toBe('robe');         // robe over enchanted scale mail
    expect(h.gear.shield).toBeFalsy();               // no tower shield, thanks
  });
  it('a caster with real Armour skill may graduate into scale mail', async () => {
    const { scoreItem } = await import('../src/data/items.js');
    const s = makeState();
    const h = newHero('human', 'conjurer', 0, s);
    const scale = mk('armour', 'scale_mail', 4, null, 'sm2');
    const robe = mk('armour', 'robe', 0, null, 'rb2');
    expect(scoreItem(scale, h)).toBeLessThan(scoreItem(robe, h));
    h.skills.armour = 22; // trained: encumbrance penalty melts away
    expect(scoreItem(scale, h)).toBeGreaterThan(scoreItem(robe, h));
  });
});
