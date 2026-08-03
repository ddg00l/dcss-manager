import { $ } from './dom.js';
import { save, persist } from '../core/state.js';
import { sfx } from './audio.js';
import { tileURL } from '../data/tiles.js';
import { t } from '../i18n/index.js';
import {
  ASC_NODES, ASC_REGIONS, ASC_W, ASC_H, ASC_CX, ASC_CY, ASCEND_GATE,
  ascendancy, ascLevel, ascGain, canAscend, ascensionUnlocked,
  ascNodeById, ascNodeLvl, ascNodeCost, ascCanBuy, buyAscNode, doAscension, ascHas,
} from '../core/ascension.js';

const rerender = () => { persist(); if (window.__renderAll) window.__renderAll(); };
const colOf = n => ASC_REGIONS[n.fam].col;

/* ---- panning (mouse/pen; touch keeps native scroll), set up once ---- */
{
  const wrap = $('ascWrap');
  if (wrap) {
    let drag = false, moved = false, sx = 0, sy = 0, sl = 0, st = 0;
    wrap.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.pointerType === 'touch') return;
      drag = true; moved = false; sx = e.clientX; sy = e.clientY; sl = wrap.scrollLeft; st = wrap.scrollTop;
      wrap.classList.add('grabbing');
    });
    window.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 5) moved = true;
      wrap.scrollLeft = sl - dx; wrap.scrollTop = st - dy;
    });
    window.addEventListener('pointerup', () => { drag = false; wrap.classList.remove('grabbing'); });
    wrap.addEventListener('click', e => { if (moved) { moved = false; e.stopPropagation(); e.preventDefault(); } }, true);
    wrap.addEventListener('dragstart', e => e.preventDefault());
  }
}

/* ---- the header: balance + the Ascend action ---- */
function renderHead() {
  const head = $('ascHead');
  if (!head) return;
  const gain = ascGain(save);
  let html =
    '<div class="card"><div class="rowT"><img class="pt" src="' + tileURL('i_orb') + '" alt="">' +
    '<div><div class="nm" style="color:#e0c05a">✦ ' + t('Ascension') + '</div>' +
    '<div class="sub">' + t('Ascendancy') + ': <b style="color:#e0c05a">' + ascendancy(save) + ' ✦</b> · ' +
    t('Ascensions') + ': <b>' + ascLevel(save) + '</b></div></div></div>' +
    '<div class="meta" style="font-size:10px;line-height:1.5;color:var(--dim)">' +
    t('Ascend to shed the entire prestige layer — prestiges, Legends, the Memory tree, Zot upgrades, gold and heroes all burn away — for Ascendancy ✦ and its tree of game-changing powers. Your Collection (stars, artefacts, halls, Pantheon, Bestiary) endures.') + '</div>';
  if (!ascensionUnlocked(save)) {
    html += '<div class="cost">' + t('Reach {n} prestiges to unlock Ascension — {x} so far.', { n: ASCEND_GATE, x: save.prestiges || 0 }) + '</div>';
  }
  html += '</div>';
  head.innerHTML = html;
  if (ascensionUnlocked(save)) {
    const b = document.createElement('button');
    b.className = 'purple';
    b.style.cssText = 'width:100%;margin-top:-4px';
    b.textContent = '✦ ' + t('ASCEND') + ' · +' + gain + ' ✦';
    b.disabled = !canAscend(save);
    b.onclick = () => {
      if (!confirm(t('Ascend? This burns the ENTIRE prestige layer (prestiges, Legends, Memory tree, Zot upgrades, gold, heroes) for +{g} ✦. The Collection is kept.', { g: gain }))) return;
      if (doAscension(save)) { sfx.leg(); rerender(); }
    };
    head.appendChild(b);
  }
}

/* ---- the tree (build once, restyle in place — keeps the pulse animation) ---- */
let ascBuilt = false, ascSel = null;
const nodeEls = {}, edgeEls = [];

