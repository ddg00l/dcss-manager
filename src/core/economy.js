import { RKEYS } from '../data/races.js';
import { CKEYS } from '../data/classes.js';
import { comboRarity } from '../data/combos.js';

/* Per-depth gold compounding. Was 1.22 on kills and 1.24 on floor piles, which
   at Zot depth is a ~200x multiplier stacked on top of a permanent-multiplier
   stack reaching ~1000x — measured result: 77M banked against sinks priced at
   100k. Deep floors should still pay noticeably better, not exponentially. */
export const GOLD_DEPTH_BASE = 1.13;

export const ZUPGRADES = [
  { k: 'zatk',  n: 'Essence of Might',      d: '+10% damage for all heroes per lvl',   base: 2, g: 1.45, max: 20 },
  { k: 'zhp',   n: 'Essence of Fortitude', d: '+10% health for all heroes per lvl', base: 2, g: 1.45, max: 20 },
  { k: 'zloot', n: 'Essence of Greed',  d: '+15% gold per lvl',              base: 2, g: 1.45, max: 15 },
  { k: 'zluck', n: 'Essence of Luck',     d: '+3% legendary summon chance per lvl', base: 5, g: 2.2, max: 5 },
];

import { memEff, memHas } from '../data/memtree.js';

export const upg  = (s, k) => s.upg[k]  || 0; /* legacy, migration only */
export const zupg = (s, k) => s.zupg[k] || 0;
export const zupgCost = (s, u) => Math.floor(u.base * Math.pow(u.g, zupg(s, u.k)));
/* elite levels above 5 are earned through prestige cycles */
export const zupgCap = (s, u) => Math.min(u.max, 5 + 2 * (s.prestiges || 0));

/* Hall of Fame: first victories inspire the most; capped so it cannot become
   the dominant compounding engine across prestige cycles */
export const fameMul = s => {
  const w = (s.stat && s.stat.wins) || 0;
  return 1 + Math.min(1, w <= 5 ? w * .08 : .4 + (w - 5) * .03);
};
export const ghostMul = s => memHas(s, 'k_ghosts') ? 1 + Math.min(0.30, s.stat.deaths * 0.005) : 1;
/* Rune Auras. This was the one permanent multiplier with neither a cap nor a
   price: +2% damage and gold per rune, linear in a lifetime total that simply
   accumulates as a by-product of delving (measured: 574 runes in ten days, i.e.
   x12.5 to damage AND to gold, still climbing). Every other permanent term is
   disciplined — fame and ghosts are capped, Great records are bounded by the
   content, and the Legacy engravings pay linearly for an exponentially rising
   price, which is diminishing returns by another name. The aura had none of
   that, so it drove the runaway on both the power and the gold side.

   Sub-linear now: sqrt keeps the early game almost identical (25 runes: +0.45
   against the old +0.50) while 574 runes give x3.2 instead of x12.5. Runes stay
   worth chasing; they stop being an engine.

   s.runeAuraLegacy grandfathers existing accounts — see the balV 6 migration.
   It is a frozen constant, so veterans lose nothing they had earned and still
   stop compounding from here on. */
export const RUNE_AURA_K = 0.09;
/* Runes the guild has burned on dark summonings. They are gone from the aura:
   a rune spent is a rune the guild no longer draws power from.

   This is the opportunity cost the dark summoning never had. A premium roll cost
   one rune, flat, while runes piled up in the thousands and the aura counted the
   LIFETIME total, so spending them was free — measured, whale builds made 2200
   and 3400 summons against a normal 411 and took twice the Orbs per day on
   otherwise identical trees, slots and keystones. Unlimited conversion at a
   fixed price, the same structural flaw the aura itself had before it went
   sub-linear.

   Now the trade is real and legible in both directions: burn your trophies for a
   better seeker today, or keep them and let the guild draw on them forever. */
