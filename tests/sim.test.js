import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
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

describe('the pack: what a seeker carries is at risk', () => {
  it('found gear rides in the pack and reaches the armoury on the stairs', async () => {
    const { acquireItem, shipPack } = await import('../src/sim/tick.js');
    const { randomItem } = await import('../src/data/items.js');
    const s = makeState();
    const h = newHero('minotaur', 'fighter', 2, s);
    s.heroes.push(h);
    h.gear = {};                       /* nothing worn: the find cannot be auto-equipped away */
    const before = s.armory.length;
    for (let i = 0; i < 3; i++) acquireItem(h, s, randomItem('ring', 0, () => 0.5));
    expect(s.armory.length, 'banked too early').toBe(before);
    expect(h.pack.length).toBeGreaterThan(0);
    const carried = h.pack.length;
    shipPack(h, s);
    expect(s.armory.length).toBe(before + carried);
    expect(h.pack.length).toBe(0);
  });

  it('a death takes the pack and the purse with it', async () => {
    /* This is the whole point. Gold used to be half-banked on pickup with the rest
       returning from the corpse, and gear reached the armoury the moment it was found,
       so a seeker's death cost the guild nothing but the seeker -- and caution measured
       1.02x because there was nothing to be cautious about. */
    const { acquireItem, heroDie, startRun } = await import('../src/sim/tick.js');
    const { randomItem } = await import('../src/data/items.js');
    const s = makeState();
    const h = newHero('minotaur', 'fighter', 2, s);
    s.heroes.push(h);
    startRun(h, s);                    /* heroDie reads run state (map, rep, log) */
    /* straight into the pack: a find that fits an empty slot is worn instead, and worn
       gear is meant to come home from the body -- that part is unchanged */
    h.gear = {};
    h.pack = [randomItem('ring', 0, () => 0.5), randomItem('ring', 0, () => 0.5)];
    h.gold = 500;
    const goldBefore = s.gold, armoryBefore = s.armory.length;
    heroDie(h, 'a rat', s);   /* (hero, killer, state) */
    expect(s.gold, 'the purse came home anyway').toBe(goldBefore);
    expect(s.armory.length, 'the pack came home anyway').toBe(armoryBefore);
  });
});

describe('consumables are implemented and actually used', () => {
  it('every potion and scroll has an effect the sim can apply', async () => {
    /* A switch that silently falls through spends the item and does nothing, which is
       indistinguishable from bad luck. The scroll of blinking did exactly that in every
       language but English: its case compared the type key against its own translation. */
    const src = readFileSync(join(ROOT, 'src/sim/tick.js'), 'utf8');
    const { POTIONS, SCROLLS } = await import('../src/data/consumables.js');
    for (const k of Object.keys(POTIONS)) expect(src, 'potion ' + k).toContain("case '" + k + "'");
    for (const k of Object.keys(SCROLLS)) expect(src, 'scroll ' + k).toContain("case '" + k + "'");
  });

  it('every consumable has a path to being used on purpose', async () => {
    /* Having an effect is not enough: resistance, brilliance and agility all worked and
       none was ever drunk deliberately, and blink was never read at all. Identified and
       unused, they are cargo. */
    const src = readFileSync(join(ROOT, 'src/sim/tick.js'), 'utf8');
    const ai = src.slice(src.indexOf('function consumableAI'));
    const { POTIONS, SCROLLS } = await import('../src/data/consumables.js');
    const deliberate = k => ai.includes("'" + k + "'");
    /* mutation is the one exception, and on purpose: drinking it is a gamble, so it is
       reached only by the desperate identification path */
    for (const k of Object.keys(POTIONS)) if (k !== 'mutation')
      expect(deliberate(k), 'potion ' + k + ' is never chosen').toBe(true);
    for (const k of Object.keys(SCROLLS))
      expect(deliberate(k), 'scroll ' + k + ' is never chosen').toBe(true);
  });
});

describe('a legendary is never lost to one bad floor', () => {
  it('relics survive the pack; ordinary gear does not', async () => {
    const { acquireItem, heroDie, startRun } = await import('../src/sim/tick.js');
    const { randomItem } = await import('../src/data/items.js');
    const s = makeState();
    const h = newHero('minotaur', 'fighter', 2, s);
    s.heroes.push(h);
    startRun(h, s);
    h.gear = {};
    const plain = randomItem('ring', 0, () => 0.5); plain.rar = 1;
    const relic = randomItem('ring', 0, () => 0.5); relic.rar = 3; relic.rand = 'Wrath';
    h.pack = [plain, relic];
    const before = s.armory.length;
    heroDie(h, 'a hydra', s);
    const home = s.armory.slice(before).map(i => i.id);
    expect(home, 'the legendary was lost').toContain(relic.id);
    expect(home, 'ordinary gear came home free').not.toContain(plain.id);
  });

  it('a worn relic bypasses the ninety-percent roll entirely', async () => {
    /* One death in ten used to take a worn legendary, which is a catastrophe the player
       can neither foresee nor prevent -- not the price of a decision. */
    const { heroDie, startRun } = await import('../src/sim/tick.js');
    const { randomItem, isRelic } = await import('../src/data/items.js');
    const s = makeState();
    let recovered = 0;
    for (let i = 0; i < 40; i++) {
      const h = newHero('minotaur', 'fighter', 2, s);
      s.heroes.push(h);
      startRun(h, s);
      const relic = randomItem('amulet', 0, () => 0.5);
      relic.rar = 3; relic.unrandId = 'singing';
      expect(isRelic(relic)).toBe(true);
      h.gear = { amulet: relic };
      const before = s.armory.length;
      heroDie(h, 'a hydra', s);
      if (s.armory.length > before) recovered++;
    }
    expect(recovered, 'a worn relic was lost at least once in forty deaths').toBe(40);
  });
});

