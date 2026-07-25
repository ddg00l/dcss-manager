/* i18n, gettext style: canonical strings are ENGLISH (source language).
   Dictionaries map en → target. Placeholders look like {name}. */
import { RU } from './ru.js';
import { DE } from './de.js';
import { ES } from './es.js';
import { UK } from './uk.js';

const DICTS = { ru: RU, de: DE, es: ES, uk: UK, en: null };
export const LANGS = [
  ['en', 'English'], ['de', 'Deutsch'], ['es', 'Español'],
  ['ru', 'Русский'], ['uk', 'Українська'],
];
export const DEFAULT_LANG = 'en';

let lang = DEFAULT_LANG;
export function setLang(l) { if (DICTS[l] !== undefined) lang = l; }
export function getLang() { return lang; }

/** Translate a canonical (English) string and interpolate {params}. */
export function t(str, params) {
  const d = DICTS[lang];
  let s = (d && d[str] !== undefined) ? d[str] : str;
  if (params) for (const k in params) s = s.split('{' + k + '}').join(params[k]);
  return s;
}

/** Translate static markup: elements carrying data-i18n (text) / data-i18n-html (innerHTML). */
export function applyStatic() {
  for (const el of document.querySelectorAll('[data-i18n]')) {
    if (!el.dataset.orig) el.dataset.orig = el.textContent.trim();
    el.textContent = t(el.dataset.orig);
  }
  for (const el of document.querySelectorAll('[data-i18n-html]')) {
    if (!el.dataset.orig) el.dataset.orig = el.innerHTML.trim();
    el.innerHTML = t(el.dataset.orig);
  }
}
