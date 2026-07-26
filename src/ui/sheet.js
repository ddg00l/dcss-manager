import { $ } from './dom.js';
import { save } from '../core/state.js';
import { sfx } from './audio.js';
import { tileURL } from '../data/tiles.js';
import { RACES } from '../data/races.js';
import { CLASSES } from '../data/classes.js';
import { GODS } from '../data/gods.js';
import { brTag } from '../data/branches.js';
import { comboKey, RARN, starStr } from '../data/combos.js';
import { itemName, itemTile, itemInfo } from '../data/items.js';
import { heroStats } from '../sim/hero.js';
import { memHas } from '../data/memtree.js';
import { POTIONS, SCROLLS, consTile } from '../data/consumables.js';
import { MUTS } from '../data/mutations.js';
import { fmt } from '../core/fmt.js';
import { stackHTML } from './portrait.js';
import { t } from '../i18n/index.js';

const SKILL_N = {
  fighting: 'Fighting', unarmed: 'Unarmed',
  short_blades: 'Short Blades', long_blades: 'Long Blades', axes: 'Axes',
  maces: 'Maces & Flails', polearms: 'Polearms', staves: 'Staves',
  bows: 'Bows', crossbows: 'Crossbows',
  dodging: 'Dodging', armour: 'Armour', stealth: 'Stealth',
  spellcasting: 'Spellcasting', conjurations: 'Conjurations', necromancy: 'Necromancy',
  fire: 'Fire', ice: 'Ice', summonings: 'Summoning',
};
const SLOT_N = {
  weapon: 'weapon', armour: 'armour', shield: 'shield',
  ring1: 'ring 1', ring2: 'ring 2', ring3: 'ring 3', amulet: 'amulet',
};

