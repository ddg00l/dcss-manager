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

/** DCSS-style morgue screen: epitaph of the fallen hero. */
export function maybeShowDeath() {
  if (!save.pendingDeaths || !save.pendingDeaths.length) return;
  if ($('death').classList.contains('show')) return;
  const d = save.pendingDeaths.shift();
  persist();
  const box = $('deathBox');
  const mins = Math.round(d.turns / 84); // ~1.4 tps
  box.innerHTML =
    `<h2 style="color:var(--hp)">☠ ${d.name}${t(' has fallen')}</h2>` +
    `<div class="sheetHead" style="margin-top:10px">` +
    `<img src="${tileURL(RACES[d.race].t)}" alt="">` +
    `<div><div class="nm rar${d.rarity}">${t(RACES[d.race].n)} ${t(CLASSES[d.cls].n)} · ${t(RARN[d.rarity])}</div>` +
    `<div class="label">${t('slain by: ')}<b style="color:var(--hp)">${d.by}</b>${t(' on ')}<b>${d.at}</b></div>` +
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
    `<div class="kv"><span>${t('Combo shards')}</span><b>+${d.shards}</b></div>` +
    `<div class="kv"><span>${t('Delve gold')}</span><b style="color:var(--gold)">${fmt(d.gold)} 🜚</b></div>` +
    `<div class="kv"><span>${t('Wallet to treasury')}</span><b style="color:var(--gold)">+${fmt(d.wallet)} 🜚</b></div>` +
    `<div class="kv"><span>${t('Gear')}</span><b>${t('returned to armory')}</b></div>` +
    `<button id="deathClose" style="width:100%;margin-top:14px">${t('Honor their memory')}</button>`;
  $('death').classList.add('show');
  sfx.death();
  $('deathClose').onclick = () => {
    sfx.ui();
    $('death').classList.remove('show');
    window.__renderAll();
    maybeShowDeath(); // next epitaph if several died
  };
}
