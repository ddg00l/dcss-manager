/* Auto-update: the CI build stamps __BUILD__ and publishes version.json next to
   the page. We poll it (and re-check on tab return); a mismatch means a new
   deploy is live, so we offer a one-click refresh. Local/dev builds are silent. */
import { t } from '../i18n/index.js';
import { persist } from '../core/state.js';

const BUILD = typeof __BUILD__ !== 'undefined' ? __BUILD__ : 'dev';
let offered = false;

function showBar() {
  if (offered || document.getElementById('updBar')) return;
  offered = true;
  const bar = document.createElement('div');
  bar.id = 'updBar';
  bar.innerHTML = '<span>' + t('A new version of the game is ready') + '</span>';
  const btn = document.createElement('button');
  btn.textContent = t('Refresh');
  btn.onclick = () => { persist(); location.reload(); };
  const close = document.createElement('button');
  close.className = 'updX';
  close.textContent = '×';
  close.onclick = () => bar.remove();
  bar.appendChild(btn);
  bar.appendChild(close);
  document.body.appendChild(bar);
}

async function check() {
  try {
    const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return;
    const v = await r.json();
    if (v.build && v.build !== BUILD) showBar();
  } catch (e) { /* offline or file:// — silently skip */ }
}

if (BUILD !== 'dev' && location.protocol.startsWith('http')) {
  setInterval(check, 15 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  setTimeout(check, 30 * 1000);
}
