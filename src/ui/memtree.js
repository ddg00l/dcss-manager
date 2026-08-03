import { $ } from './dom.js';
import { tileURL } from '../data/tiles.js';
import { save, persist } from '../core/state.js';
import { fmt } from '../core/fmt.js';
import { sfx } from './audio.js';
import {
  NODES, REGIONS, CX, CY, nodeById, treeLvl, nodeCost, canBuy, buyNode, achMet, memEff, MASTERY_KEY, MASTERY_K, regionMastery, masteredRegion} from '../data/memtree.js';
import { t } from '../i18n/index.js';

let selId = null, built = false, centered = false;
const nodeEls = {};   /* id → node div, built once and updated in place */
const edgeEls = [];   /* {line, fromId, toId, col} for in-place edge restyling */

/* PoE-style panning: click + drag scrolls the tree canvas (mouse/pen only —
   touch keeps native scrolling). A real drag suppresses the node click. */
{
  const wrap = $('memWrap');
  let dragging = false, moved = false, sx = 0, sy = 0, sl = 0, st = 0;
  wrap.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.pointerType === 'touch') return;
    dragging = true; moved = false;
    sx = e.clientX; sy = e.clientY;
    sl = wrap.scrollLeft; st = wrap.scrollTop;
    wrap.classList.add('grabbing');
  });
  window.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) + Math.abs(dy) > 5) moved = true;
    wrap.scrollLeft = sl - dx;
    wrap.scrollTop = st - dy;
  });
  window.addEventListener('pointerup', () => {
    dragging = false;
    wrap.classList.remove('grabbing');
  });
  /* swallow the click that ends a drag so nodes are not selected accidentally */
  wrap.addEventListener('click', e => {
    if (moved) { moved = false; e.stopPropagation(); e.preventDefault(); }
  }, true);
  wrap.addEventListener('dragstart', e => e.preventDefault());
}

/** Full re-render of the tree canvas (SVG edges + nodes). */
/* Build the static tree DOM exactly once (nodes + edges never change position);
   subsequent renders only restyle in place, so the pulse animation never resets. */
function buildTree() {
  if (built) { refreshTree(); return; }
  const cont = $('memTree');
  cont.innerHTML = '';
  cont.style.width = '1800px';
  cont.style.height = '1720px';
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
      svg.appendChild(ln);
      edgeEls.push({ line: ln, fromId: p.id, toId: n.id, col: REGIONS[n.region].col });
    }
  }
  cont.appendChild(svg);
  for (const n of NODES) {
    const col = REGIONS[n.region].col;
    const el = document.createElement('div');
    el.style.left = (n.x - (n.keystone ? 24 : 17)) + 'px';
    el.style.top = (n.y - (n.keystone ? 24 : 17)) + 'px';
    el.style.color = col;
    el.style.borderColor = col;
    el.onclick = () => { sfx.ui(); openNodeModal(n.id); };
    el._lvl = -1;
    nodeEls[n.id] = el;
    cont.appendChild(el);
  }
  built = true;
  refreshTree();
  if (!centered) centerMemTree();
}

/* Restyle existing nodes/edges in place — cheap, and it leaves each node element
   (and thus its running .pulse animation) untouched unless its state changed. */
function refreshTree() {
  for (const n of NODES) {
    const el = nodeEls[n.id];
    if (!el) continue;
    const lvl = treeLvl(save, n.id);
    const reachable = n.id === 'root' || n.req.some(r => treeLvl(save, r) > 0);
    const cls = 'memNode' + (n.keystone ? ' key' : '') +
      (lvl >= n.max ? ' maxed' : lvl > 0 ? ' owned' : reachable ? ' avail' : ' locked') +
      (canBuy(save, n) ? ' pulse' : '') + /* affordable right now → draw the eye */
      (selId === n.id ? ' sel' : '');
    if (el.className !== cls) el.className = cls; /* skip identical → no anim restart */
    const bg = lvl >= n.max ? REGIONS[n.region].col : '';
    if (el.style.background !== bg) el.style.background = bg;
    if (el._lvl !== lvl) { /* icon + level badge only when the level actually changed */
      el._lvl = lvl;
      el.innerHTML = '<img src="' + tileURL(n.icon || 'd_altar') + '" alt="">' +
        (!n.keystone && lvl > 0 ? '<i class="lvlb">' + lvl + '</i>' : '');
    }
  }
  for (const e of edgeEls) {
    const lit = treeLvl(save, e.fromId) > 0;
    const owned = treeLvl(save, e.toId) > 0;
    e.line.setAttribute('stroke', lit ? e.col : '#232b38');
    e.line.setAttribute('stroke-opacity', lit ? (owned ? '.8' : '.45') : '1');
    e.line.setAttribute('stroke-width', owned && lit ? '2.5' : '1.5');
  }
}

/** center the canvas on the Memory tree root; called every time the tab is opened */
export function centerMemTree() {
  const wrap = $('memWrap');
  if (!wrap || wrap.clientWidth === 0) return; /* tab is hidden — defer */
  wrap.scrollLeft = CX - wrap.clientWidth / 2;
  wrap.scrollTop = CY - wrap.clientHeight / 2;
  centered = true;
}

