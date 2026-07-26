/* Conflict dialog: two saves each ahead somewhere → the player chooses.
   The losing save is already pinned to Drive revisions before overwrite. */
import { $ } from './dom.js';
import { t } from '../i18n/index.js';
import { sfx } from './audio.js';

export function openConflict({ local, remote, remoteMeta, adopt, keepLocal }) {
  let box = $('conflict');
  if (!box) {
    box = document.createElement('div');
    box.id = 'conflict'; box.className = 'overlay';
    box.innerHTML = '<div class="panelBox" id="conflictBox"></div>';
    document.body.appendChild(box);
  }
  const row = (label, a, b) =>
    `<div class="kv"><span>${label}</span><b>${a}</b><b style="margin-left:12px">${b}</b></div>`;
  $('conflictBox').innerHTML =
    `<h2>${t('Save conflict')}</h2>` +
    `<div class="label">${t('This device and the cloud both moved ahead. Pick which to keep — the other is saved to cloud history and can be restored.')}</div>` +
    `<div class="kv"><span></span><b>${t('This device')}</b><b style="margin-left:12px">${t('Cloud')} (${remoteMeta.deviceName || '?'})</b></div>` +
    row(t('Victories'), local.wins, remote.wins) +
    row(t('Prestiges'), local.prestiges, remote.prestiges) +
    row(t('Memory'), local.memEarned, remote.memEarned) +
    row(t('Runes'), local.runesTotal, remote.runesTotal) +
    `<div class="rowBtns" style="margin-top:14px">` +
    `<button id="cfLocal">${t('Keep this device')}</button>` +
    `<button id="cfRemote" class="blue">${t('Use cloud')}</button></div>`;
  box.classList.add('show');
  $('cfLocal').onclick = () => { sfx.ui(); box.classList.remove('show'); keepLocal(); };
  $('cfRemote').onclick = () => { sfx.ui(); box.classList.remove('show'); adopt(); };
}
