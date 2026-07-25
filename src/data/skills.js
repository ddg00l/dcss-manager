/* DCSS-style weapon skill schools: crosstraining and min-delay attack speed. */

export const WEP_SCHOOLS = ['short_blades', 'long_blades', 'axes', 'maces', 'polearms', 'staves', 'bows', 'crossbows', 'unarmed'];

/* crosstraining as in DCSS: related schools support each other */
export const CROSS = {
  short_blades: ['long_blades'],
  long_blades: ['short_blades'],
  axes: ['maces', 'polearms'],
  maces: ['axes', 'staves'],
  polearms: ['axes', 'staves'],
  staves: ['maces', 'polearms'],
};

/** effective combat skill of a school: own + a quarter of the best related school's excess */
export function effSkill(h, school) {
  const own = h.skills[school] || 0;
  let best = 0;
  for (const r of CROSS[school] || []) best = Math.max(best, h.skills[r] || 0);
  return own + Math.max(0, best - own) * .25;
}

/** training multiplier from crosstraining: a higher related school means faster learning */
export function crossBoost(h, school) {
  const own = h.skills[school] || 0;
  for (const r of CROSS[school] || []) if ((h.skills[r] || 0) > own) return 1.4;
  return 1;
}

/** DCSS min delay: attack speed grows with skill up to the weapon's limit (mds = skill for full speed) */
export function speedMul(skill, mds) {
  return .6 + .4 * Math.min(1, skill / (mds || 8));
}