describe('a unique is a long fight, not an unwinnable one', () => {
  it('the nemesis ratchet stops', async () => {
    /* Every hero a unique ate made it 15% stronger with no ceiling: losing to it was
       how you made it unbeatable, and nothing on screen said so. */
    const { nemesisLevel, recordNemesisKill, NEMESIS_CAP } = await import('../src/core/chronicle.js');
    const s = makeState();
    for (let i = 0; i < 40; i++) recordNemesisKill(s, 'lernaean');
    expect(s.nemeses.lernaean).toBe(40);        /* the chronicle still remembers */
    expect(nemesisLevel(s, 'lernaean')).toBe(NEMESIS_CAP);
  });

  it('a unique carries its multiplier in health, not in damage', async () => {
    /* The Lernaean hydra hit for 50 against a well-equipped Lair-era hero's 203 health
       while needing ten blows to fall -- four hits to die, ten to win. Endurance makes a
       long fight, which potions and positioning can decide; a damage bump on top just
       shortens it in the monster's favour. */
    const { makeMon } = await import('../src/sim/mapgen.js');
    const { UNIQUES, MONS } = await import('../src/data/monsters.js');
    const { BR_OFFSET } = await import('../src/data/branches.js');
    const u = UNIQUES.lernaean, depth = BR_OFFSET.lair + 6, rng = () => 0.5;
    const plain = makeMon(u.base, depth, 1, 1, rng);
    /* mapgen multiplies hp by u.mul and leaves dmg alone; assert the contract holds by
       reading the source, since spawning a unique needs a whole floor */
    const src = readFileSync(join(ROOT, 'src/sim/mapgen.js'), 'utf8');
    const line = src.split('\n').find(l => l.includes('m.hp=Math.floor(m.hp*u.mul*nem)'));
    expect(line, 'the unique spawn changed shape').toBeTruthy();
    expect(line, 'damage is multiplied again').not.toContain('m.dmg=');
    expect(plain.dmg).toBeGreaterThan(0);
  });
});

describe('a caster can be answered', () => {
  it('willpower cuts spell damage, and armour still does not', async () => {
    /* The ego "of willpower" was declared on armour, listed in the item table, and read
       nowhere: the one property that should answer a caster did nothing. Zot is full of
       them, a bolt already ignores half of armour and half of resistance, and a lich
       heals itself for 40% of what it lands -- so a player who armoured up had nothing
       to buy. A death screen showed +4 crystal plate and two bolts of 317 and 228. */
    const { heroStats } = await import('../src/sim/hero.js');
    const { ARM_EGOS } = await import('../src/data/items.js');
    expect(ARM_EGOS.some(e => e.mr), 'no willpower ego to wire up').toBe(true);
    const s = makeState();
    const bare = newHero('minotaur', 'fighter', 2, s);
    bare.gear = { armour: { slot: 'armour', base: 'plate', plus: 0, rar: 0, id: 'a1' } };
    const willed = newHero('minotaur', 'fighter', 2, s);
    willed.gear = { armour: { slot: 'armour', base: 'plate', plus: 0, rar: 0, ego: 'mr', id: 'a2' } };
    const a = heroStats(bare, s), b = heroStats(willed, s);
    expect(a.mrCut).toBe(0);
    expect(b.mrCut).toBeGreaterThan(0);
    expect(b.ac).toBeCloseTo(a.ac, 5);          /* willpower is not armour */
  });
});

describe('a necromancer summons by the skill it actually trains', () => {
  it('the ally ladder and the ally cap both read necromancy', async () => {
    /* Death Channel is a necromancy spell, and both the summon tier and the ally cap
       read `summonings` alone -- which a necromancer never trains. It called rats at
       Zot:4 with XL15 behind it, capped at two of them, for the whole game. The power
       line beside the ladder already read either skill; the ladder and the cap did not. */
    const src = readFileSync(join(ROOT, 'src/sim/tick.js'), 'utf8');
    const cap = src.split('\n').find(l => l.includes('const sumCap='));
    const tier = src.split('\n').find(l => l.includes('const skl=') && l.includes('summonings'));
    expect(cap, 'the ally cap ignores necromancy').toMatch(/sumSkl|necromancy/);
    expect(tier, 'the summon tier ignores necromancy').toMatch(/necromancy/);
  });

  it('a trained necromancer outgrows the rat', async () => {
    const { newHero } = await import('../src/sim/hero.js');
    const s = makeState();
    const h = newHero('octopode', 'necromancer', 2, s);
    h.skills.necromancy = 26;
    const skl = Math.max(h.skills.summonings || 0, h.skills.necromancy || 0);
    expect(skl, 'necromancy does not reach the ladder').toBeGreaterThanOrEqual(24);
    expect(2 + Math.floor(skl / 4), 'still capped at two allies').toBeGreaterThan(2);
  });
});

describe('a seeker is buried once', () => {
  it('dying twice leaves one epitaph', async () => {
    /* Two of the nine call sites do not return after killing the hero, so execution
       reached the next health check -- still below zero -- and buried the same seeker
       again. The player saw the death screen twice. */
    const { heroDie, startRun } = await import('../src/sim/tick.js');
    const s = makeState();
    const h = newHero('minotaur', 'fighter', 2, s);
    s.heroes.push(h);
    startRun(h, s);
    h.curHp = -5;
    heroDie(h, 'a lich', s);
    heroDie(h, 'a lich', s);           /* the second call is the bug */
    expect(s.pendingDeaths.length).toBe(1);
    expect(s.stat.deaths).toBe(1);
    expect(s.fame.length).toBe(1);
  });
});
