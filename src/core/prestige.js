/* Prestige: after a victory the cycle can be reset for Legends ⚜ — a permanent
   currency spent in its own shop. Each prestige also raises the NG+ level.
   Survives a prestige: Hall of Fame, combo stars/shards/collection, unrands
   (both the account flags and the items themselves), zot upgrades, keystones
   of the Memory tree, lifetime stats and the prestige layer itself. */
import { NODES, treeLvl } from '../data/memtree.js';
import { ascKeepGear, ascKeepTree } from './ascension.js';

/** effective NG+ level: prestiges + the legacy "New Depth" keystone */
export const ngLevel = s => (s.ng || 0) + (treeLvl(s, 'k_ngplus') > 0 ? 1 : 0);
/* NG+ is only a light seasoning on monsters (capped at +150%): the real
   difficulty valve is the in-cycle hardening that compounds with every Orb
   carried out, measuring the build's actual success instead of account age.
   The first win of a fresh cycle is always within reach — no stalls, and a
   runaway build stops itself: each win makes the next one x1.3 harder */
export const ngMonMul = s => 1 + Math.min(1, .1 * ngLevel(s)); /* hybrid: numbers cap at x2, affixes carry the depth */

export const PUPGRADES = [
  { k: 'p_dmg', n: 'Legendary might', d: '+8% damage for all heroes per lvl', max: 20, base: 3, g: 1.5 },
  { k: 'p_hp', n: 'Legendary vigour', d: '+8% health for all heroes per lvl', max: 20, base: 3, g: 1.5 },
  { k: 'p_memmul', n: 'Echo of cycles', d: '+15% Memory gain per lvl', max: 15, base: 4, g: 1.6 },
  { k: 'p_mem', n: 'Engraved paths', d: 'start each cycle with +600 Memory per lvl', max: 10, base: 5, g: 1.7 },
  { k: 'p_gold', n: 'Old treasury', d: 'start each cycle with +750 gold per lvl', max: 10, base: 3, g: 1.6 },
  { k: 'p_roll', n: 'Famous guild', d: '−5% summon cost per lvl', max: 8, base: 6, g: 1.9 },
  { k: 'p_legacy', n: 'Legacy engraving', d: '+1% damage and health per lvl, without limit', max: 9999, base: 50, g: 1.22 },
];
export const pupg = (s, k) => (s.pupg && s.pupg[k]) || 0;
export const pupgCost = (s, u) => Math.ceil(u.base * Math.pow(u.g, pupg(s, u.k)));

/** progress earned within the current cycle (lifetime stats minus the snapshot) */
export function cycleProgress(s) {
  const b = s.cycBase || { wins: 0, runes: 0, uniq: 0, mem: 0 };
  return {
    wins: (s.stat.wins || 0) - b.wins,
    runes: (s.runesTotal || 0) - b.runes,
    uniq: (s.stat.uniqKills || 0) - b.uniq,
    mem: (s.stat.memEarned || 0) - b.mem,
  };
}

/** Legends granted for the current cycle: long, rich cycles beat quick spam */
export function legendsReward(s) {
  const c = cycleProgress(s);
  if (c.wins < 1) return 0;
  const raw = c.wins * 8 + c.runes * 3 + c.uniq + Math.sqrt(Math.max(0, c.mem) / 50);
  const runner = 1 + .15 * Math.max(0, (s.cycRunnerBest || 0) - 3); /* greed pays */
  /* the NG reward multiplier caps at +500%: difficulty is capped, so an
     uncapped reward would arm a power->cadence->reward runaway loop */
  return Math.max(1, Math.round(raw * runner * (1 + .25 * Math.min(20, ngLevel(s)))));
}

/* the deeper the ladder, the more Orbs a cycle must produce before it can be
   reset: the requirement runs into the in-cycle x1.3 compound, so the prestige
   cadence self-balances against the build's real power — no spam, no stall */
