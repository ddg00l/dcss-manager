import { $ } from './dom.js';
import { save, persist } from '../core/state.js';
import { fmt } from '../core/fmt.js';
import { sfx } from './audio.js';
import { RACES } from '../data/races.js';
import { CLASSES } from '../data/classes.js';
import { computeOffline } from '../sim/tick.js';
import { t } from '../i18n/index.js';

export function showOfflineReport() {
  const rep = computeOffline(save);
  if (!rep) return;
  const hh = Math.floor(rep.mins / 60), mm = Math.floor(rep.mins % 60);
  $('offTime').textContent = t('while you were away — ') + (hh > 0 ? hh + t('h ') : '') + mm + t('m');
  const html = [];
  for (const e of rep.entries) {
    const h = e.hero;
    html.push('<b>' + h.name + '</b> (' + t(RACES[h.race].n) + '-' + t(CLASSES[h.cls].n) + ') — ' +
      (e.state === 'run' ? (t('delving: ') + e.at) : e.state === 'dead' ? t('died') : e.state === 'victor' ? t('VICTOR') : t('in camp')));
    html.push(t('kills: ') + e.rep.kills + t(' · floors: ') + e.rep.floors + t(' · gold: ') + fmt(e.rep.gold));
    for (const nt of e.rep.notable.slice(0, 8)) html.push('· ' + nt);
    html.push('<div class="hr"></div>');
  }
  html.push('<b style="color:var(--gold)">' + t('Total gold: +') + fmt(rep.goldGained) + '</b>');
  $('offBody').innerHTML = html.join('<br>');
  save.pendingDeaths = [];
  $('offline').classList.add('show');
  persist();
}
$('btnOff').onclick = () => { sfx.ui(); $('offline').classList.remove('show'); window.__renderAll(); };
