/* Firebase auth + Firestore save storage. The web config is public by design
   (it ships in the page); access is protected by Firestore security rules, not
   by hiding the config. Firebase keeps a refresh token in IndexedDB and renews
   the session silently for months — no per-hour re-login, no popup on reload. */
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithRedirect, signInWithPopup, getRedirectResult, signOut as fbSignOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

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

/** resolves once Firebase has restored (or confirmed the absence of) a session.
    Also finalizes a redirect sign-in and surfaces its error, if any. */
export function watchAuth(cb, onError) {
  if (!cloudAvailable()) return;
  ensure();
  /* complete a pending redirect sign-in (no-op on a normal load) */
  getRedirectResult(auth).catch(e => onError && onError(e));
  onAuthStateChanged(auth, u => { user = u; cb(u); });
}

/** Sign in with Google. Uses the redirect flow, which is immune to the
    Cross-Origin-Opener-Policy that breaks popup sign-in on some hosts; the page
    navigates to Google and back, and onAuthStateChanged fires with the user.
    Falls back to popup only if redirect cannot start. */
export async function signIn() {
  ensure();
  const provider = new GoogleAuthProvider();
  try {
    await signInWithRedirect(auth, provider); // navigates away; resolves rarely
  } catch (e) {
    const res = await signInWithPopup(auth, provider);
    user = res.user;
    return user;
  }
}
export async function signOut() { if (auth) await fbSignOut(auth); user = null; }
export const isSignedIn = () => !!user;
export const currentUser = () => user;

/** read the cloud save document, or null */
export async function readState() {
  if (!user) return null;
  const snap = await getDoc(doc(db, 'saves', user.uid));
  return snap.exists() ? snap.data().save : null;
}
/** write the whole save under the user's uid */
export async function writeState(state, meta) {
  if (!user) return;
  await setDoc(doc(db, 'saves', user.uid), { save: state, meta, ts: Date.now() });
}
