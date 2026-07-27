import { $ } from './dom.js';
import { save, persist } from '../core/state.js';
import { fmt } from '../core/fmt.js';
import { sfx } from './audio.js';
import { tileURL } from '../data/tiles.js';
import { RACES } from '../data/races.js';
import { CLASSES } from '../data/classes.js';
import { GODS } from '../data/gods.js';
import { MUTS } from '../data/mutations.js';
import { RARN } from '../data/combos.js';
import { t } from '../i18n/index.js';

/** Triumph screen: the victor who carried the Orb of Zot out — mirror of the morgue. */
export function maybeShowWin() {
  if (!save.pendingWins || !save.pendingWins.length) return;
  if ($('win').classList.contains('show')) return;
  if ($('death').classList.contains('show')) return; /* let the morgue clear first */
  const d = save.pendingWins.shift();
  persist();
  const box = $('winBox');
  const mins = Math.round(d.turns / 84); // ~1.4 tps
  box.innerHTML =
    `<h2 style="color:var(--gold)">🏆 ${d.name}${t(' claims the Orb of Zot!')}</h2>` +
    `<div class="sheetHead" style="margin-top:10px">` +
    `<img src="${tileURL('i_orb')}" alt="">` +
    `<div><div class="nm rar${d.rarity}">${t(RACES[d.race].n)} ${t(CLASSES[d.cls].n)} · ${t(RARN[d.rarity])}</div>` +
    `<div class="label">${t('carried the Orb from ')}<b style="color:var(--rare)">Zot:5</b></div>` +
    `<div class="label">XL ${d.xl} · ${d.kills}${t(' kills · ')}${d.turns}${t(' turns (~')}${mins}${t(' min)')}` +
    (d.god ? ` · ✧${t(GODS[d.god].n)}` : '') + `</div></div></div>` +

    `<h3>${t("The seeker's path")}</h3>` +
    `<div class="morgueLog">` +
    d.log.map(e => `<div class="lg-${e.cls}"><span class="t">[${e.t}]</span>${e.txt}</div>`).join('') +
    `</div>` +
    (d.notable.length ? `<h3>${t('Milestones')}</h3><div class="meta" style="line-height:1.8">` +
      d.notable.map(n => '· ' + n).join('<br>') + `</div>` : '') +
    (d.runes.length ? `<div class="meta" style="color:var(--rare);margin-top:6px">${t('ᚱ Runes: ')}${d.runes.map(r => t(r)).join(', ')}</div>` : '') +
    (d.muts.length ? `<div class="meta" style="margin-top:6px">🧬 ${d.muts.map(m => t(MUTS[m].n)).join(', ')}</div>` : '') +

    `<h3>${t('Legacy')}</h3>` +
    (d.essence > 0
      ? `<div class="kv"><span>${t('Zot essence won')}</span><b style="color:var(--epic)">+${d.essence} ⚛</b></div>`
      : `<div class="kv"><span>${t('Zot essence')}</span><b class="label">${t('only the first Orb of the cycle pays essence')}</b></div>`) +
    `<div class="kv"><span>${t('Memory gained')}</span><b style="color:var(--gold)">+${fmt(d.mem)} 🕯</b></div>` +
    `<div class="kv"><span>${t('Wallet to treasury')}</span><b style="color:var(--gold)">+${fmt(d.wallet)} 🜚</b></div>` +
    `<div class="kv"><span>${t('Gear')}</span><b>${t('returned to armory')}</b></div>` +
    `<button id="winClose" style="width:100%;margin-top:14px">${t('A legend forever')}</button>`;
  $('win').classList.add('show');
  sfx.win();
  $('winClose').onclick = () => {
    sfx.ui();
    $('win').classList.remove('show');
    window.__renderAll();
    maybeShowWin(); // next triumph if several won
  };
}
