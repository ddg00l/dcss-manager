import { RKEYS } from '../data/races.js';
import { CKEYS } from '../data/classes.js';
import { comboRarity } from '../data/combos.js';

export const ZUPGRADES = [
  { k: 'zatk',  n: 'Essence of Might',      d: '+10% damage for all heroes per lvl',   base: 2, g: 1.8, max: 20 },
  { k: 'zhp',   n: 'Essence of Fortitude', d: '+10% health for all heroes per lvl', base: 2, g: 1.8, max: 20 },
  { k: 'zloot', n: 'Essence of Greed',  d: '+15% gold per lvl',              base: 2, g: 1.8, max: 15 },
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
import { ngLevel, pupg } from './prestige.js';
export const ngMul = s => 1 + 1.5 * ngLevel(s);

export const gAtk  = s => (1 + memEff(s, 'atk')) * (1 + 0.1 * zupg(s, 'zatk')) * fameMul(s) * ghostMul(s) * runeAura(s) * (1 + .08 * pupg(s, 'p_dmg'));
export const gHp   = s => (1 + memEff(s, 'hp'))  * (1 + 0.1 * zupg(s, 'zhp'))  * fameMul(s) * (1 + .08 * pupg(s, 'p_hp'));
export const gSpd  = s => 1 + memEff(s, 'spd');
export const gGold = s => (1 + memEff(s, 'gold')) * (1 + 0.15 * zupg(s, 'zloot')) * runeAura(s) * ngMul(s);
export const gDrop = s => 1 + memEff(s, 'drop');
export const gXp   = s => 1 + memEff(s, 'xp');
export const maxSlots = s => 1 + memEff(s, 'slot');
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
