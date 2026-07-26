/* Cloud sync orchestrator over Firebase. Firebase keeps the session alive
   silently (refresh token in IndexedDB), so there is no token expiry to manage:
   we simply react to auth state, pull on sign-in/tab-return, push on
   milestones/interval/tab-hide, and surface genuine disputes to a dialog. */
import { cloudAvailable, watchAuth, signIn, signOut, isSignedIn, readState, writeState } from './firebase.js';
import { resolvePull, shouldPush, makeMeta, vectorOf } from './sync.js';
import { pruneSave } from '../core/state.js';

export { cloudAvailable, isSignedIn };

let onConflict = null, onStatus = null, lastPushedVec = null, pushTimer = 0;
let getSaveRef = null, applyStateRef = null;
const DEVICE_ID = 'dev-' + (Math.floor(Math.random() * 1e9) >>> 0).toString(36);
const deviceName = () => {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  return /Mobi|Android|iPhone/.test(ua) ? 'phone' : /iPad|Tablet/.test(ua) ? 'tablet' : 'desktop';
};
const status = (k, extra) => onStatus && onStatus(k, extra);

export function initCloud(hooks) { onConflict = hooks.onConflict; onStatus = hooks.onStatus; }

/** interactive sign-in, then reconcile */
export async function connect() {
  await signIn();
  status('synced');
  if (getSaveRef) await pull(getSaveRef, applyStateRef);
}
export async function disconnect() { await signOut(); status('signedout'); }

let _remoteCache = null;
/* Firestore has no cheap meta-only read; the doc is ~20KB, so read it whole and
   reuse it for the conflict/adopt path. */
async function metaOnly() {
  _remoteCache = await readState();
  return _remoteCache ? _remoteCache.__meta || { vector: vectorOf(_remoteCache) } : null;
}

async function pull(getSave, applyState) {
  if (!isSignedIn()) return;
  const meta = await metaOnly();
  const decision = resolvePull(vectorOf(getSave()), meta);
  if (decision.action === 'conflict') {
    const remote = _remoteCache;
    onConflict && onConflict({
      local: vectorOf(getSave()), remote: decision.remoteVec, remoteMeta: meta || {},
      adopt: () => { applyState(remote); lastPushedVec = vectorOf(remote); status('synced'); },
      keepLocal: () => push(getSave, true),
    });
    return;
  }
  if (decision.action === 'adopt') {
    if (_remoteCache) { applyState(_remoteCache); lastPushedVec = vectorOf(_remoteCache); }
    status('synced');
  } else if (decision.action === 'push') {
    await push(getSave, true);
  } else status('synced');
}

async function push(getSave, milestone) {
  if (!isSignedIn()) return;
  const save = getSave();
  pruneSave(save); /* never upload accumulated dead heroes */
  const vec = vectorOf(save);
  if (!milestone && !shouldPush(vec, lastPushedVec)) return;
  const meta = makeMeta(save, DEVICE_ID, deviceName(), Date.now());
  save.__syncRev = meta.rev; save.__meta = meta;
  await writeState(save, meta);
  lastPushedVec = vec; status('synced');
}

export const cloudPull = (getSave, applyState) => pull(getSave, applyState).catch(e => status('error', e.message));
export const cloudPush = (getSave, milestone) => push(getSave, milestone).catch(e => status('error', e.message));

export function startAutoSync(getSave, applyState) {
  if (!cloudAvailable()) return;
  getSaveRef = getSave; applyStateRef = applyState;
  /* Firebase restores the session on its own; pull once it reports a user */
  watchAuth(u => {
    status(u ? 'synced' : 'signedout');
    if (u) cloudPull(getSave, applyState);
  });
  const onVisible = () => {
    if (document.visibilityState === 'visible') cloudPull(getSave, applyState);
    else cloudPush(getSave, false);
  };
  document.addEventListener('visibilitychange', onVisible);
  clearInterval(pushTimer);
  pushTimer = setInterval(() => cloudPush(getSave, false), 10 * 60 * 1000);
}
