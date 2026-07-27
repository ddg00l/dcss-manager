import { $ } from './dom.js';
import { save, persist } from '../core/state.js';
import { sfx } from './audio.js';
import { tileURL } from '../data/tiles.js';
import { t } from '../i18n/index.js';
import {
  ASC_NODES, ASC_REGIONS, ASCEND_GATE, ascendancy, ascLevel, ascGain, canAscend,
  ascensionUnlocked, ascNodeById, ascNodeLvl, ascNodeCost, ascCanBuy, buyAscNode, doAscension, ascHas,
} from '../core/ascension.js';

const rerender = () => { persist(); if (window.__renderAll) window.__renderAll(); };

export function renderAscension() {
  const box = $('ascensionBox');
  if (!box) return;
  box.innerHTML = '';

  /* header + balance */
  const head = document.createElement('div');
  head.className = 'card';
  head.innerHTML =
    '<div class="nm" style="color:#e0c05a">✦ ' + t('Ascension') + '</div>' +
    '<div class="meta" style="font-size:10px;line-height:1.55;color:var(--dim)">' +
    t('Ascend to shed the entire prestige layer — prestiges, Legends, the Memory tree, Zot upgrades, gold and heroes all burn away — for Ascendancy ✦ and its tree of game-changing powers. Your Collection (stars, artefacts, halls, Pantheon, Bestiary) endures.') + '</div>' +
    '<div class="kv"><span>' + t('Ascendancy') + '</span><b style="color:#e0c05a">' + ascendancy(save) + ' ✦</b></div>' +
    '<div class="kv"><span>' + t('Ascensions') + '</span><b>' + ascLevel(save) + '</b></div>';
  box.appendChild(head);

  /* the ascend action */
  const gain = ascGain(save);
  const act = document.createElement('div');
  act.className = 'card';
  if (!ascensionUnlocked(save)) {
    act.innerHTML = '<div class="ds">' + t('Reach {n} prestiges to unlock Ascension — {x} so far.', { n: ASCEND_GATE, x: save.prestiges || 0 }) + '</div>';
  } else {
    act.innerHTML = '<div class="kv"><span>' + t('Ascend now for') + '</span><b style="color:#e0c05a">+' + gain + ' ✦</b></div>';
    const b = document.createElement('button');
    b.className = 'purple';
    b.style.cssText = 'width:100%;margin-top:8px';
    b.textContent = '✦ ' + t('ASCEND');
    b.disabled = !canAscend(save);
    b.onclick = () => {
      if (!confirm(t('Ascend? This burns the ENTIRE prestige layer (prestiges, Legends, Memory tree, Zot upgrades, gold, heroes) for +{g} ✦. The Collection is kept.', { g: gain }))) return;
      if (doAscension(save)) { sfx.leg(); rerender(); }
    };
    act.appendChild(b);
  }
  box.appendChild(act);

  /* the tree, grouped by flavour */
  for (const [fam, reg] of Object.entries(ASC_REGIONS)) {
    const nodes = ASC_NODES.filter(n => n.fam === fam);
    if (!nodes.length) continue;
    const h = document.createElement('h3');
    h.textContent = t(reg.n);
    h.style.color = reg.col;
    box.appendChild(h);
    for (const n of nodes) {
      const lvl = ascNodeLvl(save, n.id), maxed = lvl >= n.max, cost = ascNodeCost(save, n);
      const locked = n.req.length && !n.req.every(r => ascHas(save, r));
      const el = document.createElement('div');
      el.className = 'itemRow';
      el.style.opacity = locked ? '.5' : '1';
      el.innerHTML = '<img src="' + tileURL(n.icon) + '">' +
        '<div class="tInfo"><span style="color:' + reg.col + '">' + t(n.n) + (n.max > 1 ? ' ' + lvl + '/' + n.max : '') + '</span>' +
        '<div class="label">' + t(n.d) +
        (locked ? ' · <span style="color:var(--bad)">' + t('needs: ') + n.req.map(r => t(ascNodeById(r).n)).join(', ') + '</span>' : '') +
        '</div></div>';
      const b = document.createElement('button');
      if (maxed) { b.textContent = t('MAX'); b.disabled = true; }
      else {
        b.textContent = cost + ' ✦';
        b.disabled = !ascCanBuy(save, n);
        b.onclick = () => { if (buyAscNode(save, n)) { sfx.leg(); rerender(); } };
      }
      el.appendChild(b);
      box.appendChild(el);
    }
  }
}
