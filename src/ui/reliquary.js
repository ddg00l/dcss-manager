/* The reliquary: what the guild carries through a prestige.

   A prestige used to be a loss the player found out about afterwards -- only named
   artefacts survived, so a randart won in cycle two burned with the rest of the armoury
   and nothing said so beforehand. The cost of a prestige is worth keeping; what was
   worth changing is that it arrived as a surprise rather than as a decision.

   So the prestige goes through here first. Everything the guild owns is laid out, worn
   pieces included, and the player fills the reliquary. What is not chosen is shown
   burning, in the same list, at the same moment -- the price and the choice in one
   view rather than a number in a confirm box. */
import { $ } from './dom.js';
import { save, persist } from '../core/state.js';
import { t } from '../i18n/index.js';
import { itemName, itemInfo } from '../data/items.js';
import { reliquaryCap, doPrestige, legendsReward } from '../core/prestige.js';
import { ascKeepGear } from '../core/ascension.js';
import { sfx } from './audio.js';

/** Every piece the guild owns: the armoury plus what its seekers are wearing. */
function allGear() {
  const worn = [];
  for (const h of save.heroes || [])
    for (const slot of Object.keys(h.gear || {}))
      if (h.gear[slot]) worn.push({ it: h.gear[slot], by: h.name });
  return [...(save.armory || []).map(it => ({ it, by: null })), ...worn];
}

/* rarity first, then artefacts, so the pieces worth arguing over sit at the top */
const worth = it => (it.unrandId ? 100 : 0) + (it.rand ? 10 : 0) + (it.rar || 0);

export function openReliquary(after) {
  const cap = reliquaryCap(save);
  const keepAll = ascKeepGear(save);
  const gear = allGear().sort((a, b) => worth(b.it) - worth(a.it));
  const chosen = new Set();

  const render = () => {
    const box = $('reliquaryBox');
    const burning = gear.filter(g => !keepAll && !g.it.unrandId && !chosen.has(g.it.id)).length;
    box.innerHTML =
      '<h2>' + t('The reliquary') + '</h2>' +
      '<div class="label">' + t('Choose what the guild carries through the prestige.') + '</div>' +
      '<div class="ds" style="margin:8px 0 10px">' +
      (keepAll ? t('Engraved Armoury: everything survives this prestige.')
        : cap > 0
          ? t('Room for {n}, and named artefacts always come along.').replace('{n}', cap)
          : t('No reliquary yet — only named artefacts survive. Buy one with Legends below.')) +
      '</div>' +
      '<div class="label" style="color:var(--bad)">' + t('Burning: ') + burning + '</div>' +
      '<div id="relicList" class="relicList"></div>';

    const list = $('relicList');
    for (const g of gear) {
      const it = g.it;
      const safe = keepAll || !!it.unrandId;
      const on = chosen.has(it.id);
      const row = document.createElement('div');
      row.className = 'relicRow' + (safe ? ' safe' : on ? ' kept' : ' burn');
      row.innerHTML =
        '<div class="nm">' + itemName(it) + '</div>' +
        '<div class="ds">' + itemInfo(it) + (g.by ? ' · ' + t('worn by ') + g.by : '') + '</div>' +
        '<div class="label">' + (safe ? t('artefact — always kept')
          : on ? t('in the reliquary') : t('burns')) + '</div>';
      if (!safe && cap > 0) row.onclick = () => {
        if (chosen.has(it.id)) chosen.delete(it.id);
        else if (chosen.size < cap) chosen.add(it.id);
        else return; /* full: say nothing, the counter above already says why */
        sfx.ui(); render();
      };
      list.appendChild(row);
    }

    const go = document.createElement('button');
    go.className = 'blue';
    go.style.cssText = 'width:100%;margin-top:14px';
    go.textContent = t('Prestige now: +') + legendsReward(save) + ' ⚜' +
      (cap > 0 ? ' · ' + t('carrying ') + chosen.size + '/' + cap : '');
    go.onclick = () => {
      doPrestige(save, [...chosen]);
      sfx.win(); persist();
      $('reliquary').classList.remove('show');
      if (after) after();
    };
    box.appendChild(go);

    const cancel = document.createElement('button');
    cancel.style.cssText = 'width:100%;margin-top:8px';
    cancel.textContent = t('Not yet');
    cancel.onclick = () => { sfx.ui(); $('reliquary').classList.remove('show'); };
    box.appendChild(cancel);
  };

  render();
  $('reliquary').classList.add('show');
}

$('reliquary').addEventListener('click', e => {
  if (e.target.id === 'reliquary') $('reliquary').classList.remove('show');
});