function buildAscTree() {
  if (ascBuilt) { refreshAscTree(); return; }
  const cont = $('ascTree');
  if (!cont) return;
  cont.innerHTML = '';
  cont.style.width = ASC_W + 'px';
  cont.style.height = ASC_H + 'px';
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'memSvg');
  const line = (x1, y1, x2, y2) => { const l = document.createElementNS(NS, 'line'); l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2); svg.appendChild(l); return l; };
  for (const n of ASC_NODES) {
    if (n.req.length) {
      for (const r of n.req) { const p = ascNodeById(r); if (p) edgeEls.push({ line: line(p.x, p.y, n.x, n.y), fromId: p.id, toId: n.id, col: colOf(n) }); }
    } else {
      edgeEls.push({ line: line(ASC_CX, ASC_CY, n.x, n.y), fromId: '_root', toId: n.id, col: colOf(n) }); /* arm from the hub */
    }
  }
  cont.appendChild(svg);
  /* the central hub emblem (non-interactive) */
  const hub = document.createElement('div');
  hub.className = 'memNode key owned';
  hub.style.cssText = 'left:' + (ASC_CX - 24) + 'px;top:' + (ASC_CY - 24) + 'px;color:#e0c05a;border-color:#e0c05a;cursor:default';
  hub.innerHTML = '<img src="' + tileURL('i_orb') + '" alt="">';
  cont.appendChild(hub);
  for (const n of ASC_NODES) {
    const el = document.createElement('div');
    el.style.left = (n.x - 17) + 'px';
    el.style.top = (n.y - 17) + 'px';
    el.style.color = colOf(n);
    el.style.borderColor = colOf(n);
    el.onclick = () => { sfx.ui(); openAscModal(n.id); };
    el._lvl = -1;
    nodeEls[n.id] = el;
    cont.appendChild(el);
  }
  ascBuilt = true;
  refreshAscTree();
}

function refreshAscTree() {
  for (const n of ASC_NODES) {
    const el = nodeEls[n.id]; if (!el) continue;
    const lvl = ascNodeLvl(save, n.id);
    const reachable = !n.req.length || n.req.every(r => ascHas(save, r));
    const cls = 'memNode' +
      (lvl >= n.max ? ' maxed' : lvl > 0 ? ' owned' : reachable ? ' avail' : ' locked') +
      (ascCanBuy(save, n) ? ' pulse' : '') +
      (ascSel === n.id ? ' sel' : '');
    if (el.className !== cls) el.className = cls;
    const bg = lvl >= n.max ? colOf(n) : '';
    if (el.style.background !== bg) el.style.background = bg;
    if (el._lvl !== lvl) {
      el._lvl = lvl;
      el.innerHTML = '<img src="' + tileURL(n.icon) + '" alt="">' + (n.max > 1 && lvl > 0 ? '<i class="lvlb">' + lvl + '</i>' : '');
    }
  }
  for (const e of edgeEls) {
    const lit = e.fromId === '_root' || ascHas(save, e.fromId);
    const owned = ascHas(save, e.toId);
    e.line.setAttribute('stroke', lit ? e.col : '#232b38');
    e.line.setAttribute('stroke-opacity', lit ? (owned ? '.8' : '.45') : '1');
    e.line.setAttribute('stroke-width', owned && lit ? '2.5' : '1.5');
  }
}

/* ---- node modal (cost on the button, CiFi-style) ---- */
export function openAscModal(id) {
  ascSel = id;
  refreshAscTree();
  renderAscModal();
  $('ascNode').classList.add('show');
}
function renderAscModal() {
  const box = $('ascNodeBox');
  const n = ascSel && ascNodeById(ascSel);
  if (!box || !n) return;
  const lvl = ascNodeLvl(save, n.id), maxed = lvl >= n.max;
  const reachable = !n.req.length || n.req.every(r => ascHas(save, r));
  const need = n.req.filter(r => !ascHas(save, r)).map(r => t(ascNodeById(r).n));
  box.innerHTML =
    '<div class="nodeHead"><img class="infoIcon" src="' + tileURL(n.icon) + '" alt="">' +
    '<div><div class="nm" style="color:' + colOf(n) + '">' + t(n.n) + '</div>' +
    '<div class="label">' + t(ASC_REGIONS[n.fam].n) + (n.max > 1 ? ' · ' + lvl + ' / ' + n.max : '') + '</div></div></div>' +
    '<div class="ds" style="margin:10px 0 8px">' + t(n.d) + '</div>' +
    (need.length ? '<div class="cost"><span class="req">' + t('needs: ') + need.join(', ') + '</span></div>' : (maxed ? '<div class="cost"><b>MAX</b></div>' : ''));
  if (!maxed) {
    const b = document.createElement('button');
    b.className = 'purple';
    b.style.cssText = 'width:100%;margin-top:14px';
    b.textContent = '✦ ' + t('Ascend node') + ' · ' + ascNodeCost(save, n) + ' ✦';
    b.disabled = !ascCanBuy(save, n);
    b.onclick = () => { if (buyAscNode(save, n)) { sfx.leg(); rerender(); renderAscModal(); } };
    box.appendChild(b);
  }
  const close = document.createElement('button');
  close.style.cssText = 'width:100%;margin-top:8px';
  close.textContent = t('Done');
  close.onclick = () => { sfx.ui(); $('ascNode').classList.remove('show'); };
  box.appendChild(close);
}
if ($('ascNode')) $('ascNode').addEventListener('click', e => { if (e.target.id === 'ascNode') { sfx.ui(); $('ascNode').classList.remove('show'); } });

export function renderAscension() {
  renderHead();
  buildAscTree();
  if ($('ascNode') && $('ascNode').classList.contains('show')) renderAscModal();
}