/** DCSS-style '%'-screen: full attributes, gear and skills of a hero. */
export function openSheet(heroId) {
  const h = save.heroes.find(x => x.id === heroId);
  if (!h) return;
  const st = heroStats(h, save);
  const ck = comboKey(h.race, h.cls);
  const box = $('sheetBox');

  const kv = (k, v) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`;
  const attrs = [
    kv(t('Health'), `${Math.ceil(h.curHp ?? st.hpMax)} / ${st.hpMax}`),
    kv(t('Damage'), Math.floor(st.dmg) + (st.style === 'magic' ? t(' (magic)') : st.style === 'ranged' ? t(' (ranged)') : t(' (melee)'))),
    kv(t('Accuracy'), Math.floor(st.acc)),
    kv(t('AC (armour)'), Math.floor(st.ac)),
    kv(t('EV (evasion)'), Math.floor(st.ev)),
    kv(t('Attack speed'), st.aspd.toFixed(2)),
    kv(t('Crit'), Math.round(st.critc * 100) + '%'),
    kv(t('Lifesteal'), Math.round(st.leech * 100) + '%'),
    kv(t('Regen'), st.regen.toFixed(1) + t('/8 turns')),
    kv(t('Speed'), st.spd.toFixed(2) + 'x'),
    kv(t('Wallet'), '💰 ' + fmt(h.gold || 0)),
    kv(t('Lives'), h.lives),
  ].join('');

  const gear = Object.keys(SLOT_N).filter(slot =>
    slot !== 'ring3' || h.gear.ring3 || memHas(save, 'k_ring3')
  ).map(slot => {
    const it = h.gear[slot];
    if (!it) return `<div class="slotRow"><span class="sl">${t(SLOT_N[slot])}</span><span class="label">${t('— empty —')}</span></div>`;
    const info = itemInfo(it);
    const bits = [];
    if (info.dmgBase) bits.push(t('damage ') + info.dmgBase);
    if (info.ac) bits.push('AC+' + Math.floor(info.ac));
    if (info.ev) bits.push('EV' + (info.ev > 0 ? '+' : '') + info.ev);
    if (info.dmgP) bits.push('+' + Math.round(info.dmgP * 100) + t('% damage'));
    if (info.hp) bits.push('+' + Math.round(info.hp * 100) + '% HP');
    if (info.mul) bits.push(t('ego ×') + info.mul);
    if (info.leech) bits.push(t('lifesteal ') + Math.round(info.leech * 100) + '%');
    if (info.regen) bits.push(t('regen'));
    return `<div class="slotRow"><span class="sl">${t(SLOT_N[slot])}</span>` +
      `<img src="${tileURL(itemTile(it))}" alt="">` +
      `<div class="tInfo"><span class="rar${it.rar}">${itemName(it)}</span>` +
      `<div class="label">${bits.join(' · ') || '—'}</div></div></div>`;
  }).join('');

  const skills = Object.entries(h.skills)
    .filter(([, v]) => v >= 0.5)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `<div class="skillBar"><span>${t(SKILL_N[k] || k)}</span><span class="sv">${v.toFixed(1)}</span></div>`)
    .join('') || `<div class="label">${t('no skills trained yet')}</div>`;

  const inv = Object.entries(h.inv || {}).filter(([, n]) => n > 0).map(([ty, n]) => {
    const def = POTIONS[ty] || SCROLLS[ty];
    const known = (h.known || []).includes(ty);
    const tile = POTIONS[ty] ? POTIONS[ty].t : 'i_scroll';
    return `<div class="slotRow"><img src="${tileURL(tile)}" alt="">` +
      `<div class="tInfo">${known ? t(def.n) : t(def.un) + ` <span class="label">${t('(unidentified)')}</span>`}` +
      ` × ${n}</div></div>`;
  }).join('') || `<div class="label">${t('— empty —')}</div>`;
  const mutHtml = (h.muts || []).map(mk =>
    `<div class="skillBar"><span style="color:${MUTS[mk].good ? 'var(--good)' : 'var(--bad)'}">🧬 ${t(MUTS[mk].n)}</span>` +
    `<span class="label">${t(MUTS[mk].d)}</span></div>`).join('') || `<div class="label">${t('no mutations')}</div>`;
  const stNames = { haste: '⚡ haste', might: '💪 might', berserk: '🔥 berserk',
    resist: '🛡 resistance', brill: '✨ brilliance', agility: '🐇 agility', net: '🕸 netted' };
  const stHtml = Object.keys(h.status || {}).filter(k => h.status[k] > 0)
    .map(k => t(stNames[k] || k) + ' (' + h.status[k] + ')').join(' · ');
  box.innerHTML =
    `<div class="sheetHead">${stackHTML(h,'lg')}` +
    `<div><h2 class="rar${h.rarity}">${h.name}</h2>` +
    `<div class="label">${t(RACES[h.race].n)} ${t(CLASSES[h.cls].n)} · ${t(RARN[h.rarity])}` +
    ` ${starStr(save.stars[ck] || 0)} · XL ${h.xl} · ` +
    (h.state === 'run' ? brTag(h) : h.state === 'camp' ? t('in camp') : h.state) + `</div>` +
    `<div class="label">${t(RACES[h.race].d)} · ${t(CLASSES[h.cls].d)}</div>` +
    (h.god ? `<div class="label" style="color:var(--epic)">✧ ${t(GODS[h.god].n)}${t(' (piety ')}${h.piety}) — ${t(GODS[h.god].d)}</div>` : '') +
    (h.runes.length ? `<div class="label" style="color:var(--rare)">ᚱ ${h.runes.map(r => t(r)).join(', ')}</div>` : '') +
    `</div></div>` +
    `<h3>${t('Attributes')}</h3><div class="sheetCols">${attrs}</div>` +
    `<h3>${t('Gear')}</h3>${gear}` +
    `<h3>${t('Skills')}</h3><div class="sheetCols">${skills}</div>` +
    (stHtml ? `<h3>${t('Statuses')}</h3><div class="label">${stHtml}</div>` : '') +
    `<h3>${t('Inventory')}</h3>${inv}` +
    `<h3>${t('Mutations')}</h3>${mutHtml}` +
    `<button id="sheetClose">${t('Close')}</button>`;

  $('sheet').classList.add('show');
  $('sheetClose').onclick = () => { sfx.ui(); $('sheet').classList.remove('show'); };
}

$('sheet').addEventListener('click', e => {
  if (e.target.id === 'sheet') $('sheet').classList.remove('show');
});
