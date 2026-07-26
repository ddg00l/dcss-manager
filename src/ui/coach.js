/* Coachmark engine: dim overlay with a cutout, narrator line, hard click blocking. */
import { tileURL } from '../data/tiles.js';
import { t } from '../i18n/index.js';

let els = [], activeStep = null, posTimer = null;

function clear() {
  for (const e of els) e.remove();
  els = []; activeStep = null;
  if (posTimer) { clearInterval(posTimer); posTimer = null; }
}
function div(cls, style) {
  const d = document.createElement('div');
  d.className = cls;
  Object.assign(d.style, style);
  document.body.appendChild(d);
  els.push(d);
  return d;
}
function place(target, pad) {
  const r = target.getBoundingClientRect();
  const x = r.left - pad, y = r.top - pad, w = r.width + pad * 2, h = r.height + pad * 2;
  const [top, left, right, bottom, ring] = els;
  Object.assign(top.style, { left: 0, top: 0, width: '100vw', height: y + 'px' });
  Object.assign(left.style, { left: 0, top: y + 'px', width: Math.max(0, x) + 'px', height: h + 'px' });
  Object.assign(right.style, { left: (x + w) + 'px', top: y + 'px', width: 'calc(100vw - ' + (x + w) + 'px)', height: h + 'px' });
  Object.assign(bottom.style, { left: 0, top: (y + h) + 'px', width: '100vw', height: 'calc(100vh - ' + (y + h) + 'px)' });
  Object.assign(ring.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
  /* narrator bubble: sit on whichever side of the cutout has more room, and cap
     its height to that room so it never spills off-screen (scrolls inside if long) */
  const bub = els[5];
  const gap = 12, margin = 8;
  const roomBelow = window.innerHeight - (y + h) - gap - margin;
  const roomAbove = y - gap - margin;
  if (roomBelow >= roomAbove) {
    Object.assign(bub.style, { top: (y + h + gap) + 'px', bottom: '', maxHeight: Math.max(120, roomBelow) + 'px' });
  } else {
    Object.assign(bub.style, { top: '', bottom: 'calc(100vh - ' + (y - gap) + 'px)', maxHeight: Math.max(120, roomAbove) + 'px' });
  }
}

/** step: {sel, text, mode:'click'|'next', skip?:fn} → onDone() */
export function coach(step, onDone) {
  clear();
  const target = document.querySelector(step.sel);
  if (!target) { onDone(); return; }
  target.scrollIntoView({ block: 'center', behavior: 'instant' });
  activeStep = step;
  const pad = 6;
  for (let i = 0; i < 4; i++) div('coachBlock', {});
  div('coachRing', {});
  const bub = div('coachBubble', {});
  bub.innerHTML =
    '<img src="' + tileURL('m_wraith') + '" alt="">' +
    '<div class="cbTxt">' + t(step.text) +
    (step.mode === 'click'
      ? '<div class="cbHint">' + t('— tap the highlighted element —') + '</div>'
      : '<button class="cbNext">' + t('Next') + '</button>') +
    (step.skip ? '<button class="cbSkip">' + t('Skip tutorial') + '</button>' : '') +
    '</div>';
  place(target, pad);
  posTimer = setInterval(() => {
    const t = document.querySelector(step.sel);
    if (t) place(t, pad);
  }, 250);
  const finish = () => { clear(); onDone(); };
  if (step.mode === 'click') {
    target.addEventListener('click', () => setTimeout(finish, 50), { once: true });
  } else {
    bub.querySelector('.cbNext').onclick = finish;
  }
  if (step.skip) bub.querySelector('.cbSkip').onclick = () => { clear(); step.skip(); };
}
export function coachActive() { return activeStep !== null; }
export function coachClear() { clear(); }

/** chain of steps; skipAll — allow skipping the whole tour */
export function playTour(steps, onAllDone, skipAll) {
  let i = 0;
  const next = () => {
    if (i >= steps.length) { onAllDone && onAllDone(); return; }
    const st = { ...steps[i++] };
    if (skipAll) st.skip = () => { onAllDone && onAllDone(); };
    coach(st, next);
  };
  next();
}
