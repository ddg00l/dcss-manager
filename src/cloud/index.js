/* Cloud sync orchestrator: wires auth + drive + resolution into the game.
   Auto-pull on boot/tab-return, auto-push on milestones/interval/tab-hide,
   with a conflict callback the UI renders as a dialog. */
import { CLIENT_ID, cloudAvailable, signIn, signOut, getToken, isSignedIn } from './auth.js';
import { readState, readMeta, writeState } from './drive.js';
import { resolvePull, shouldPush, makeMeta, vectorOf } from './sync.js';

export { cloudAvailable, isSignedIn, CLIENT_ID };

const OPT_KEY = 'dcss.cloudOptIn';
const setOptIn = v => { try { v ? localStorage.setItem(OPT_KEY, '1') : localStorage.removeItem(OPT_KEY); } catch {} };
const optedIn = () => { try { return localStorage.getItem(OPT_KEY) === '1'; } catch { return false; } };
/* a returning user whose token has expired: the UI shows a re-login banner */
export const sessionExpired = () => optedIn() && !isSignedIn();
export async function reconnect(getSave, applyState) {
  await signIn(); setOptIn(true); await pull(getSave, applyState);
}

/** interactive sign-in; remembers the choice so future reloads restore silently */
export async function connect() {
  const tok = await signIn();
  setOptIn(true);
  return tok;
}
export function disconnect() { setOptIn(false); signOut(); }

let onConflict = null, onStatus = null, lastPushedVec = null, pushTimer = 0;
const DEVICE_ID = 'dev-' + (Math.floor(Math.random() * 1e9) >>> 0).toString(36);
const deviceName = () => {
  const ua = navigator.userAgent || '';
  return /Mobi|Android|iPhone/.test(ua) ? 'phone' : /iPad|Tablet/.test(ua) ? 'tablet' : 'desktop';
};

export function initCloud(hooks) {
  onConflict = hooks.onConflict; onStatus = hooks.onStatus;
}
const status = (k, extra) => onStatus && onStatus(k, extra);

/** adopt a remote state into the running game (UI passes an applier) */
async function pull(getSave, applyState, force) {
  if (!cloudAvailable()) return;
  if (!isSignedIn()) { if (optedIn()) status('expired'); return; }
  const token = getToken();
  if (!token) { if (optedIn()) status('expired'); return; }
  const meta = await readMeta(token);
  const decision = resolvePull(vectorOf(getSave()), meta);
  if (decision.action === 'conflict' && !force) {
    const remote = await readState(token);
    onConflict && onConflict({
      local: vectorOf(getSave()), remote: decision.remoteVec, remoteMeta: meta,
      adopt: () => { applyState(remote); lastPushedVec = vectorOf(remote); status('synced'); },
      keepLocal: () => push(getSave, true),
    });
    return;
  }
  if (decision.action === 'adopt') {
    const remote = await readState(token);
    applyState(remote); lastPushedVec = vectorOf(remote); status('synced');
  } else if (decision.action === 'push') {
    await push(getSave, true);
  } else status('synced');
}

/** upload local, optionally pinning a milestone revision */
async function push(getSave, pin) {
  if (!cloudAvailable()) return;
  if (!isSignedIn()) { if (optedIn() && pin) status('expired'); return; }
  const save = getSave();
  const vec = vectorOf(save);
  if (!pin && !shouldPush(vec, lastPushedVec)) return;
  const token = getToken();
  if (!token) { if (optedIn() && pin) status('expired'); return; }
  const meta = makeMeta(save, DEVICE_ID, deviceName(), Date.now());
  save.__syncRev = meta.rev;
  await writeState(token, save, meta, pin);
  lastPushedVec = vec; status('synced');
}

/* public triggers used by main.js / ui */
export const cloudPull = (getSave, applyState, force) =>
  pull(getSave, applyState, force).catch(e => status('error', e.message));
export const cloudPush = (getSave, milestone) =>
  push(getSave, milestone).catch(e => status('error', e.message));

export function startAutoSync(getSave, applyState) {
  if (!cloudAvailable()) return;
  const onVisible = () => {
    if (document.visibilityState === 'visible') cloudPull(getSave, applyState);
    else cloudPush(getSave, false);
  };
  document.addEventListener('visibilitychange', onVisible);
  clearInterval(pushTimer);
  pushTimer = setInterval(() => cloudPush(getSave, false), 10 * 60 * 1000);
  /* a persisted token (reused from a recent load) makes this silent; if it has
     expired, pull simply no-ops until the next user-gesture sign-in — no popup */
  cloudPull(getSave, applyState);
}
