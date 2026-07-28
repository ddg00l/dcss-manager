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
export const runeAura = s => memHas(s, 'k_runeaura') ? 1 + 0.02 * s.runesTotal : 1;
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

/* ---- the dungeon tracks the guild's power ----
   Every difficulty scalar in the game is capped (ngMonMul at x2, eliteChance at
   48%, affixLevel at the NG level) while several power scalars are not (Legacy
   Engraving +1%/lvl to 9999, Eternal Legacy +3%/lvl, the rune aura per rune).
   Capped difficulty against uncapped power can only end one way, and it did:
   with the old exponential wall removed the sim ran to 116 Orbs a day and still
   accelerating, banking 21 billion gold.

   So monsters now scale with the account's OWN multiplier stack, damped by
   MON_TRACK. Because the exponent is below 1 the guild still pulls ahead — real,
   felt progress — but the gap widens slowly instead of exploding. The in-cycle
   escalation stays on top of this: it supplies the arc WITHIN a cycle, this
   supplies the floor ACROSS cycles. TUNABLE, and the pair must be tuned
   together. */
export const MON_TRACK = 0.78;
/** geometric mean of the guild's damage and health multipliers */
export const accountPower = s => Math.sqrt(gAtk(s) * gHp(s));
export const powerMonMul = s => Math.pow(Math.max(1, accountPower(s)), MON_TRACK);
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
