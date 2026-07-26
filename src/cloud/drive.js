/* Google Drive appDataFolder I/O — pure browser fetch, no SDK.
   The save file lives in the hidden per-app folder: invisible in the user's
   Drive, removed with the app, unreachable by other apps. */
import { gzipAsync, gunzipAsync } from './gzip.js';

const FILE = 'dcss-save.json.gz';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

async function api(token, url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + token, ...(opts.headers || {}) } });
  if (!r.ok) throw new Error('drive ' + r.status + ' ' + (await r.text()).slice(0, 120));
  return r;
}

/** find our save file id (or null) */
export async function findFile(token) {
  const q = encodeURIComponent(`name='${FILE}' and 'appDataFolder' in parents and trashed=false`);
  const r = await api(token, `${API}/files?spaces=appDataFolder&fields=files(id)&q=${q}`);
  const j = await r.json();
  return j.files && j.files[0] ? j.files[0].id : null;
}

/** read only the meta header cheaply (still downloads the blob — saves are ~20KB) */
export async function readMeta(token) {
  const state = await readState(token);
  return state ? state.__meta || null : null;
}

/** download and inflate the full save state, or null if none exists */
export async function readState(token) {
  const id = await findFile(token);
  if (!id) return null;
  const r = await api(token, `${API}/files/${id}?alt=media`);
  const buf = new Uint8Array(await r.arrayBuffer());
  return JSON.parse(await gunzipAsync(buf));
}

/** upload a save state (gzipped); meta rides inside as state.__meta.
    pin=true marks this Drive revision to be kept forever (milestone). */
export async function writeState(token, state, meta, pin) {
  const payload = { ...state, __meta: meta };
  const body = await gzipAsync(JSON.stringify(payload));
  const id = await findFile(token);
  const metadata = id ? {} : { name: FILE, parents: ['appDataFolder'] };
  const boundary = 'dcsssync' + (state.masterSeed || 0);
  const pre = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/gzip\r\n\r\n`;
  const post = `\r\n--${boundary}--`;
  const blob = new Blob([pre, body, post], { type: 'multipart/related; boundary=' + boundary });
  const url = id
    ? `${UPLOAD}/files/${id}?uploadType=multipart&fields=id`
    : `${UPLOAD}/files?uploadType=multipart&fields=id`;
  const r = await api(token, url, { method: id ? 'PATCH' : 'POST', body: blob });
  const j = await r.json();
  if (pin && j.id) {
    /* keep this milestone revision forever; cap pinned history at 10 */
    await pinLatestRevision(token, j.id).catch(() => {});
  }
  return j.id;
}

async function pinLatestRevision(token, fileId) {
  const r = await api(token, `${API}/files/${fileId}/revisions?fields=revisions(id,keepForever)`);
  const revs = (await r.json()).revisions || [];
  const last = revs[revs.length - 1];
  if (last) await api(token, `${API}/files/${fileId}/revisions/${last.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keepForever: true }),
  });
  const pinned = revs.filter(x => x.keepForever);
  for (let i = 0; i < pinned.length - 9; i++)
    await api(token, `${API}/files/${fileId}/revisions/${pinned[i].id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keepForever: false }),
    }).catch(() => {});
}
