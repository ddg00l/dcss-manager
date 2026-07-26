import './style.css';
import { $ } from './ui/dom.js';
import { save, persist } from './core/state.js';
import { fmt } from './core/fmt.js';
import { sfx } from './ui/audio.js';
import { maxSlots, rollCost } from './core/economy.js';
import { memHas } from './data/memtree.js';
import { newHero } from './sim/hero.js';
import { startRun, advanceHeroes, simHooks } from './sim/tick.js';
import { doRoll, renderGacha } from './ui/gacha.js';
import { renderHeroes } from './ui/heroes.js';
import { renderForge } from './ui/forge.js';
import { openEquip } from './ui/equip.js';
import { renderFame } from './ui/upgrades.js';
import { renderMemTree, centerMemTree } from './ui/memtree.js';
import { renderChips, renderWatch, setWatch } from './ui/watch.js';
import { openSheet } from './ui/sheet.js';
import { showOfflineReport } from './ui/offline.js';
import { maybeShowDeath } from './ui/death.js';
import { ftueTick, updateGates, maybeTour } from './ui/ftue.js';
import { tabUnlocked } from './core/ftue.js';
import { setLang, applyStatic, DEFAULT_LANG } from './i18n/index.js';
import { openSettings } from './ui/settings.js';
import { canPrestige } from './core/prestige.js';
import './ui/update.js';
import { initCloud, startAutoSync, cloudPush, cloudAvailable } from './cloud/index.js';
import { openConflict } from './ui/conflict.js';
import { setCloudMsg } from './ui/settings.js';
import { maybeCloudBanner, resetCloudBanner } from './ui/cloudbanner.js';

/* cross-module UI callbacks (avoids circular imports) */
window.__renderAll = renderAll;
window.__save = save; /* debugging/cheat access from the console */
window.__setWatch = id => { setWatch(id); switchPane('pDun'); };
window.__openEquip = openEquip;
window.__openSheet = openSheet;

simHooks.onDeath = () => sfx.death();
simHooks.onWin = () => sfx.win();

/* tabs */
function switchPane(p, silent) {
  if (!tabUnlocked(save, p)) return;
  document.querySelectorAll('#nav .tb').forEach(x => x.classList.toggle('active', x.dataset.p === p));
  document.querySelectorAll('.pane').forEach(x => x.classList.toggle('active', x.id === p));
  renderAll();
  if (p === 'pUpg') centerMemTree(); /* Memory always opens centered on the tree */
  if (!silent) maybeTour(p);
  /* the prestige coachmark waits until the pane tour is done and a victory unlocks it */
  if (!silent && p === 'pFame' && save.ftue.tours.pFame && canPrestige(save)) maybeTour('prestige');
}
document.querySelectorAll('#nav .tb').forEach(b => {
  b.onclick = () => { sfx.ui(); switchPane(b.dataset.p); };
});
$('btnSettings').onclick = () => { sfx.ui(); openSettings(); };
$('btnRoll1').onclick = () => doRoll(false);
$('btnRollRune').onclick = () => doRoll(true);

function updTop() {
  $('goldTxt').textContent = fmt(save.gold) + ' 🜚';
  $('memTxt').textContent = fmt(save.mem) + ' 🕯';
  $('runeTxt').textContent = save.runes + ' ᚱ';
  $('scrapTxt').textContent = save.scrap + ' ⚙';
  const z = $('zotTxt');
  if (save.zot > 0 || save.fame.some(f => f.won)) { z.style.display = ''; z.textContent = save.zot + ' ⚛'; }
}
function renderAll() {
  renderChips(); renderHeroes(); renderGacha(); renderForge(); renderMemTree(); renderFame(); updTop();
}

/* main loop.
   The sim runs on a real-time clock (Date.now), not on rAF deltas: rAF stops in
   background tabs, so elapsed hidden time must be caught up, not thrown away. */
let last = 0;
let lastSim = Date.now();
function simCatchUp() {
  const now = Date.now();
  const dt = (now - lastSim) / 1000;
  lastSim = now;
  if (dt > 0) advanceHeroes(save, dt, dt > 2); // big chunks run in silent mode
  return dt;
}
function frame(ts) {
  requestAnimationFrame(frame);
  const t = ts / 1000;
  const dt = Math.min(t - last, .25); last = t;
  simCatchUp();
  if (document.querySelector('#pDun.active')) renderWatch();
  maybeShowDeath();
  ftueTick(switchPane);
  updTop();
}
setInterval(() => {
  /* in a throttled background tab this still fires ~once a minute and keeps
     the sim advancing, so tab switches never freeze the game */
  simCatchUp();
  persist();
  const act = document.querySelector('.pane.active');
  if (act && act.id !== 'pDun') renderAll();
  else renderChips();
}, 4000);

/* returning to a hard-frozen tab (browsers can suspend timers entirely):
   short gaps are simulated silently, long ones get the expedition report */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') { persist(); return; }
  const gap = (Date.now() - lastSim) / 1000;
  if (gap > 180) {
    lastSim = Date.now();
    showOfflineReport();
  } else {
    simCatchUp();
  }
  renderAll();
});

/* cloud sync: adopt remote saves, surface disputes, push on milestones */
window.__cloudPush = m => cloudPush(() => save, m); /* called by heroWin/doPrestige via UI */
const applyRemote = st => { Object.assign(save, st); persist(); renderAll(); };
initCloud({
  onConflict: openConflict,
  onStatus: (k) => {
    setCloudMsg(k === 'error' ? 'Sync error' : k === 'synced' ? 'Synced' : k);
    if (k === 'expired') maybeCloudBanner(() => save, applyRemote);
    if (k === 'synced') resetCloudBanner();
  },
});
if (cloudAvailable()) startAutoSync(() => save, applyRemote);

setLang(save.lang || DEFAULT_LANG);
applyStatic();
showOfflineReport();
if (!save.ftue.railDone) switchPane('pHeroes', true);
updateGates();
renderAll();
requestAnimationFrame(frame);
