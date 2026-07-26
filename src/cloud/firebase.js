/* Firebase auth + Firestore save storage. The web config is public by design
   (it ships in the page); access is protected by Firestore security rules, not
   by hiding the config. Firebase keeps a refresh token in IndexedDB and renews
   the session silently for months — no per-hour re-login, no popup on reload. */
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAWZQJ9ZTxN3ubBSHZKU1ph4sX2FHbO-yc',
  authDomain: 'dcss-manager-e4668.firebaseapp.com',
  projectId: 'dcss-manager-e4668',
  storageBucket: 'dcss-manager-e4668.firebasestorage.app',
  messagingSenderId: '608254799255',
  appId: '1:608254799255:web:9d8c8164d889da128c28d2',
};

let app = null, auth = null, db = null, user = null;

export const cloudAvailable = () =>
  typeof location !== 'undefined' && location.protocol.startsWith('http');

function ensure() {
  if (app) return;
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

/** resolves once Firebase has restored (or confirmed the absence of) a session */
export function watchAuth(cb) {
  if (!cloudAvailable()) return;
  ensure();
  onAuthStateChanged(auth, u => { user = u; cb(u); });
}

/** Sign in with Google via popup. Firebase 12 completes the popup over
    postMessage even when a Cross-Origin-Opener-Policy warning is logged for the
    window.closed poll, so that warning is benign. Errors carry a .code
    (e.g. auth/unauthorized-domain) that the caller surfaces for diagnosis. */
export async function signIn() {
  ensure();
  const provider = new GoogleAuthProvider();
  const res = await signInWithPopup(auth, provider);
  user = res.user;
  return user;
}
export async function signOut() { if (auth) await fbSignOut(auth); user = null; }
export const isSignedIn = () => !!user;
export const currentUser = () => user;

/* The save holds nested arrays (floor grids, rune lists, logs) that Firestore
   rejects, so the whole state is stored as one JSON string field. meta stays a
   plain object (flat, no nested arrays) for cheap conflict comparison. */

/** read the cloud save document, or null */
export async function readState() {
  if (!user) return null;
  const snap = await getDoc(doc(db, 'saves', user.uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  try { return d.saveJson ? JSON.parse(d.saveJson) : (d.save || null); }
  catch { return null; }
}
/** write the whole save under the user's uid */
export async function writeState(state, meta) {
  if (!user) return;
  await setDoc(doc(db, 'saves', user.uid), {
    saveJson: JSON.stringify(state),
    meta, ts: Date.now(),
  });
}
/** delete the cloud save (for a full reset) */
export async function deleteState() {
  if (!user) return;
  await deleteDoc(doc(db, 'saves', user.uid));
}
