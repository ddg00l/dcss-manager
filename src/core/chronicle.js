/* The Chronicle: evolving goals that change WHAT the player is playing for.
   Pure logic — the UI only renders what these functions return.

   Goal arcs, in the order they take over:
   survival → first Orb → prestige cycles → the Hall of the Great
   (win with every race and class, DCSS greatplayer style) → the runner arc
   (carry the Orb with 4/5/6 runes) → guild contracts (style challenges,
   rotating per cycle) → the endless Ziggurat record. */
import { RACES, RKEYS } from '../data/races.js';
import { CLASSES, CKEYS } from '../data/classes.js';
import { ngLevel, prestigeReq, cycleProgress } from './prestige.js';

/* ---------- Hall of the Great: distinct victorious races/classes ---------- */
export const greatRaces = s => Object.keys((s.vic && s.vic.races) || {});
export const greatClasses = s => Object.keys((s.vic && s.vic.classes) || {});
/** permanent account bonus: +1% damage and health per distinct race and class won */
export const greatMul = s => 1 + .01 * (greatRaces(s).length + greatClasses(s).length);
export function recordVictory(s, h) {
  s.vic = s.vic || { races: {}, classes: {} };
  s.vic.races[h.race] = (s.vic.races[h.race] || 0) + 1;
  s.vic.classes[h.cls] = (s.vic.classes[h.cls] || 0) + 1;
}

/* ---------- Runner arc: the best rune count carried to a victory ---------- */
export function recordRunnerWin(s, h) {
  const r = h.runes.length;
  s.cycRunnerBest = Math.max(s.cycRunnerBest || 0, r);
  s.stat.runnerBest = Math.max(s.stat.runnerBest || 0, r);
}
/** Legends multiplier for the cycle: greed pays — every rune past 3 on the best win */
export const runnerMul = s => 1 + .15 * Math.max(0, (s.cycRunnerBest || 0) - 3);

/* ---------- Guild contracts: a rotating style challenge per cycle ---------- */
export const CONTRACTS = [
  { k: 'naked', n: 'Contract: bare skin', d: 'Win with no body armour equipped', check: (s, h) => !h.gear.armour },
  { k: 'commons', n: 'Contract: common blood', d: 'Win with a common-rarity hero', check: (s, h) => h.rarity === 0 },
  { k: 'runner4', n: 'Contract: greedy delve', d: 'Win carrying at least 4 runes', check: (s, h) => h.runes.length >= 4 },
];
export const cycleContract = s => CONTRACTS[(s.prestiges || 0) % CONTRACTS.length];
export function checkContract(s, h) {
  if (s.cycContractDone) return 0;
  const c = cycleContract(s);
  if (!c.check(s, h)) return 0;
  s.cycContractDone = 1;
  s.stat.contracts = (s.stat.contracts || 0) + 1;
  const reward = 10 + 5 * ngLevel(s);
  s.legends = (s.legends || 0) + reward;
  return reward;
}

/* ---------- adaptive goal feed: the top open goals for the current stage ---------- */
export function chronicleGoals(s) {
  const out = [];
  const cyc = cycleProgress(s);
  if ((s.stat.wins || 0) === 0) {
    out.push({ k: 'first_orb', n: 'Carry the Orb of Zot out of Zot:5', p: '' });
  } else {
    const req = prestigeReq(s);
    if (cyc.wins < req)
      out.push({ k: 'prestige', n: 'Win {n} times this cycle to prestige', v: { n: req }, p: cyc.wins + '/' + req });
    const races = greatRaces(s), classes = greatClasses(s);
    if (races.length < RKEYS.length) {
      const next = RKEYS.find(r => !races.includes(r));
      out.push({ k: 'great_race', n: 'Hall of the Great: win with {x}', v: { x: RACES[next].n }, p: races.length + '/' + RKEYS.length, tr: true });
    }
    if (classes.length < CKEYS.length) {
      const next = CKEYS.find(c => !classes.includes(c));
      out.push({ k: 'great_class', n: 'Hall of the Great: win with {x}', v: { x: CLASSES[next].n }, p: classes.length + '/' + CKEYS.length, tr: true });
    }
    const rb = s.stat.runnerBest || 0;
    if (rb < 6)
      out.push({ k: 'runner', n: 'Carry the Orb with {n} runes in one delve', v: { n: Math.max(4, rb + 1) }, p: rb + '/6' });
    if (!s.cycContractDone) {
      const c = cycleContract(s);
      out.push({ k: 'contract', n: c.d, p: '' });
    }
    out.push({ k: 'zig', n: 'Ziggurat record: reach floor {n}', v: { n: (s.stat.zigBest || 0) + 5 }, p: String(s.stat.zigBest || 0) });
  }
  return out.slice(0, 3);
}

/* ---------- Nemeses: uniques that slew your heroes grow into personal foes ---------- */
export function nemesisLevel(s, uniqKey) {
  return (s.nemeses && s.nemeses[uniqKey]) || 0;
}
export function recordNemesisKill(s, uniqKey) {
  s.nemeses = s.nemeses || {};
  s.nemeses[uniqKey] = (s.nemeses[uniqKey] || 0) + 1;
}
/** revenge: slaying a nemesis pays its grudge level in Memory/gold and resets it */
export function avengeNemesis(s, uniqKey) {
  const lvl = nemesisLevel(s, uniqKey);
  if (lvl > 0) s.nemeses[uniqKey] = 0;
  return lvl;
}
