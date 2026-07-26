/* Google Identity Services token client. The Client ID is public (ships in the
   page). Empty CLIENT_ID → cloud sync is simply unavailable and the UI hides it. */
export const CLIENT_ID = '956422962544-ngambde0gq00gqdoa89rsubssa8jeq5h.apps.googleusercontent.com';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const GIS = 'https://accounts.google.com/gsi/client';

let tokenClient = null, token = null, tokenExp = 0, profile = null;

export const cloudAvailable = () =>
  !!CLIENT_ID && typeof location !== 'undefined' && location.protocol.startsWith('http');

function loadGis() {
  return new Promise((res, rej) => {
    if (window.google && window.google.accounts) return res();
    const sc = document.createElement('script');
    sc.src = GIS; sc.async = true; sc.defer = true;
    sc.onload = res; sc.onerror = () => rej(new Error('GIS load failed'));
    document.head.appendChild(sc);
  });
}

/** interactive sign-in (prompt) or silent renewal (prompt:'') */
export async function signIn(interactive = true) {
  if (!cloudAvailable()) throw new Error('cloud unavailable');
  await loadGis();
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID, scope: SCOPE,
        callback: (r) => {
          if (r.error) return reject(new Error(r.error));
          token = r.access_token;
          tokenExp = Date.now() + (r.expires_in || 3600) * 1000 - 60000;
          resolve(token);
        },
      });
    }
    tokenClient.requestAccessToken({ prompt: interactive ? 'consent' : '' });
  });
}

/** a valid token, renewing silently if it has expired */
export async function getToken() {
  if (token && Date.now() < tokenExp) return token;
  return signIn(false);
}

export function signOut() { token = null; tokenExp = 0; profile = null; }
export const isSignedIn = () => !!token && Date.now() < tokenExp;
