/* Gold sinks: the late game floods the treasury far faster than summon/forge can
   drain it, so unspent gold used to just burn at prestige. Three valves:
   - Gozag Coffers  — gold → Memory, a per-cycle diminishing exchange (cross-cycle progress)
   - Guild Provisions — per-cycle guild buffs, burned at prestige like the gold itself
   - Ziggurat funding — an escalating fee to send a hero on a deep zig farm (in tick.js)
   All per-cycle counters reset in doPrestige. Constants marked TUNABLE are set by sim. */
import { ngLevel } from './prestige.js';
import { gainMem } from '../data/memtree.js';

/* ---- Gozag Coffers: gold → Memory, diminishing within a cycle ---- */
export const COFFER_BASE = 250000;                              /* TUNABLE */
export const cofferCount = s => s.cofferBuys || 0;
/* each purchase this cycle doubles the price for the same Memory pack, so the
   effective gold→Memory rate decays — a valve for the hoard, not a main engine */
export const cofferCost = s => Math.floor(COFFER_BASE * Math.pow(2, cofferCount(s)));
export const cofferMem  = s => Math.floor(2000 * (1 + 0.5 * (s.prestiges || 0)) * (1 + 0.3 * ngLevel(s))); /* TUNABLE */
export function buyCoffer(s) {
  const c = cofferCost(s);
  if (s.gold < c) return 0;
  s.gold -= c;
  const m = cofferMem(s);
  gainMem(s, m);
  s.cofferBuys = cofferCount(s) + 1;
  return m;
}

/* ---- Guild Provisions: per-cycle buffs, burned at prestige ---- */
export const PROVISIONS = [
  { k: 'banner', n: 'War Banner',        d: '+3% damage for the whole guild, per banner',   ico: 'ur_singing', mul: 'dmg',  per: 0.03, base: 100000, g: 1.6, max: 15 },
  { k: 'charts', n: 'Prospector\'s Charts', d: '+8% dungeon gold, per set of charts',        ico: 'i_scroll',   mul: 'gold', per: 0.08, base: 80000,  g: 1.6, max: 15 },
  { k: 'camp',   n: 'Reinforced Camp',    d: '+3% health for the whole guild, per upgrade',  ico: 'a_leather',  mul: 'hp',   per: 0.03, base: 100000, g: 1.6, max: 15 },
];
export const provStacks = (s, k) => (s.provisions && s.provisions[k]) || 0;
export const provCostOf = (s, p) => Math.floor(p.base * Math.pow(p.g, provStacks(s, p.k)));
export function buyProvision(s, k) {
  const p = PROVISIONS.find(x => x.k === k);
  if (!p || provStacks(s, p.k) >= p.max) return false;
  const c = provCostOf(s, p);
  if (s.gold < c) return false;
  s.gold -= c;
  s.provisions = s.provisions || {};
  s.provisions[p.k] = provStacks(s, p.k) + 1;
  return true;
}
/** aggregate multiplier for a stat kind ('dmg' | 'gold' | 'hp'), 1 when unstocked */
export const provMul = (s, mul) => {
  let m = 1;
  for (const p of PROVISIONS) if (p.mul === mul) m += p.per * provStacks(s, p.k);
  return m;
};

/* ---- Ziggurat funding: escalating fee; the action itself lives in tick.js ---- */
export const ZIG_BASE = 50000;                                 /* TUNABLE */
export const zigCount = s => s.zigFunded || 0;
export const zigFee = s => Math.floor(ZIG_BASE * Math.pow(4, zigCount(s)));
/* a funded zig starts deep so it stays lethal and cannot become a gold faucet */
export const zigStartDepth = s => 22 + 2 * ngLevel(s);         /* TUNABLE */