/* the floating balance HUD over the full-screen tree */
function updateBal() {
  const bal = $('memBal');
  if (!bal) return;
  bal.innerHTML = '🕯 <b>' + fmt(save.mem) + '</b>' + t(' Dungeon Memory') +
    ' <span class="label">' + t('· floors, uniques and especially hero deaths feed the tree') + '</span>';
}

/** CiFi-style: the tree IS the screen; clicking a node opens its upgrade here. */
export function openNodeModal(id) {
  selId = id;
  buildTree();          /* reflect the selection highlight on the tree */
  renderNodeModal();
  $('memNode').classList.add('show');
}

/* What mastery is currently worth in this region, in the region's own terms. The
   keystone's description states the rule; a player deciding whether to commit needs
   the number it currently comes to, and how far it has already grown. */
function masteryLine(n) {
  const region = n.region;
  const kid = MASTERY_KEY[region];
  if (!kid) return '';
  const owned = treeLvl(save, kid) > 0;
  /* show it on the mastery keystone itself, and on any node of a region already
     mastered -- there the number is the reason to keep buying here */
  if (n.id !== kid && !owned) return '';
  const lv = regionMastery(save, region);
  const mul = 1 + MASTERY_K * lv;
  return '<div class="cost">' + t('Mastery here: ') + lv + ' ' + t('nodes') +
    ' → ×' + mul.toFixed(2) + (owned ? '' : ' ' + t('(once taken)')) + '</div>';
}

function renderNodeModal() {
  const box = $('memNodeBox');
  const n = selId && nodeById(selId);
  if (!box || !n) return;
  const lvl = treeLvl(save, n.id), maxed = lvl >= n.max;
  const reachable = n.id === 'root' || n.req.some(r => treeLvl(save, r) > 0);
  const ach = achMet(save, n);
  const reqParts = [];
  if (!reachable) reqParts.push('<span class="req">' + t('requires an adjacent node') + '</span>');
  if (n.ach) reqParts.push('<span class="' + (ach ? 'achOk' : 'req') + '">' + t('condition: ') + t(n.ach.t) + (ach ? ' ✓' : '') + '</span>');
  /* Say why the button is dead. A node whose stated conditions all read as met and
     whose button is nonetheless greyed out is the game refusing without a reason --
     and mastery has a rule that lives nowhere in this panel: one Way at a time. A
     player who has already sworn one sees every condition ticked and no explanation. */
  const sworn = masteredRegion(save);
  const isWay = Object.values(MASTERY_KEY).includes(n.id);
  if (!maxed && isWay && sworn && sworn !== n.region)
    reqParts.push('<span class="req">' + t('another Way is already sworn: ') +
      t(nodeById(MASTERY_KEY[sworn]).n) + t(' — it is released when you prestige') + '</span>');
  const cost = nodeCost(save, n);
  if (!maxed && reachable && ach && (save.mem || 0) < cost)
    reqParts.push('<span class="req">' + t('short of Memory by ') + fmt(cost - (save.mem || 0)) + ' 🕯</span>');
  const statusLine = maxed ? '<b>MAX</b>' : reqParts.join(' · ');
  box.innerHTML =
    '<div class="nodeHead">' +
    '<img class="infoIcon" src="' + tileURL(n.icon || 'd_altar') + '" alt="">' +
    '<div><div class="nm" style="color:' + REGIONS[n.region].col + '">' + t(n.n) + (n.keystone ? ' ⟐' : '') + '</div>' +
    '<div class="label">' + (n.keystone ? t('keystone') + ' · ' : '') + lvl + ' / ' + n.max + '</div></div></div>' +
    '<div class="ds" style="margin:10px 0 8px">' + t(n.d) + '</div>' +
    masteryLine(n) +
    (statusLine ? '<div class="cost">' + statusLine + '</div>' : '');
  if (!maxed) {
    const b = document.createElement('button');
    b.style.cssText = 'width:100%;margin-top:14px';
    b.textContent = t('Invest memory') + ' · ' + fmt(nodeCost(save, n)) + ' 🕯';
    b.disabled = !canBuy(save, n);
    b.onclick = () => {
      if (buyNode(save, n)) {
        (n.keystone ? sfx.leg : sfx.coin)();
        persist();
        window.__renderAll();  /* refresh tree + top bar */
        renderNodeModal();     /* keep the modal open, updated */
      }
    };
    box.appendChild(b);
  }
  const close = document.createElement('button');
  close.style.cssText = 'width:100%;margin-top:8px';
  close.textContent = t('Done');
  close.onclick = () => { sfx.ui(); $('memNode').classList.remove('show'); };
  box.appendChild(close);
}
$('memNode').addEventListener('click', e => {
  if (e.target.id === 'memNode') { sfx.ui(); $('memNode').classList.remove('show'); }
});

export function renderMemTree() {
  buildTree();
  updateBal();
  if ($('memNode').classList.contains('show')) renderNodeModal();
}
