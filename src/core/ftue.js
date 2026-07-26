/* FTUE: pure logic for tutorial stages and tab unlocks (no DOM). */

export function defaultFtue() {
  return { railDone: false, sawMap: false, sawLog: false, sawSheet: false, tours: {} };
}
export function completedFtue() {
  return {
    railDone: true, sawMap: true, sawLog: true, sawSheet: true,
    tours: { pDun: 1, pHeroes: 1, pForge: 1, pUpg: 1, pFame: 1, equip: 1 },
  };
}
/** an account with any progress is a veteran — don't show the tutorial */
export function isVeteranSave(s) {
  return (s.heroes && s.heroes.length > 0) || s.rolls > 0 ||
    (s.stat && (s.stat.kills > 0 || s.stat.deaths > 0)) || s.fame.length > 0;
}

/** stages of the mandatory rail:
   0 summon a hero · 1 send into the dungeon · 2 map · 3 log · 4 status button · 99 done */
export function railStage(s) {
  const f = s.ftue;
  if (!f || f.railDone) return 99;
  if (!s.heroes.length) return 0;
  if (!s.heroes.some(h => h.state === 'run')) return 1;
  if (!f.sawMap) return 2;
  if (!f.sawLog) return 3;
  if (!f.sawSheet) return 4;
  return 99;
}

/** tab unlock triggers (hard gating until the event) */
export const TAB_UNLOCK = {
  pHeroes: () => true,
  pDun: s => railStage(s) >= 2,
  pForge: s => s.armory.length > 0 || s.scrap > 0 || s.stat.forged > 0,
  pUpg: s => s.stat.deaths > 0,                          // Memory is born from the first death
  pFame: s => s.stat.deaths > 0 || s.runesTotal > 0,
};
/* what the player must do to unlock each gated tab — shown on a locked-tab click */
export const TAB_HINT = {
  pDun: 'Send a hero into the Dungeon to watch the delve',
  pForge: 'Find loot or forge an item to open the Forge',
  pUpg: 'A hero must fall — Memory is born from the first death',
  pFame: 'Win the Orb or lose a hero to open the Hall of Fame',
};
export const tabUnlocked = (s, p) => (s.ftue && s.ftue.railDone && p !== 'pDun' && p !== 'pHeroes')
  ? (TAB_UNLOCK[p] ? TAB_UNLOCK[p](s) : true)
  : (TAB_UNLOCK[p] ? TAB_UNLOCK[p](s) : true);
export const darkSummonUnlocked = s => s.runesTotal > 0;

/* The Fame pane is split into sub-tabs, ordered by progression; the Hall of Fame
   sits last because it is a record, not a goal. Each carries an unlock predicate
   and a locked-click hint, exactly like the main nav. */
export const FAME_SUBTABS = [
  { id: 'fsChronicle', box: 'fameChronicle', ico: '📜', label: 'Chronicle',   unlock: () => true },
  { id: 'fsPrestige',  box: 'famePrestige',  ico: '⚜',  label: 'Prestige',    unlock: s => (s.stat.wins || 0) > 0, hint: 'Carry the Orb out of Zot to begin prestiging' },
  { id: 'fsPantheon',  box: 'famePantheon',  ico: '✧',  label: 'Pantheon',    unlock: s => (s.prestiges || 0) > 0, hint: 'Reach your first prestige to open the Pantheon' },
  { id: 'fsBestiary',  box: 'fameBestiary',  ico: '🐺', label: 'Bestiary',    unlock: s => (s.prestiges || 0) > 0, hint: 'Reach your first prestige to open the Bestiary' },
  { id: 'fsHall',      box: 'fameHall',       ico: '🏆', label: 'Hall of Fame', unlock: () => true },
];
export const fameSubUnlocked = (s, id) => {
  const st = FAME_SUBTABS.find(x => x.id === id);
  return st ? st.unlock(s) : true;
};
