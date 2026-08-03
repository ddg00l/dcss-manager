import { $ } from './dom.js';
import { save, persist } from '../core/state.js';
import { sfx } from './audio.js';
import { t, setLang, getLang, applyStatic, LANGS } from '../i18n/index.js';
import { cloudAvailable, isSignedIn, connect, disconnect, cloudPush, cloudPull, cloudDelete } from '../cloud/index.js';
import { resetSave, importSave } from '../core/state.js';
import { exportSaveFile, importSaveFile } from '../cloud/export.js';

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
    `<h3>${t('Danger zone')}</h3>` +
    `<button id="setReset" class="dangerBtn" style="width:100%">${t('Reset save')}</button>` +
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
  $('setReset').onclick = async () => {
    sfx.ui();
    /* double confirmation: this is irreversible and wipes the cloud too */
    if (!confirm(t('Reset everything and start over? All progress — heroes, upgrades, prestige, the Hall of Fame — is permanently lost.'))) return;
    if (!confirm(t('Are you absolutely sure? This cannot be undone.'))) return;
    const btn = $('setReset'); btn.disabled = true; btn.textContent = t('Resetting…');
    try { if (cloudAvailable() && isSignedIn()) await cloudDelete(); } catch (e) { /* already surfaced */ }
    resetSave();
    cloudMsg = '';
    window.__renderAll();
    applyStatic();
    $('settings').classList.remove('show');
  };
  $('setClose').onclick = () => { sfx.ui(); $('settings').classList.remove('show'); };
}

function cloudSection() {
  let inner;
  if (!cloudAvailable()) {
    inner = `<div class="label">${t('Cloud sync is available on the web version')}</div>` +
      `<button id="setExport" style="width:100%;margin-top:6px">${t('Export save to file')}</button>` +
      `<button id="setImport" style="width:100%;margin-top:6px">${t('Import save from file')}</button>`;
  } else if (isSignedIn()) {
    inner = `<div class="label" id="cloudStatus">${cloudMsg || t('Synced')}</div>` +
      `<div class="rowBtns" style="margin-top:6px">` +
      `<button id="setPush">${t('Upload now')}</button><button id="setPull">${t('Download')}</button></div>` +
      `<button id="setExport" style="width:100%;margin-top:6px">${t('Export save to file')}</button>` +
      `<button id="setImport" style="width:100%;margin-top:6px">${t('Import save from file')}</button>` +
      `<button id="setSignout" style="width:100%;margin-top:6px">${t('Sign out')}</button>`;
  } else {
    inner = `<div class="label">${cloudMsg || t('Sign in to sync progress across devices')}</div>` +
      `<button id="setSignin" style="width:100%;margin-top:6px">${t('Sign in with Google')}</button>` +
      `<button id="setExport" style="width:100%;margin-top:6px">${t('Export save to file')}</button>` +
      `<button id="setImport" style="width:100%;margin-top:6px">${t('Import save from file')}</button>`;
  }
  return `<h3>${t('Cloud sync')}</h3>${inner}`;
}
function wireCloud() {
  const ex = $('setExport'); if (ex) ex.onclick = () => { sfx.ui(); exportSaveFile(save); };
  /* Export existed without an import, so a save could be taken out and never put back:
     no moving between devices, no recovering after a cleared browser, and no help at
     all to a player whose progress lives under a different address -- localStorage is
     per origin, and localhost, a LAN address and the published site are three of them. */
  const im = $('setImport'); if (im) im.onclick = () => {
    sfx.ui();
    const f = document.createElement('input');
    f.type = 'file'; f.accept = 'application/json,.json';
    f.onchange = async () => {
      const file = f.files && f.files[0];
      if (!file) return;
      try {
        const obj = await importSaveFile(file);
        const who = (obj.stat && obj.stat.wins) || 0;
        if (!confirm(t('Replace the current save with this file? Orbs carried: ') + who +
                     t('. The save being replaced is kept and can still be exported.'))) return;
        importSave(obj);
        window.__renderAll(); applyStatic(); openSettings();
      } catch (e) {
        console.error('save import:', e);
        alert(t('That file is not a DCSS Manager save.'));
      }
    };
    f.click();
  };
  const si = $('setSignin'); if (si) si.onclick = async () => {
    sfx.ui(); cloudMsg = t('Signing in…'); openSettings();
    try { await connect(); await cloudPull(() => save, applyRemote); cloudMsg = t('Synced'); }
    catch (e) { console.error('cloud sign-in:', e); cloudMsg = t('Sign-in failed') + ': ' + (e.code || e.message || ''); }
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
