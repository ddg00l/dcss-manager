import { $ } from './dom.js';
import { tileURL } from '../data/tiles.js';
import { RACES } from '../data/races.js';
import { CLASSES } from '../data/classes.js';
import { RARN } from '../data/combos.js';
import { itemName, itemTile, itemInfo } from '../data/items.js';
import { sfx } from './audio.js';
import { t } from '../i18n/index.js';

/* The summon/forge modal. A big action button opens it in CHOOSE mode (pick a
   summon type or a slot to forge); the chosen action plays a full-screen REVEAL
   in the same window — rarity-tiered VFX (anticipation ring, canvas particle
   burst, god-rays and shake for epic+), then Keep / Dismantle for items or tap
   to continue for heroes — and returns to the choices so you can pull again.
   Self-contained: particles on a canvas, everything else CSS. */
const RC = ['#9aa7b8', '#5e9ee0', '#b06be0', '#e0a03c'];               // rar0..3
const CFG = [
  { n: 22, hold: 650 }, { n: 42, hold: 800 },
  { n: 78, hold: 950 }, { n: 140, hold: 1150 },
];

let modal, cv, ctx, parts = [], raf = 0, phase = 'idle', holdT = 0, cur = null, chooser = null;

function ensure() {
  if (modal) return;
  modal = $('gachaModal'); cv = $('gmFx'); ctx = cv.getContext('2d');
  modal.addEventListener('click', onTap);
  $('gmClose').addEventListener('click', e => { e.stopPropagation(); dismiss(); });
  window.addEventListener('resize', () => { if (phase !== 'idle') resize(); });
}
function resize() { cv.width = modal.clientWidth; cv.height = modal.clientHeight; }

/* ---- particle burst ---- */
function burst(rar) {
  const cx = cv.width / 2, cy = cv.height * 0.4, col = RC[rar], n = CFG[rar].n;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 2.5 + Math.random() * (6 + rar * 2.5);
    parts.push({
      x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2.5,
      life: 1, decay: 0.007 + Math.random() * 0.013,
      size: 1.5 + Math.random() * (2 + rar), col, spark: rar >= 3 && Math.random() < 0.5,
    });
  }
  if (!raf) raf = requestAnimationFrame(tick);
}
function tick(ts) {
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.globalCompositeOperation = 'lighter';
  let alive = 0;
  for (const p of parts) {
    if (p.life <= 0) continue;
    alive++;
    p.x += p.vx; p.y += p.vy; p.vy += 0.11; p.vx *= 0.99; p.life -= p.decay;
    let a = Math.max(0, p.life);
    if (p.spark) a *= 0.35 + 0.65 * Math.abs(Math.sin(ts / 90 + p.x * 0.1));
    ctx.globalAlpha = a; ctx.fillStyle = p.col;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  raf = alive ? requestAnimationFrame(tick) : 0;
}

/* ---- modes ---- */
function showChoose() {
  phase = 'choose';
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
  if (ctx) ctx.clearRect(0, 0, cv.width, cv.height);
  modal.className = 'gm show choose';
  const box = $('gmChoose'); box.innerHTML = '';
  if (chooser) chooser(box);
}
function back() { if (chooser) showChoose(); else dismiss(); }
function dismiss() {
  phase = 'idle'; chooser = null; cur = null;
  clearTimeout(holdT);
  modal.classList.remove('show');
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
  parts = [];
}

/** open the modal in CHOOSE mode; render(container) fills the picker */
export function openModal(render) {
  ensure();
  chooser = render;
  showChoose();
  modal.classList.add('show');
  resize();
}

/* ---- reveal ---- */
function reveal() {
  if (phase !== 'anticip' || !cur) return;
  clearTimeout(holdT); phase = 'reveal';
  const rar = cur.rarity;
  modal.className = 'gm show reveal rar' + rar + (rar >= 2 ? ' rays shake' : '');
  cur.build();
  const act = $('gmActions'); act.innerHTML = '';
  if (cur.actions && cur.actions.length) {
    for (const a of cur.actions) {
      const b = document.createElement('button');
      b.className = a.cls || '';
      b.textContent = a.label;
      b.onclick = e => { e.stopPropagation(); if (a.onClick) a.onClick(); back(); };
      act.appendChild(b);
    }
    $('gmHint').textContent = '';
  } else {
    setTimeout(() => { if (phase === 'reveal') $('gmHint').textContent = t('Tap to continue'); }, 550);
  }
  burst(rar);
  cur.sound();
}
function open(o) {
  ensure();
  clearTimeout(holdT); parts = []; cur = o; phase = 'anticip';
  modal.className = 'gm show anticip rar' + o.rarity;
  $('gmImg').removeAttribute('src');
  $('gmName').textContent = ''; $('gmRar').textContent = '';
  $('gmSub').innerHTML = ''; $('gmHint').textContent = ''; $('gmActions').innerHTML = '';
  resize();
  holdT = setTimeout(reveal, CFG[o.rarity].hold);
}
function onTap(e) {
  if (phase === 'choose') { if (e.target === modal || e.target === $('gmChoose')) dismiss(); return; }
  if (phase === 'anticip') { reveal(); return; }
  if (phase === 'reveal' && !(cur && cur.actions && cur.actions.length)) back();
}

/** hero summon reveal (res = {race, cls, rarity}) */
export function playSummonReveal(res, extra) {
  open({
    rarity: res.rarity,
    build: () => {
      $('gmImg').src = tileURL(RACES[res.race].t);
      $('gmName').textContent = t(RACES[res.race].n) + ' ' + t(CLASSES[res.cls].n);
      $('gmRar').innerHTML = '<span class="rar' + res.rarity + '">' + t(RARN[res.rarity]) + '</span>' + (extra ? ' · ' + extra : '');
      $('gmSub').innerHTML = t(RACES[res.race].d) + ' · ' + t(CLASSES[res.cls].d);
    },
    sound: () => (res.rarity >= 3 ? sfx.leg() : sfx.roll()),
  });
}

function itemBits(it) {
  const i = itemInfo(it), b = [];
  if (i.dmgBase) b.push(t('damage ') + i.dmgBase);
  if (i.ac) b.push('AC+' + Math.floor(i.ac));
  if (i.ev) b.push('EV' + (i.ev > 0 ? '+' : '') + i.ev);
  if (i.dmgP) b.push('+' + Math.round(i.dmgP * 100) + t('% damage'));
  if (i.hp) b.push('+' + Math.round(i.hp * 100) + '% HP');
  if (i.mul) b.push(t('ego ×') + i.mul);
  if (i.leech) b.push(t('lifesteal ') + Math.round(i.leech * 100) + '%');
  if (i.regen) b.push(t('regen'));
  return b.join(' · ') || '—';
}

/** forged item reveal; actions = [{label, cls, onClick}] (Keep / Dismantle) */
export function playForgeReveal(it, actions) {
  open({
    rarity: it.rar,
    build: () => {
      $('gmImg').src = tileURL(itemTile(it));
      $('gmName').textContent = itemName(it);
      $('gmRar').innerHTML = '<span class="rar' + it.rar + '">' + t(RARN[it.rar]) + '</span>' + (it.rand ? ' · ' + t('RANDART') : '');
      $('gmSub').innerHTML = itemBits(it);
    },
    sound: () => (it.rar >= 3 ? sfx.leg() : sfx.forge()),
    actions,
  });
}
