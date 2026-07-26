import { $ } from './dom.js';
import { t } from '../i18n/index.js';

/* Install hint. iOS Safari never fires an install prompt (Apple gives no
   beforeinstallprompt), so the only way onto the home screen is Share → Add to
   Home Screen — we surface a dismissible hint that says exactly that. On Android
   we capture the real beforeinstallprompt and offer a one-tap Install button.
   Either way it shows once (dismissal is remembered) and never in an already
   installed / standalone window. */
const KEY = 'dcss.installHintDismissed';
let deferred = null;

const isStandalone = () =>
  (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
  window.navigator.standalone === true;

const isIOS = () =>
  /iP(hone|od|ad)/.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)); // iPadOS 13+ poses as Mac

function dismiss(bar) {
  bar.remove();
  try { localStorage.setItem(KEY, '1'); } catch (e) { /* private mode */ }
}

function showBar(kind) {
  try { if (localStorage.getItem(KEY)) return; } catch (e) { /* ignore */ }
  if ($('installBar')) return;
  const bar = document.createElement('div');
  bar.id = 'installBar';
  const msg = kind === 'ios'
    ? t('Install: tap Share, then Add to Home Screen')
    : t('Install DCSS Manager on your phone');
  bar.innerHTML = '<span>' + (kind === 'ios' ? '📲 ' : '') + msg + '</span>' +
    (kind === 'android' ? '<button id="installGo" class="blue">' + t('Install') + '</button>' : '') +
    '<button id="installX" aria-label="close">✕</button>';
  document.body.appendChild(bar);
  $('installX').onclick = () => dismiss(bar);
  const go = $('installGo');
  if (go) go.onclick = async () => {
    dismiss(bar);
    if (deferred) { deferred.prompt(); try { await deferred.userChoice; } catch (e) { /* ignore */ } deferred = null; }
  };
}

/* touch-primary device (phone/tablet). Desktop Chrome also fires
   beforeinstallprompt, but it has a mouse (pointer: fine) and its own address-bar
   install button, so we never show our phone-oriented hint there. */
const isTouch = () => window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

export function initInstallHint() {
  if (isStandalone()) return;            // already installed — nothing to offer
  if (!isTouch()) return;                // desktop: leave the browser's own install affordance
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();                  // suppress Chrome's mini-infobar; use our button
    deferred = e;
    showBar('android');
  });
  window.addEventListener('appinstalled', () => { const b = $('installBar'); if (b) b.remove(); });
  if (isIOS()) setTimeout(() => showBar('ios'), 2500); // iOS has no event; nudge after load
}
