/* Conflict resolution — pure functions, no I/O, fully unit-tested.
   Saves are compared by a lifetime monotonic vector; the winner is whichever
   strictly dominates. Ties do nothing; genuine disputes surface a dialog. */

export const VECTOR_KEYS = ['wins', 'prestiges', 'memEarned', 'runesTotal', 'kills'];

/** extract the monotonic comparison vector from a save state */
export function vectorOf(s) {
  const st = s.stat || {};
  return {
    wins: st.wins || 0,
    prestiges: s.prestiges || 0,
    memEarned: st.memEarned || 0,
    runesTotal: s.runesTotal || 0,
    kills: st.kills || 0,
  };
}

/** 'local' | 'remote' | 'equal' | 'dispute' */
export function compareVectors(a, b) {
  let aAhead = false, bAhead = false;
  for (const k of VECTOR_KEYS) {
    if ((a[k] || 0) > (b[k] || 0)) aAhead = true;
    else if ((b[k] || 0) > (a[k] || 0)) bAhead = true;
  }
  if (aAhead && bAhead) return 'dispute';
  if (aAhead) return 'local';
  if (bAhead) return 'remote';
  return 'equal';
}

/** decide what to do on pull. localVec/remoteMeta may be null. */
export function resolvePull(localVec, remoteMeta) {
  if (!remoteMeta) return { action: 'push', reason: 'no-remote' };
  const remoteVec = remoteMeta.vector || {};
  const cmp = compareVectors(localVec, remoteVec);
  if (cmp === 'remote') return { action: 'adopt', reason: 'remote-dominates' };
  if (cmp === 'local') return { action: 'push', reason: 'local-dominates' };
  if (cmp === 'equal') return { action: 'none', reason: 'equal' };
  return { action: 'conflict', reason: 'dispute', localVec, remoteVec, remoteMeta };
}

/** has the local save advanced since the last push? (skip no-op uploads) */
export function shouldPush(localVec, lastPushedVec) {
  if (!lastPushedVec) return true;
  return compareVectors(localVec, lastPushedVec) === 'local';
}

export function makeMeta(state, deviceId, deviceName, nowMs) {
  return {
    rev: (state.__syncRev || 0) + 1,
    deviceId, deviceName, ts: nowMs,
    balV: state.balV || 0,
    vector: vectorOf(state),
  };
}
