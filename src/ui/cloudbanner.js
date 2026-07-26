/* In-game "session expired" banner: offers a one-click re-login (a real user
   gesture, so the Google popup is not blocked). Shown only when a previously
   signed-in user's token has lapsed; never auto-opens anything. */
import { $ } from './dom.js';
import { t } from '../i18n/index.js';
import { sfx } from './audio.js';
import { reconnect, sessionExpired } from '../cloud/index.js';

let dismissed = false;

export function maybeCloudBanner(getSave, applyState) {
  const exists = document.getElementById('cloudBar');
  if (!sessionExpired() || dismissed) { if (exists) exists.remove(); return; }
  if (exists) return;
  const bar = document.createElement('div');
  bar.id = 'cloudBar';
  bar.innerHTML = '<span>' + t('Cloud session expired — sign in again to keep syncing') + '</span>';
  const btn = document.createElement('button');
  btn.textContent = t('Sign in');
  btn.onclick = async () => {
    sfx.ui();
    try { await reconnect(getSave, applyState); bar.remove(); }
    catch { /* user cancelled — leave the banner */ }
  };
  const x = document.createElement('button');
  x.className = 'updX'; x.textContent = '×';
  x.onclick = () => { dismissed = true; bar.remove(); };
  bar.appendChild(btn); bar.appendChild(x);
  document.body.appendChild(bar);
}
export function resetCloudBanner() { dismissed = false; }
