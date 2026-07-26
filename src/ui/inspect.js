import { $ } from './dom.js';
import { tileURL } from '../data/tiles.js';
import { itemName, itemTile, itemInfo } from '../data/items.js';
import { RARN } from '../data/combos.js';
import { sfx } from './audio.js';
import { t } from '../i18n/index.js';

/* Inspect any item — worn or in the armory — so you can see exactly what a
   randart does before deciding to keep or dismantle it. Numeric effects only;
   the name already carries the base, plus and ego. */
const SLOTN = { weapon: 'Weapon', armour: 'Armour', shield: 'Shield', ring: 'Ring', amulet: 'Amulet' };

function statRows(it) {
  const i = itemInfo(it), rows = [];
  const add = (k, v) => rows.push('<div class="kv"><span>' + k + '</span><b>' + v + '</b></div>');
  if (i.dmgBase != null) add(t('Base damage'), i.dmgBase);
  if (i.ac) add('AC', '+' + Math.floor(i.ac));
  if (i.ev) add('EV', (i.ev > 0 ? '+' : '') + i.ev);
  if (i.dmgP) add(t('Damage'), '+' + Math.round(i.dmgP * 100) + '%');
  if (i.hp) add('HP', '+' + Math.round(i.hp * 100) + '%');
  if (i.acc) add(t('Accuracy'), '+' + i.acc);
  if (i.mag) add(t('Spell power'), '+' + Math.round(i.mag * 100) + '%');
  if (i.mul) add(t('Brand'), '×' + i.mul);
  if (i.aspd) add(t('Attack speed'), '×' + i.aspd);
  if (i.leech) add(t('Lifesteal'), Math.round(i.leech * 100) + '%');
  if (i.regen) add(t('Regeneration'), '✓');
  if (i.res) add(t('Elemental resist'), '✓');
  if (i.pois_res) add(t('Poison resist'), '✓');
  if (i.mr) add(t('Willpower'), '✓');
  if (i.vsUndead) add(t('vs. undead'), '×' + i.vsUndead);
  if (i.retal) add(t('Retaliation'), '✓');
  if (i.chill) add(t('Chill'), '✓');
  if (i.venom) add(t('Venom'), '✓');
  if (i.lantern) add(t('Lantern'), '✓');
  if (i.waders) add(t('Wading'), '✓');
  return rows.join('') || '<div class="label">—</div>';
}

/** open the inspect panel; pass onDismantle to offer scrapping (armory items) */
export function openInspect(it, onDismantle) {
  const box = $('inspectBox');
  const scrap = 2 + it.rar * 2;
  const tag = it.unrandId ? t('UNRAND') : it.rand ? t('RANDART') : '';
  box.innerHTML =
    '<div class="sheetHead"><img src="' + tileURL(itemTile(it)) + '" class="pt">' +
    '<div><div class="nm rar' + it.rar + '">' + itemName(it) + '</div>' +
    '<div class="label">' + t(RARN[it.rar]) + ' · ' + t(SLOTN[it.slot]) + (tag ? ' · ' + tag : '') + '</div></div></div>' +
    '<div class="kvList">' + statRows(it) + '</div>' +
    (onDismantle ? '<button id="inspDis" class="dangerBtn" style="width:100%;margin-top:12px">⚙ ' + t('Dismantle') + ' +' + scrap + '</button>' : '') +
    '<button id="inspClose" style="width:100%;margin-top:8px">' + t('Done') + '</button>';
  $('inspect').classList.add('show');
  const dis = $('inspDis');
  if (dis) dis.onclick = () => { sfx.coin(); onDismantle(); $('inspect').classList.remove('show'); };
  $('inspClose').onclick = () => { sfx.ui(); $('inspect').classList.remove('show'); };
}

$('inspect').addEventListener('click', e => { if (e.target.id === 'inspect') $('inspect').classList.remove('show'); });
