/* DCSS mutations: permanent for the hero, both good and bad. */
export const MUTS = {
  horns:        { n: 'Horns',            good: 1, d: '+8% melee damage' },
  claws:        { n: 'Claws',           good: 1, d: '+15% unarmed damage' },
  fire_res:     { n: 'Fire Resistance',   good: 1, d: 'Resists fire' },
  cold_res:     { n: 'Cold Resistance',  good: 1, d: 'Resists cold' },
  tough:        { n: 'Tough Skin',    good: 1, d: '+3 AC' },
  fast:         { n: 'Fleet-Footed',      good: 1, d: '+8% delving speed' },
  regenm:       { n: 'Regeneration',     good: 1, d: '+50% regeneration' },
  clever:       { n: 'Cleverness',     good: 1, d: '+15% experience' },
  frail:        { n: 'Frailty',       good: 0, d: '−10% health' },
  weak:         { n: 'Weakness',        good: 0, d: '−8% damage' },
  teleportitis: { n: 'Teleportitis',      good: 0, d: 'Occasionally teleports you at random' },
  berserkitis:  { n: 'Berserkitis',       good: 0, d: 'Random fits of rage (+damage, −AC)' },
  screamer:     { n: 'Screaming',     good: 0, d: 'Screams wake the whole floor' },
  slowheal:     { n: 'Slow Healing',  good: 0, d: '−40% regeneration' },
};
export const MUT_KEYS = Object.keys(MUTS);

/** a random mutation the hero doesn't have yet; goodOnly for demonspawn racial ones */
export function randomMut(h, rng, goodOnly) {
  const pool = MUT_KEYS.filter(k => !h.muts.includes(k) && (!goodOnly || MUTS[k].good));
  if (!pool.length) return null;
  return pool[Math.floor(rng() * pool.length)];
}
