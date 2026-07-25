import { $ } from './dom.js';
import { tileURL } from '../data/tiles.js';
import { save, persist } from '../core/state.js';
import { fmt } from '../core/fmt.js';
import { sfx } from './audio.js';
import {
  NODES, REGIONS, CX, CY, nodeById, treeLvl, nodeCost, canBuy, buyNode, achMet, memEff,
} from '../data/memtree.js';
import { t } from '../i18n/index.js';

let selId = null, built = false, centered = false;

/** Full re-render of the tree canvas (SVG edges + nodes). */
function buildTree() {
  const cont = $('memTree');
  cont.innerHTML = '';
  const W = 1800, H = 1720;
  cont.style.width = W + 'px';
  cont.style.height = H + 'px';
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'memSvg');
  for (const n of NODES) {
    for (const r of n.req) {
      const p = nodeById(r);
      if (!p) continue;
      const ln = document.createElementNS(NS, 'line');
      ln.setAttribute('x1', p.x); ln.setAttribute('y1', p.y);
      ln.setAttribute('x2', n.x); ln.setAttribute('y2', n.y);
      const lit = treeLvl(save, p.id) > 0;
      ln.setAttribute('stroke', lit ? REGIONS[n.region].col : '#232b38');
      ln.setAttribute('stroke-opacity', lit ? (treeLvl(save, n.id) > 0 ? '.8' : '.45') : '1');
      ln.setAttribute('stroke-width', treeLvl(save, n.id) > 0 && lit ? '2.5' : '1.5');
      svg.appendChild(ln);
    }
  }
  cont.appendChild(svg);
  for (const n of NODES) {
    const lvl = treeLvl(save, n.id);
    const col = REGIONS[n.region].col;
    const el = document.createElement('div');
    const reachable = n.id === 'root' || n.req.some(r => treeLvl(save, r) > 0);
    el.className = 'memNode' + (n.keystone ? ' key' : '') +
      (lvl >= n.max ? ' maxed' : lvl > 0 ? ' owned' : reachable ? ' avail' : ' locked') +
      (selId === n.id ? ' sel' : '');
    el.style.left = (n.x - (n.keystone ? 24 : 17)) + 'px';
    el.style.top = (n.y - (n.keystone ? 24 : 17)) + 'px';
    el.style.color = col;
    el.style.borderColor = col;
    if (lvl >= n.max) el.style.background = col;
    el.innerHTML = '<img src="' + tileURL(n.icon || 'd_altar') + '" alt="">' +
      (!n.keystone && lvl > 0 ? '<i class="lvlb">' + lvl + '</i>' : '');
    el.onclick = () => { sfx.ui(); selId = n.id; renderMemTree(); };
    cont.appendChild(el);
  }
  if (!centered) centerMemTree();
}

/** center the canvas on the Memory tree root; called every time the tab is opened */
export function centerMemTree() {
  const wrap = $('memWrap');
  if (!wrap || wrap.clientWidth === 0) return; /* tab is hidden — defer */
  wrap.scrollLeft = CX - wrap.clientWidth / 2;
  wrap.scrollTop = CY - wrap.clientHeight / 2;
  centered = true;
}

function renderInfo() {
  const info = $('memInfo');
  $('memBal').innerHTML = '🕯 <b>' + fmt(save.mem) + '</b>' + t(' Dungeon Memory') +
    ' <span class="label">' + t('· floors, uniques and especially hero deaths feed the tree') + '</span>';
  const n = selId && nodeById(selId);
  if (!n) {
    info.innerHTML = '<div class="tInfo"><div class="ds">' + t('Click a node. Small nodes are increment levels; ') +
      t('⟐ keystones change the rules of the game and require achievements.') + '</div></div>';
    return;
  }
  const lvl = treeLvl(save, n.id), maxed = lvl >= n.max;
  const reachable = n.id === 'root' || n.req.some(r => treeLvl(save, r) > 0);
  const ach = achMet(save, n);
  let reqTxt = '';
  if (!reachable) reqTxt = '<span class="req">' + t('requires an adjacent node') + '</span> · ';
  if (n.ach) reqTxt += '<span class="' + (ach ? 'achOk' : 'req') + '">' + t('condition: ') + t(n.ach.t) + (ach ? ' ✓' : '') + '</span> · ';
  info.innerHTML =
    '<img class="infoIcon" src="' + tileURL(n.icon || 'd_altar') + '" alt="">' +
    '<div class="tInfo"><div class="nm" style="color:' + REGIONS[n.region].col + '">' +
    t(n.n) + ' · ' + lvl + '/' + n.max + '</div>' +
    '<div class="ds">' + t(n.d) + '</div>' +
    '<div class="cost">' + reqTxt + (maxed ? 'MAX' : (t('cost: ') + fmt(nodeCost(save, n)) + ' 🕯')) + '</div></div>';
  if (!maxed) {
    const b = document.createElement('button');
    b.textContent = t('Invest memory');
    b.disabled = !canBuy(save, n);
    b.onclick = () => {
      if (buyNode(save, n)) {
        (n.keystone ? sfx.leg : sfx.coin)();
        persist();
        window.__renderAll();
      }
    };
    info.appendChild(b);
  }
}

export function renderMemTree() {
  buildTree();
  renderInfo();
}
