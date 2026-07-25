import { RACES } from '../data/races.js';
import { WEP_BASES, ARM_BASES, SH_BASES } from '../data/items.js';
import { tileURL } from '../data/tiles.js';

/** DCSS-style layered player tile: base race + body(armour) + hand1(weapon) + hand2(shield). */
export function heroLayers(h) {
  const L = [RACES[h.race].t];
  const g = h.gear;
  if (g.armour) { const b = ARM_BASES.find(x => x.k === g.armour.base); if (b && b.ov) L.push(b.ov); }
  if (g.weapon) { const b = WEP_BASES.find(x => x.k === g.weapon.base); if (b && b.ov) L.push(b.ov); }
  const twoH = g.weapon && WEP_BASES.find(x => x.k === g.weapon.base)?.h2;
  if (g.shield && !twoH) { const b = SH_BASES.find(x => x.k === g.shield.base); if (b && b.ov) L.push(b.ov); }
  return L;
}

/** HTML stack of <img> layers; cls: '' (36px) | 'sm' (22px) | 'lg' (48px). */
export function stackHTML(h, cls) {
  return '<span class="tileStack ' + (cls || '') + '">' +
    heroLayers(h).map(k => '<img src="' + tileURL(k) + '" alt="">').join('') + '</span>';
}
