/* Hero-power simulator: measures a single hero's COMBAT power (not account
   progression). Each class delves solo under an identical account, on shared
   seeds (CRN), until it wins the Orb or dies. We record how deep it reached, its
   final XL, kills and survival — a clean caster-vs-melee balance read.

   Usage:  bun tools/sim/power.mjs [sessions] [account]
     sessions : seeds per class (default 24)
     account  : 'maxed' (default) | 'mid' | 'fresh'
*/
import { makeState } from '../../src/core/state.js';
import { newHero } from '../../src/sim/hero.js';
import { startRun, advanceHeroes } from '../../src/sim/tick.js';
import { brDepth } from '../../src/data/branches.js';
import { CLASSES } from '../../src/data/classes.js';
import { NODES } from '../../src/data/memtree.js';
import { mulberry32 } from '../../src/core/rng.js';
import { setAffixDateProvider } from '../../src/data/affixes.js';

setAffixDateProvider(() => '2026-01-01'); // a fixed calm-ish day for every run

const CASTERS = ['wizard', 'conjurer', 'necromancer', 'fire_el', 'ice_el', 'summoner'];
const MELEE = ['fighter', 'berserker', 'gladiator', 'monk', 'hunter', 'assassin'];
const RACE = 'human'; // neutral race isolates the class
const RARITY = 2;

const SESSIONS = parseInt(process.argv[2] || '24', 10);
const ACCOUNT = process.argv[3] || 'maxed';

/* build an account of the chosen power tier (deterministic, no randomness) */
function buildAccount(seed) {
  const s = makeState();
  s.masterSeed = (0x1234567 ^ seed) >>> 0;
  s.seq = {};
  if (ACCOUNT !== 'fresh') {
    for (const n of NODES) if (!n.keystone) s.tree[n.id] = n.max;
    for (const n of NODES) if (n.keystone && n.id !== 'k_ngplus') s.tree[n.id] = 1;
  }
  if (ACCOUNT === 'maxed' || ACCOUNT === 'stress') {
    s.pupg = { p_dmg: 10, p_hp: 10, p_legacy: 40 };
    s.zupg = { zatk: 10, zhp: 10 };
  }
  if (ACCOUNT === 'stress') {
    /* strong heroes vs brutal monsters: they reach high XL (casters get their
       spells) then die at varying deep depths — a LATE-power discriminator */
    s.stat.wins = 17; // in-cycle hardening 1.25^12 ≈ 15× monster stats
    s.cycBase = { wins: 0, runes: 0, uniq: 0, mem: 0 };
  }
  return s;
}

/* run one hero of `cls` on `seed` until it wins or dies (capped), return metrics */
function runHero(cls, seed) {
  const trueRandom = Math.random;
  Math.random = mulberry32(0x9e3779b9 ^ seed);
  const s = buildAccount(seed);
  if (ACCOUNT === 'maxed' || ACCOUNT === 'stress') s.stars[`${RACE}/${cls}`] = 5;
  const h = newHero(RACE, cls, RARITY, s);
  s.heroes.push(h);
  startRun(h, s);
  let maxDepth = 0, guard = 0;
  while (h.state === 'run' && guard++ < 400) {         // up to ~33h sim, cut on death/win
    advanceHeroes(s, 300, true);
    const d = brDepth(h);
    if (d > maxDepth) maxDepth = d;
  }
  Math.random = trueRandom;
  return { depth: maxDepth, xl: h.xl, kills: h.kills, turns: h.turn, won: h.state === 'victor', died: h.state === 'dead' };
}

function agg(classes) {
  const rows = [];
  for (const cls of classes) {
    const runs = [];
    for (let i = 0; i < SESSIONS; i++) runs.push(runHero(cls, i));
    const n = runs.length;
    const mean = k => runs.reduce((a, r) => a + r[k], 0) / n;
    rows.push({
      cls, style: CLASSES[cls].style,
      depth: mean('depth'), xl: mean('xl'), kills: mean('kills'),
      turns: Math.round(mean('turns')),
      winPct: Math.round(100 * runs.filter(r => r.won).length / n),
    });
  }
  return rows;
}

const rows = [...agg(CASTERS), ...agg(MELEE)];
console.log(`\nHERO POWER — account=${ACCOUNT}, race=${RACE}, n=${SESSIONS} seeds (CRN)\n`);
console.log('class        style   depth   XL   kills  turns  win%');
console.log('-------------------------------------------------------');
for (const r of rows)
  console.log(
    r.cls.padEnd(12),
    (r.style === 'magic' ? 'CAST' : 'melee').padEnd(6),
    r.depth.toFixed(1).padStart(5),
    r.xl.toFixed(1).padStart(5),
    r.kills.toFixed(0).padStart(6),
    String(r.turns).padStart(6),
    String(r.winPct).padStart(5),
  );
const grp = st => {
  const g = rows.filter(r => r.style === st);
  const m = k => (g.reduce((a, r) => a + r[k], 0) / g.length);
  return { depth: m('depth'), xl: m('xl'), kills: m('kills'), win: m('winPct') };
};
const c = grp('magic'), me = grp('melee');
console.log('-------------------------------------------------------');
console.log('CASTERS avg  depth %s  XL %s  kills %s  win%% %s', c.depth.toFixed(1), c.xl.toFixed(1), c.kills.toFixed(0), c.win.toFixed(0));
console.log('MELEE   avg  depth %s  XL %s  kills %s  win%% %s', me.depth.toFixed(1), me.xl.toFixed(1), me.kills.toFixed(0), me.win.toFixed(0));
console.log('caster/melee depth ratio: %s  (1.0 = parity)', (c.depth / me.depth).toFixed(2));