/* How much aura a spent rune actually costs. At full weight the trade was
   ruinous rather than merely expensive: the aura is sqrt-shaped and reaches x5
   at two thousand runes, so a whale that spent its whole stock lost a fivefold
   multiplier at once and finished 38% BEHIND a normal build. A dead strategy is
   a worse outcome than a strong one — this has to price the dark summoning, not
   forbid it. TUNABLE. */
export const AURA_SPEND_WEIGHT = 0.5;
export const runesKept = s =>
  Math.max(0, (s.runesTotal || 0) - AURA_SPEND_WEIGHT * (s.runesSpent || 0));
export const runeAura = s => memHas(s, 'k_runeaura')
  ? 1 + RUNE_AURA_K * Math.sqrt(runesKept(s)) + (s.runeAuraLegacy || 0)
  : 1;
import { ngLevel, pupg, ngPlusRewardMul } from './prestige.js';
import { greatMul } from './chronicle.js';
import { provMul } from './treasury.js';
import { ascDmgMul, ascHpMul, ascGoldMul, ascSlots } from './ascension.js';
export const ngMul = s => (1 + 1.5 * Math.min(10, ngLevel(s))) * ngPlusRewardMul(s); /* gold reward caps with the rest of the scalars; the New Depth keystone multiplies on top */

export const gAtk  = s => (1 + memEff(s, 'atk')) * (1 + 0.1 * zupg(s, 'zatk')) * fameMul(s) * ghostMul(s) * runeAura(s) * (1 + .08 * pupg(s, 'p_dmg')) * (1 + .01 * pupg(s, 'p_legacy')) * greatMul(s) * provMul(s, 'dmg') * ascDmgMul(s);
export const gHp   = s => (1 + memEff(s, 'hp'))  * (1 + 0.1 * zupg(s, 'zhp'))  * fameMul(s) * (1 + .08 * pupg(s, 'p_hp')) * (1 + .01 * pupg(s, 'p_legacy')) * greatMul(s) * provMul(s, 'hp') * ascHpMul(s);
export const gSpd  = s => 1 + memEff(s, 'spd');
export const gGold = s => (1 + memEff(s, 'gold')) * (1 + 0.15 * zupg(s, 'zloot')) * runeAura(s) * ngMul(s) * provMul(s, 'gold') * ascGoldMul(s);
export const gDrop = s => 1 + memEff(s, 'drop');
export const gXp   = s => 1 + memEff(s, 'xp');
export const maxSlots = s => 1 + memEff(s, 'slot') + ascSlots(s);
export const shardMul = s => 1 + memEff(s, 'shard');
export const forgeDisc = s => 1 - Math.min(0.5, memEff(s, 'fdisc'));

export const rollCost = s =>
  Math.floor(150 * Math.pow(1.18, s.rolls) * (1 - Math.min(0.5, memEff(s, 'gdisc'))) * (1 - .05 * pupg(s, 'p_roll')));
/** all heroes dead/gone — the guild sends a seeker for free */
export const freeRollAvailable = s => !s.heroes.some(h => h.state === 'camp' || h.state === 'run');
export const effectiveRollCost = s => freeRollAvailable(s) ? 0 : rollCost(s);
export const PITY_AT = 40;
/** Roll a race/class combo. Pure: rng is injected. */
export function rollCombo(s, premium, rng) {
  const luck = 0.03 * zupg(s, 'zluck');
  const w = premium ? [0.30, 0.40, 0.22, 0.08 + luck] : [0.55, 0.30, 0.12, 0.03 + luck];
  const r = rng();
  let tier = 3, acc = 0;
  for (let i = 0; i < 4; i++) { acc += w[i]; if (r < acc) { tier = i; break; } }
  return pickComboOfTier(tier, rng);
}
export function pickComboOfTier(tier, rng) {
  const pool = [];
  for (const rk of RKEYS) for (const ck of CKEYS)
    if (comboRarity(rk, ck) === tier) pool.push([rk, ck]);
  const p = pool[Math.floor(rng() * pool.length)];
  return { race: p[0], cls: p[1], rarity: tier };
}
