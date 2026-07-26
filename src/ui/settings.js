import { $ } from './dom.js';
import { save, persist } from '../core/state.js';
import { sfx } from './audio.js';
import { t, setLang, getLang, applyStatic, LANGS } from '../i18n/index.js';
import { cloudAvailable, isSignedIn, connect, disconnect, cloudPush, cloudPull } from '../cloud/index.js';
import { exportSaveFile } from '../cloud/export.js';

let cloudMsg = '';
const applyRemote = st => { Object.assign(save, st); persist(); window.__renderAll(); applyStatic(); };

export function openSettings() {
  const box = $('settingsBox');
  box.innerHTML =
    `<h2>${t('Settings')}</h2>` +
    `<h3>${t('Language')}</h3>` +
    `<select id="setLang">` +
    LANGS.map(([code, name]) =>
      `<option value="${code}"${getLang() === code ? ' selected' : ''}>${name}</option>`).join('') +
    `</select>` +
    `<h3>${t('Sound')}</h3>` +
    `<label class="setRow"><input type="checkbox" id="setSnd"${save.muted ? '' : ' checked'}> ` +
    `<span>${t('Sound effects')}</span></label>` +
    cloudSection() +
    `<button id="setClose" style="width:100%;margin-top:16px">${t('Done')}</button>`;
  $('settings').classList.add('show');
  $('setLang').onchange = () => {
    save.lang = $('setLang').value;
    setLang(save.lang);
    persist();
    applyStatic();
    window.__renderAll();
    openSettings(); /* redraw the settings window itself in the new language */
  };
  $('setSnd').onchange = () => {
    save.muted = !$('setSnd').checked;
    persist();
    if (!save.muted) sfx.ui();
  };
  wireCloud();
  $('setClose').onclick = () => { sfx.ui(); $('settings').classList.remove('show'); };
}

function cloudSection() {
  let inner;
  if (!cloudAvailable()) {
    inner = `<div class="label">${t('Cloud sync is available on the web version')}</div>` +
      `<button id="setExport" style="width:100%;margin-top:6px">${t('Export save to file')}</button>`;
  } else if (isSignedIn()) {
    inner = `<div class="label" id="cloudStatus">${cloudMsg || t('Synced')}</div>` +
      `<div class="rowBtns" style="margin-top:6px">` +
      `<button id="setPush">${t('Upload now')}</button><button id="setPull">${t('Download')}</button></div>` +
      `<button id="setExport" style="width:100%;margin-top:6px">${t('Export save to file')}</button>` +
      `<button id="setSignout" style="width:100%;margin-top:6px">${t('Sign out')}</button>`;
  } else {
    inner = `<div class="label">${cloudMsg || t('Sign in to sync progress across devices')}</div>` +
      `<button id="setSignin" style="width:100%;margin-top:6px">${t('Sign in with Google')}</button>` +
      `<button id="setExport" style="width:100%;margin-top:6px">${t('Export save to file')}</button>`;
  }
  return `<h3>${t('Cloud sync')}</h3>${inner}`;
}
function wireCloud() {
  const ex = $('setExport'); if (ex) ex.onclick = () => { sfx.ui(); exportSaveFile(save); };
  const si = $('setSignin'); if (si) si.onclick = async () => {
    sfx.ui(); cloudMsg = t('Signing in…'); openSettings();
    try { await connect(); await cloudPull(() => save, applyRemote); cloudMsg = t('Synced'); }
    catch (e) { cloudMsg = t('Sign-in failed'); }
    openSettings();
  };
  const so = $('setSignout'); if (so) so.onclick = () => { sfx.ui(); disconnect(); cloudMsg = ''; openSettings(); };
  const pu = $('setPush'); if (pu) pu.onclick = async () => { sfx.ui(); cloudMsg = t('Uploading…'); openSettings(); await cloudPush(() => save, true); cloudMsg = t('Synced'); openSettings(); };
  const pl = $('setPull'); if (pl) pl.onclick = async () => { sfx.ui(); cloudMsg = t('Downloading…'); openSettings(); await cloudPull(() => save, applyRemote, false); cloudMsg = t('Synced'); openSettings(); };
}
export function setCloudMsg(m) { cloudMsg = m; if ($('settings').classList.contains('show')) openSettings(); }

$('settings').addEventListener('click', e => {
  if (e.target.id === 'settings') $('settings').classList.remove('show');
});
