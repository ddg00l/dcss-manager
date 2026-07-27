/* Gold sinks: the late game floods the treasury far faster than summon/forge can
   drain it, so unspent gold used to just burn at prestige. Three valves:
   - Gozag Coffers  — gold → Memory, a per-cycle diminishing exchange (cross-cycle progress)
   - Guild Provisions — per-cycle guild buffs, burned at prestige like the gold itself
   - Ziggurat funding — an escalating fee to send a hero on a deep zig farm (in tick.js)
   All per-cycle counters reset in doPrestige. Constants marked TUNABLE are set by sim. */
import { ngLevel } from './prestige.js';
import { gainMem } from '../data/memtree.js';

/* ---- Gozag Coffers: gold → Memory, diminishing within a cycle ---- */
export const COFFER_BASE = 100000;                              /* TUNABLE */
export const COFFER_GROWTH = 1.4;                               /* TUNABLE */
export const cofferCount = s => s.cofferBuys || 0;
/* each purchase this cycle costs more for the same Memory pack, so the effective
   gold→Memory rate decays — a valve for the hoard, not a main engine. Growth is
   gentle (not doubling) so a high-income cycle keeps draining all cycle instead
   of pricing itself out after a dozen buys. */
export const cofferCost = s => Math.floor(COFFER_BASE * Math.pow(COFFER_GROWTH, cofferCount(s)));
/* the Memory pack is deliberately small: draining otherwise-wasted gold is the
   feature, not the exchange rate — a rich pack would accelerate the tree into a
   prestige runaway (measured at ~20-30% of Memory income in the first draft) */
export const cofferMem  = s => Math.floor(195 * (1 + 0.12 * (s.prestiges || 0))); /* TUNABLE */
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
/* modest, bounded within-cycle power. A gold-boosting provision was dropped: in a
   gold sink it is self-defeating (buying it makes more gold) and it was inflating
   the very hoard this feature exists to drain. Small per-stack values keep the
   cyclic power boost from compounding into a prestige runaway. TUNABLE. */
export const PROVISIONS = [
  { k: 'banner', n: 'War Banner',     d: '+1% damage for the whole guild, per banner',  ico: 'ur_singing', mul: 'dmg', per: 0.01, base: 500000, g: 1.6, max: 6 },
  { k: 'camp',   n: 'Reinforced Camp', d: '+1% health for the whole guild, per upgrade', ico: 'a_leather',  mul: 'hp',  per: 0.01, base: 500000, g: 1.6, max: 6 },
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
