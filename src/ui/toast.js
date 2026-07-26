import { $ } from './dom.js';

/* Small transient message at the bottom of the screen — used for locked-tab
   hints (main nav and Fame sub-tabs) and other brief notices. */
let toastTimer = 0;
export function toast(msg) {
  let el = $('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}
