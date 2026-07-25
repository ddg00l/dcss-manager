import { $ } from './dom.js';
import { save, persist } from '../core/state.js';
import { sfx } from './audio.js';
import { t, setLang, getLang, applyStatic, LANGS } from '../i18n/index.js';

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
  $('setClose').onclick = () => { sfx.ui(); $('settings').classList.remove('show'); };
}

$('settings').addEventListener('click', e => {
  if (e.target.id === 'settings') $('settings').classList.remove('show');
});
