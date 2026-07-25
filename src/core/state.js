import { defaultFtue, completedFtue, isVeteranSave } from './ftue.js';
import { WEP_BASES } from '../data/items.js';
import { CLASSES } from '../data/classes.js';
import { RACES } from '../data/races.js';

const SCHOOL_KEYS = ['short_blades', 'long_blades', 'axes', 'maces', 'polearms', 'staves', 'bows', 'crossbows'];
/* migration: old generic "weapon"/"ranged" skills move into the school of the hero's current weapon */
function migrateWeaponSkills(h) {
  if (!h.skills) return;
  for (const k of SCHOOL_KEYS) if (h.skills[k] === undefined) h.skills[k] = 0;
  if (h.skills.weapon === undefined && h.skills.ranged === undefined) return;
  const wb = h.gear && h.gear.weapon ? WEP_BASES.find(w => w.k === h.gear.weapon.base) : null;
  const cw = CLASSES[h.cls] && CLASSES[h.cls].wep ? WEP_BASES.find(w => w.k === CLASSES[h.cls].wep) : null;
  const mel = (wb && !wb.rng ? wb.school : null) || (cw && !cw.rng ? cw.school : null) || 'long_blades';
  const rgd = (wb && wb.rng ? wb.school : null) || (cw && cw.rng ? cw.school : null) || 'bows';
  if (h.skills.weapon) h.skills[mel] = Math.max(h.skills[mel], h.skills.weapon);
  if (h.skills.ranged) h.skills[rgd] = Math.max(h.skills[rgd], h.skills.ranged);
  delete h.skills.weapon;
  delete h.skills.ranged;
}

const SKEY = 'dcssmanager.save.v2';

export function makeState() {
  return {
    gold: 200, runes: 0, zot: 0, scrap: 0, rolls: 0, pity: 0,
    heroes: [], armory: [], nextId: 1,
    stars: {}, shards: {}, seen: {},
    upg: {}, zupg: {}, fame: [],
    mem: 0, tree: { root: 1 },
    stat: { kills: 0, deaths: 0, uniqKills: 0, forged: 0, dismantled: 0, memEarned: 0, bestXL: {} },
    runesTotal: 0, pendingDeaths: [], unrandsOwned: [],
    ftue: null,
    progress: { D: 0, Lair: 0, Orc: 0, Elf: 0, Vaults: 0, Depths: 0, Zot: 0, Abyss: 0 },
    last: Date.now(), muted: false, lang: 'en',
  };
}

export function loadState(storage) {
  const state = makeState();
  try {
    const raw = storage && storage.getItem(SKEY);
    if (raw) {
      const s = JSON.parse(raw);
      Object.assign(state, s, {
        upg: { ...(s.upg || {}) }, zupg: { ...(s.zupg || {}) },
        stars: { ...(s.stars || {}) }, shards: { ...(s.shards || {}) },
        seen: { ...(s.seen || {}) },
        progress: { ...state.progress, ...(s.progress || {}) },
        tree: { root: 1, ...(s.tree || {}) },
        stat: { ...state.stat, ...(s.stat || {}) },
      });
      /* FTUE: veterans with progress never see the tutorial */
      if (!state.ftue) {
        state.ftue = null; /* filled in below */
      }
      /* hero migration: pots → inventory, new fields */
      for (const h of state.heroes || []) {
        if (h.inv === undefined) { h.inv = { curing: h.pots || 2 }; delete h.pots; }
        h.known = h.known || []; h.muts = h.muts || []; h.status = h.status || {};
        h.gold = h.gold || 0; h.spend = h.spend || 'balanced'; h.keys = h.keys || 0;
        migrateWeaponSkills(h);
        /* draconians no longer wear body armour — any equipped piece goes to the armory */
        if (RACES[h.race] && RACES[h.race].noarm && h.gear && h.gear.armour) {
          state.armory.push(h.gear.armour);
          h.gear.armour = null;
        }
        if (h.gear && h.gear.ring3 === undefined) h.gear.ring3 = null;
        if (h.map) { h.map.traps = h.map.traps || []; h.map.clouds = h.map.clouds || []; }
      }
      /* migration: old CIFI upgrades convert into Memory */
      if (s.upg && Object.keys(s.upg).length) {
        const total = Object.values(s.upg).reduce((a, b) => a + b, 0);
        state.mem += total * 40;
        state.upg = {};
      }
    }
  } catch (e) { /* corrupted save — start fresh */ }
  if (!state.ftue) {
    state.ftue = isVeteranSave(state) ? completedFtue() : defaultFtue();
  }
  return state;
}

export function persistState(state, storage) {
  state.last = Date.now();
  try { storage && storage.setItem(SKEY, JSON.stringify(state)); } catch (e) { /* quota */ }
}

/* app-level singleton (UI uses this; sim/tests get state passed explicitly) */
const storage = typeof localStorage !== 'undefined' ? localStorage : null;
export const save = loadState(storage);
export const persist = () => persistState(save, storage);
