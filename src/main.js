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

/* cross-module UI callbacks (avoids circular imports) */
window.__renderAll = renderAll;
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

/* main loop */
let last = 0, autoT = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const t = ts / 1000;
  const dt = Math.min(t - last, .25); last = t;
  advanceHeroes(save, dt, false);
  if (document.querySelector('#pDun.active')) renderWatch();
  maybeShowDeath();
  ftueTick(switchPane);
  /* "Auto-summon" keystone */
  autoT += dt;
  if (autoT > 3) {
    autoT = 0;
    if (memHas(save, 'k_autosummon') &&
        save.heroes.filter(x => x.state === 'run').length < maxSlots(save)) {
      const idle = save.heroes.find(x => x.state === 'camp' && !x.rest);
      if (idle) startRun(idle, save);
      else if (save.gold >= 2 * rollCost(save)) doRoll(false);
    }
  }
  updTop();
}
setInterval(() => {
  persist();
  const act = document.querySelector('.pane.active');
  if (act && act.id !== 'pDun') renderAll();
  else renderChips();
}, 4000);

setLang(save.lang || DEFAULT_LANG);
applyStatic();
showOfflineReport();
if (!save.ftue.railDone) switchPane('pHeroes', true);
updateGates();
renderAll();
requestAnimationFrame(frame);
