import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { t, setLang, getLang, DEFAULT_LANG, LANGS } from '../src/i18n/index.js';
import { RU } from '../src/i18n/ru.js';
import { DE } from '../src/i18n/de.js';
import { ES } from '../src/i18n/es.js';
import { UK } from '../src/i18n/uk.js';
import { makeState } from '../src/core/state.js';
import { RACES } from '../src/data/races.js';
import { CLASSES } from '../src/data/classes.js';
import { GODS } from '../src/data/gods.js';
import { MUTS } from '../src/data/mutations.js';
import { POTIONS, SCROLLS } from '../src/data/consumables.js';
import { PORTALS } from '../src/data/portals.js';
import { NODES } from '../src/data/memtree.js';
import { ZUPGRADES } from '../src/core/economy.js';
import { PUPGRADES } from '../src/core/prestige.js';
import { RARN } from '../src/data/combos.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DICTS = { ru: RU, de: DE, es: ES, uk: UK };

afterEach(() => setLang(DEFAULT_LANG));

describe('t() core', () => {
  it('defaults to English and returns canonical strings untranslated', () => {
    expect(DEFAULT_LANG).toBe('en');
    expect(getLang()).toBe('en');
    expect(t('Settings')).toBe('Settings');
  });
  it('translates via dictionaries and falls back to the key when missing', () => {
    setLang('ru');
    expect(t('Settings')).toBe('Настройки');
    expect(t('__no such key__')).toBe('__no such key__');
    setLang('de');
    expect(t('Settings')).toBe('Einstellungen');
  });
  it('interpolates {params} after translation', () => {
    expect(t('{a} + {b} = {a}{b}', { a: 1, b: 2 })).toBe('1 + 2 = 12');
  });
  it('setLang ignores unknown languages', () => {
    setLang('xx');
    expect(getLang()).toBe('en');
  });
  it('all five languages are offered', () => {
    expect(LANGS.map(l => l[0]).sort()).toEqual(['de', 'en', 'es', 'ru', 'uk']);
  });
});

describe('save integration', () => {
  it('fresh saves start in English', () => {
    expect(makeState().lang).toBe('en');
  });
});

/* every t('literal') in src must exist in all four dictionaries */
function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) {
      if (f === 'assets' || f === 'i18n') continue;
      walk(p, out);
    } else if (f.endsWith('.js')) out.push(p);
  }
  return out;
}
const srcFiles = walk(join(ROOT, 'src'));

describe('dictionary coverage', () => {
  it('every t(literal) in src is present in ru/de/es/uk', () => {
    const re = /\bt\((?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\)/g;
    const missing = {};
    for (const p of srcFiles) {
      const src = readFileSync(p, 'utf8');
      for (const m of src.matchAll(re)) {
        const key = (m[1] ?? m[2]).replace(/\\(['"\\])/g, '$1');
        for (const [lg, d] of Object.entries(DICTS)) {
          if (d[key] === undefined) (missing[lg] ??= []).push(key);
        }
      }
    }
    expect(missing).toEqual({});
  });

  it('displayable data strings are translated in every dictionary', () => {
    const keys = [];
    for (const r of Object.values(RACES)) keys.push(r.n, r.d);
    for (const c of Object.values(CLASSES)) keys.push(c.n, c.d);
    for (const g of Object.values(GODS)) keys.push(g.n, g.d);
    for (const m of Object.values(MUTS)) keys.push(m.n, m.d);
    for (const c of Object.values(POTIONS)) keys.push(c.n, c.un);
    for (const c of Object.values(SCROLLS)) keys.push(c.n, c.un);
    for (const p of Object.values(PORTALS)) keys.push(p.n);
    for (const n of NODES) { keys.push(n.n, n.d); if (n.ach) keys.push(n.ach.t); }
    for (const u of ZUPGRADES) keys.push(u.n, u.d);
    for (const u of PUPGRADES) keys.push(u.n, u.d);
    keys.push(...RARN);
    const missing = {};
    for (const [lg, d] of Object.entries(DICTS))
      for (const k of keys)
        if (k && d[k] === undefined) (missing[lg] ??= new Set()).add(k);
    expect(Object.fromEntries(Object.entries(missing).map(([k, v]) => [k, [...v]]))).toEqual({});
  });

  it('index.html data-i18n texts are dictionary keys', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    const re = /data-i18n[^>]*>([^<]+)</g;
    const missing = [];
    for (const m of html.matchAll(re)) {
      const key = m[1].trim();
      if (RU[key] === undefined) missing.push(key);
    }
    expect(missing).toEqual([]);
  });
});

describe('canonical strings are English', () => {
  it('no cyrillic string literals outside src/i18n', () => {
    const bad = [];
    for (const p of srcFiles) {
      let src = readFileSync(p, 'utf8');
      /* strip comments, then look for cyrillic inside quotes */
      src = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
      for (const m of src.matchAll(/['"`]((?:[^'"`\\\n]|\\.){0,200}?[а-яА-ЯёЁіїєґІЇЄҐ](?:[^'"`\\\n]|\\.){0,200}?)['"`]/g))
        bad.push(p.slice(ROOT.length + 1) + ': ' + m[1].slice(0, 60));
    }
    expect(bad).toEqual([]);
  });
});