/* The prestige requirement is a SNAPSHOT, locked in when a cycle begins
   (account creation and every doPrestige), never recomputed while the cycle is
   in progress. This is the whole fix for the first-prestige deadlock: the old
   live formula read from readiness, so as a delver banked Orbs it raised its own
   readiness (stars) and the goal it was chasing crept out of reach — win 5, need
   6, freeze forever. A fixed target can always be finished.

   The bar for the NEXT cycle is a function of the account's LIFETIME Orb count
   (stat.wins), not of the current cycle. Because that total only ever climbs and
   is independent of cadence, a prestige-ASAP loop can't keep the bar flat: its
   lifetime total accrues just as fast, so its bar rises just as fast — no
   artificial per-prestige floor needed. Greed still pays, since this cycle's
   Orbs are part of the total. The curve is sqrt (sub-linear) so early cycles stay
   fast and frequent, then — because the in-cycle 1.25^wins compound is
   exponential in the bar — an ever-rising bar bends cadence into a graceful
   asymptote over dozens of prestiges instead of the runaway a capped bar allowed. */
export const prestigeReq = s => s.prestReq || 1;
/** requirement for the next cycle, from lifetime Orbs — snapshotted at prestige time */
export const nextPrestigeReq = s => 1 + Math.floor(1.1 * Math.sqrt(s.stat.wins || 0));
export const canPrestige = s => cycleProgress(s).wins >= prestigeReq(s);

/** the reset itself; returns the Legends earned or 0 when not allowed */
export function doPrestige(s) {
  if (!canPrestige(s)) return 0;
  const reward = legendsReward(s);
  if (reward <= 0) return 0;
  const nextReq = nextPrestigeReq(s); /* lock in next cycle's bar before stats reset */
  s.legends = (s.legends || 0) + reward;
  s.ng = (s.ng || 0) + 1;
  s.prestiges = (s.prestiges || 0) + 1;

  /* unrand items survive — collect them from the armory and from worn gear.
     Ascension "Engraved Armoury" lets ALL gear survive, not just artefacts. */
  const keepAll = ascKeepGear(s);
  const keep = s.armory.filter(it => keepAll || it.unrandId);
  for (const h of s.heroes)
    for (const slot of Object.keys(h.gear || {}))
      if (h.gear[slot] && (keepAll || h.gear[slot].unrandId)) keep.push(h.gear[slot]);

  s.heroes = [];
  s.armory = keep;
  s.gold = 200 + pupg(s, 'p_gold') * 750;
  s.scrap = 0; s.runes = 0; s.rolls = 0; s.forges = 0; s.pity = 0;
  s.mem = pupg(s, 'p_mem') * 600;
  s.pendingDeaths = []; s.pendingWins = [];
  s.progress = { D: 0, Lair: 0, Orc: 0, Elf: 0, Vaults: 0, Depths: 0, Zot: 0, Abyss: 0 };

  /* the tree burns down to its engraved keystones — unless Ascension "Living
     Memory" preserves the whole tree */
  if (!ascKeepTree(s)) {
    const tree = { root: 1 };
    for (const n of NODES)
      if (n.keystone && treeLvl(s, n.id) > 0) tree[n.id] = s.tree[n.id];
    s.tree = tree;
  }
  s.rev = (s.rev || 0) + 1; /* tree changed: invalidate stat caches */

  s.cofferBuys = 0; s.zigFunded = 0; s.provisions = {}; /* gold sinks reset each cycle */
  s.cycRunes = []; /* named runes become collectable again */
  s.cycRunnerBest = 0; s.cycContractDone = 0; /* runner arc and contract reset */
  s.prestReq = nextReq; /* the next cycle's fixed target */
  /* new cycle snapshot */
  s.cycBase = {
    wins: s.stat.wins || 0,
    runes: s.runesTotal || 0,
    uniq: s.stat.uniqKills || 0,
    mem: s.stat.memEarned || 0,
  };
  if (typeof window !== 'undefined' && window.__cloudPush) window.__cloudPush(true);
  return reward;
}
