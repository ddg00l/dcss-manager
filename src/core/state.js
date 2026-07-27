import { defaultFtue, completedFtue, isVeteranSave } from './ftue.js';
import { ASCEND_GATE } from './ascension.js';
import { stream, hashSeed } from './rng.js';
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
    gold: 200, runes: 0, zot: 0, scrap: 0, rolls: 0, forges: 0, pity: 0,
    heroes: [], armory: [], nextId: 1,
    stars: {}, shards: {}, seen: {},
    upg: {}, zupg: {}, fame: [],
    mem: 0, tree: { root: 1 },
    stat: { kills: 0, deaths: 0, uniqKills: 0, forged: 0, dismantled: 0, memEarned: 0, wins: 0, bestXL: {} },
    runesTotal: 0, pendingDeaths: [], pendingWins: [], unrandsOwned: [],
    ng: 0, legends: 0, prestiges: 0, prestigesTotal: 0, pupg: {}, balV: 5,
    ascendancy: 0, ascBase: 0, ascensions: 0, ascUpg: {}, /* Ascension meta-layer */
    prestReq: 1, /* Orbs the current cycle needs to prestige; snapshotted at cycle start, never rises mid-cycle */
    vic: { races: {}, classes: {} }, nemeses: {}, cycRunnerBest: 0, cycContractDone: 0,
    pantheon: {}, /* eternal: godKey → lifetime Orbs won while pledged (Pantheon favor) */
    bestiary: {}, /* eternal: monster kind → lifetime kills (Bestiary codex) */
    cycBase: { wins: 0, runes: 0, uniq: 0, mem: 0 }, cycRunes: [],
    cofferBuys: 0, zigFunded: 0, provisions: {}, /* per-cycle gold sinks; reset at prestige */
    ftue: null,
    progress: { D: 0, Lair: 0, Orc: 0, Elf: 0, Vaults: 0, Depths: 0, Zot: 0, Abyss: 0 },
    last: Date.now(), muted: false, lang: 'en',
    /* master seed: every gameplay random derives from this via domain streams;
       synced forever, identical on all of the player's devices */
    masterSeed: (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1,
    seq: {}, /* per-domain monotonic counters (gacha, loot, forge) */
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
        pupg: { ...(s.pupg || {}) }, ascUpg: { ...(s.ascUpg || {}) },
        vic: { races: { ...((s.vic || {}).races || {}) }, classes: { ...((s.vic || {}).classes || {}) } },
        nemeses: { ...(s.nemeses || {}) },
        pantheon: { ...(s.pantheon || {}) }, bestiary: { ...(s.bestiary || {}) },
        cycBase: { ...state.cycBase, ...(s.cycBase || {}) },
        provisions: { ...(s.provisions || {}) },
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
        if (h.gear) for (let i = 3; i <= 8; i++) if (h.gear['ring' + i] === undefined) h.gear['ring' + i] = null;
        if (h.map) { h.map.traps = h.map.traps || []; h.map.clouds = h.map.clouds || []; }
      }
      /* old saves: derive lifetime wins from the Hall of Fame */
      if (s.stat && s.stat.wins === undefined)
        state.stat.wins = (s.fame || []).filter(f => f.won).length;
      /* one-time graceful migration to the prestige-era balance (balV 2).
         Veterans of the rune-inflation era keep what they built, but:
         - past feats convert into a single compressed Legends grant (capped)
           instead of fueling one colossal first prestige;
         - the cycle snapshot starts from their current lifetime stats, so
           prestige requires a NEW victory;
         - the dark-summon rune stockpile is capped, the guild sells the
           excess for gold (same rate as duplicate runes). */
      if (s.balV === undefined) {
        const wins = state.stat.wins || 0;
        const grant = Math.min(400, Math.round(
          wins * 4 + Math.sqrt(state.runesTotal || 0) * 8 + Math.sqrt((state.stat.memEarned || 0) / 50)));
        if (grant > 0 && (wins > 0 || (state.runesTotal || 0) > 0)) state.legends = (state.legends || 0) + grant;
        state.cycBase = {
          wins, runes: state.runesTotal || 0,
          uniq: state.stat.uniqKills || 0, mem: state.stat.memEarned || 0,
        };
        if ((state.runes || 0) > 40) {
          state.gold += (state.runes - 40) * 800;
          state.runes = 40;
        }
        /* bought elite levels keep their paid-for power: the per-level effect
           was halved (+20%→+10%, gold +20%→+15%), so levels are recomputed —
           the doubled levels land above the prestige cap, which then throttles
           further purchases exactly as the new curve intends */
        const zscale = { zatk: [2, 20], zhp: [2, 20], zloot: [4 / 3, 15] };
        for (const k in zscale) {
          if (state.zupg[k]) {
            const [m, cap] = zscale[k];
            state.zupg[k] = Math.min(cap, Math.ceil(state.zupg[k] * m));
          }
        }
      }
      /* veterans: seed the Hall of the Great from recorded Hall of Fame wins */
      if (s.vic === undefined)
        for (const f of (s.fame || []))
          if (f.won && f.race && f.cls) {
            state.vic.races[f.race] = (state.vic.races[f.race] || 0) + 1;
            state.vic.classes[f.cls] = (state.vic.classes[f.cls] || 0) + 1;
          }
      /* balV 3: the prestige requirement is now a snapshot (state.prestReq) taken
         at cycle start instead of a live readiness formula, so it can never rise
         under a delver mid-cycle. Migrated saves inherit the default prestReq 1
         (one easy prestige, then the ratchet takes over) — safe, never freezes. */
      /* balV 4: eternal Pantheon (wins-per-god favor) and Bestiary (kills-per-
         monster) trackers. They start empty for veterans — favor and codex
         accrue from here on; no backfill is possible since neither per-god wins
         nor per-type kills were ever recorded. The merge above guarantees the
         fields exist so nothing reads undefined. */
      /* balV 5: prestigesTotal — lifetime prestige count that Ascension does not
         reset, so the endgame gate (Pantheon/Bestiary) stops switching itself off
         on every Ascension. Veterans inherit at least their current cycle's count;
         ascensions before this migration cannot be recovered, so an already-
         ascended account gets credit for what it can prove. */
      if (s.prestigesTotal === undefined)
        state.prestigesTotal = (s.prestiges || 0) + ASCEND_GATE * (s.ascensions || 0);
      state.balV = 5;
      pruneSave(state); /* shrink pre-existing bloated saves (accumulated dead heroes) */
      if (s.masterSeed === undefined) {
        /* derive a stable seed from immutable account facts so it never shifts */
        state.masterSeed = (hashSeed(s.nextId || 1, (s.fame || []).length, s.mem || 0) || 1) >>> 0;
        state.seq = {};
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

/* Dead and victorious heroes are fully recorded in the Hall of Fame and the
   morgue (pendingDeaths); keeping their objects in state.heroes only bloats the
   save unboundedly (each carries an 80-line log) and eventually blows the
   Firestore 1 MB field limit. Prune them — only living delvers stay on the
   roster. */
export function pruneSave(state) {
  delete state._treeSig; delete state._treeDirty; // transient cache, never persisted
  if (state.heroes) state.heroes = state.heroes.filter(h => h.state === 'run' || h.state === 'camp');
  if (state.fame && state.fame.length > 20) state.fame.length = 20; // keep the last 20
}

export function persistState(state, storage) {
  state.last = Date.now();
  pruneSave(state);
  try { storage && storage.setItem(SKEY, JSON.stringify(state)); } catch (e) { /* quota */ }
}

/* app-level singleton (UI uses this; sim/tests get state passed explicitly) */
const storage = typeof localStorage !== 'undefined' ? localStorage : null;
export const save = loadState(storage);
export const persist = () => persistState(save, storage);

/** Wipe local storage and reset the live save singleton to a fresh account.
   Keeps object identity (imported `save` reference stays valid) by mutating it. */
export function resetSave() {
  try { storage && storage.removeItem(SKEY); } catch (e) { /* quota */ }
  for (const k of Object.keys(save)) delete save[k];
  Object.assign(save, makeState());
  save.ftue = defaultFtue(); /* a fresh account is a newcomer: replay the rail + tab tours */
  persistState(save, storage);
}
