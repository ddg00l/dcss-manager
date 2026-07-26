import { $ } from './dom.js';
import { save, persist } from '../core/state.js';
import { sfx } from './audio.js';
import { tileURL } from '../data/tiles.js';
import { RACES } from '../data/races.js';
import { CLASSES } from '../data/classes.js';
import { itemName, itemTile, itemInfo, scoreItem } from '../data/items.js';
import { heroStats, ringSlotKeys } from '../sim/hero.js';
import { stackHTML } from './portrait.js';
import { t } from '../i18n/index.js';

const SLOT_N = {
  weapon: 'Weapon', armour: 'Armour', shield: 'Shield',
  ring1: 'Ring 1', ring2: 'Ring 2', ring3: 'Ring 3', ring4: 'Ring 4',
  ring5: 'Ring 5', ring6: 'Ring 6', ring7: 'Ring 7', ring8: 'Ring 8', amulet: 'Amulet',
};
const slotLabel = sl => t(SLOT_N[sl] || sl);
let heroId = null, selSlot = null;

const score = it => scoreItem(it, hero());
const bits = it => {
  const i = itemInfo(it), b = [];
  if (i.dmgBase) b.push(t('damage ') + i.dmgBase);
  if (i.ac) b.push('AC+' + Math.floor(i.ac));
  if (i.ev) b.push('EV' + (i.ev > 0 ? '+' : '') + i.ev);
  if (i.dmgP) b.push('+' + Math.round(i.dmgP * 100) + t('% damage'));
  if (i.hp) b.push('+' + Math.round(i.hp * 100) + '% HP');
  if (i.mul) b.push(t('ego ×') + i.mul);
  if (i.leech) b.push(t('lifesteal ') + Math.round(i.leech * 100) + '%');
  if (i.regen) b.push(t('regen'));
  return b.join(' · ') || '—';
};
function hero() { return save.heroes.find(x => x.id === heroId); }
function slots(h) {
  const out = ['weapon', 'armour', 'shield', ...ringSlotKeys(h, save), 'amulet'];
  return out.filter(sl =>
    !(sl === 'weapon' && RACES[h.race].nowep) &&
    !(sl === 'armour' && RACES[h.race].noarm));
}
function refreshHp(h) {
  if (h.state !== 'run') return;
  const st = heroStats(h, save);
  h.maxHpCache = st.hpMax;
  h.curHp = Math.min(h.curHp, st.hpMax);
}

export function openEquip(id) {
  heroId = id; selSlot = null;
  render();
  $('equip').classList.add('show');
  import('./ftue.js').then(m => m.maybeTour('equip'));
}
function close() { $('equip').classList.remove('show'); window.__renderAll(); }

function render() {
  const h = hero();
  if (!h) return close();
  const box = $('equipBox');
  if (selSlot) return renderPicker(h, box);
  const rows = slots(h).map(sl => {
    const it = h.gear[sl];
    const fits = save.armory.filter(a => a.slot === (sl.startsWith('ring') ? 'ring' : sl)).length;
    return `<div class="slotRow eqRow" data-slot="${sl}">` +
      `<span class="sl">${slotLabel(sl)}</span>` +
      (it ? `<img src="${tileURL(itemTile(it))}" alt="">` +
        `<div class="tInfo"><span class="rar${it.rar}">${itemName(it)}</span>` +
        `<div class="label">${bits(it)}</div></div>` :
        `<div class="tInfo"><span class="label">${t('— empty —')}</span></div>`) +
      `<span class="label">${fits ? fits + t(' in armory ›') : '›'}</span></div>`;
  }).join('');
  box.innerHTML =
    `<div class="sheetHead">${stackHTML(h, 'lg')}` +
    `<div><h2 class="rar${h.rarity}">${h.name}</h2>` +
    `<div class="label">${t(RACES[h.race].n)} ${t(CLASSES[h.cls].n)}${t(' · equipment')}</div></div></div>` +
    rows +
    `<div class="rowBtns" style="margin-top:12px">` +
    `<button id="eqBest">${t('Equip best')}</button>` +
    `<button id="eqClose">${t('Done')}</button></div>`;
  box.querySelectorAll('.eqRow').forEach(r => {
    r.onclick = () => { sfx.ui(); selSlot = r.dataset.slot; render(); };
  });
  $('eqClose').onclick = () => { sfx.ui(); close(); };
  $('eqBest').onclick = async () => {
    const { equipBestFromArmory } = await import('../sim/tick.js');
    equipBestFromArmory(h, save);
    refreshHp(h);
    sfx.forge(); persist(); render();
  };
}

function renderPicker(h, box) {
  const sl = selSlot;
  const want = sl.startsWith('ring') ? 'ring' : sl;
  const cur = h.gear[sl];
  const curScore = cur ? score(cur) : -1;
  const cands = save.armory.filter(a => a.slot === want)
    .sort((a, b) => score(b) - score(a));
  const rowFor = (it, isCur) => {
    const better = !isCur && score(it) > curScore;
    return `<div class="slotRow"><img src="${tileURL(itemTile(it))}" alt="">` +
      `<div class="tInfo"><span class="rar${it.rar}">${itemName(it)}${better ? ' <b style="color:var(--good)">↑</b>' : ''}</span>` +
      `<div class="label">${bits(it)}</div></div>` +
      (isCur ?
        `<button class="eqOff" style="min-height:32px;padding:4px 10px;font-size:10px">${t('Unequip')}</button>` :
        `<button class="eqOn" data-id="${it.id}" style="min-height:32px;padding:4px 10px;font-size:10px">${t('Equip')}</button>`) +
      `</div>`;
  };
  box.innerHTML =
    `<h2>${slotLabel(sl)} — ${h.name}</h2>` +
    `<h3>${t('Currently equipped')}</h3>` +
    (cur ? rowFor(cur, true) : `<div class="label" style="margin:6px 0">${t('— empty —')}</div>`) +
    `<h3>${t('Armory (')}${cands.length})</h3>` +
    (cands.map(it => rowFor(it, false)).join('') ||
      `<div class="label">${t('No matching items — forge some or wait for drops.')}</div>`) +
    `<button id="eqBack" style="width:100%;margin-top:12px">${t('‹ Back')}</button>`;
  $('eqBack').onclick = () => { sfx.ui(); selSlot = null; render(); };
  const off = box.querySelector('.eqOff');
  if (off) off.onclick = () => {
    save.armory.push(cur);
    h.gear[sl] = null;
    refreshHp(h); sfx.ui(); persist(); render();
  };
  box.querySelectorAll('.eqOn').forEach(b => {
    b.onclick = () => {
      const it = save.armory.find(a => a.id === b.dataset.id);
      if (!it) return;
      if (cur) save.armory.push(cur);
      save.armory.splice(save.armory.indexOf(it), 1);
      h.gear[sl] = it;
      refreshHp(h); sfx.forge(); persist(); render();
    };
  });
}

$('equip').addEventListener('click', e => {
  if (e.target.id === 'equip') close();
});
