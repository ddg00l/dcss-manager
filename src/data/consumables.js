import { t } from '../i18n/index.js';
/* DCSS potions and scrolls. Types are unidentified for a hero until first use
   (identification is per-hero, like per-game in DCSS). */

export const POTIONS = {
  curing:   { n: 'potion of curing',      un: 'a murky potion',       t: 'pot_curing',   w: 26 },
  heal:     { n: 'potion of heal wounds',    un: 'a crimson potion',     t: 'pot_heal',     w: 14 },
  haste:    { n: 'potion of haste',      un: 'a sparkling potion',   t: 'pot_haste',    w: 9 },
  might:    { n: 'potion of might',     un: 'a smoking potion',    t: 'pot_might',    w: 11 },
  berserk:  { n: 'potion of berserk rage',         un: 'a black potion',       t: 'pot_berserk',  w: 7 },
  resist:   { n: 'potion of resistance',  un: 'a silvery potion',  t: 'pot_resist',   w: 7 },
  brill:    { n: 'potion of brilliance',         un: 'an opalescent potion',     t: 'pot_brill',    w: 7 },
  agility:  { n: 'potion of agility',       un: 'an emerald potion',   t: 'pot_agility',  w: 9 },
  mutation: { n: 'potion of mutation',        un: 'a fizzy potion',      t: 'pot_mutation', w: 4 },
};
export const SCROLLS = {
  teleport: { n: 'scroll of teleportation',        un: 'scroll «ZELGO MER»',    w: 13 },
  blink:    { n: 'scroll of blinking',              un: 'scroll «VY LURO»',      w: 11 },
  ench_w:   { n: 'scroll of enchant weapon',  un: 'scroll «XOB GAKH»',     w: 9 },
  ench_a:   { n: 'scroll of enchant armour',   un: 'scroll «ITA NAZG»',     w: 9 },
  brand:    { n: 'scroll of brand weapon',       un: 'scroll «PHOL ENDE»',    w: 4 },
  mapping:  { n: 'scroll of magic mapping',         un: 'scroll «COMP TERRA»',   w: 9 },
  fear:     { n: 'scroll of fear',              un: 'scroll «AAARGH»',       w: 7 },
  acquire:  { n: 'scroll of acquirement',           un: 'scroll «WONK ELBE»',    w: 2 },
  identify: { n: 'scroll of identify',           un: 'scroll «ID ENTIA»',     w: 15 },
};
export const PKEYS = Object.keys(POTIONS);
export const SKEYS = Object.keys(SCROLLS);

export function consName(c, known) {
  const def = c.kind === 'potion' ? POTIONS[c.type] : SCROLLS[c.type];
  return t(known ? def.n : def.un);
}
export function consTile(c) {
  return c.kind === 'potion' ? POTIONS[c.type].t : 'i_scroll';
}
/** random consumable, weighted */
export function randConsumable(rng) {
  const potTotal = PKEYS.reduce((a, k) => a + POTIONS[k].w, 0);
  const scrTotal = SKEYS.reduce((a, k) => a + SCROLLS[k].w, 0);
  const isPot = rng() < 0.55;
  const keys = isPot ? PKEYS : SKEYS, defs = isPot ? POTIONS : SCROLLS;
  let r = rng() * (isPot ? potTotal : scrTotal);
  for (const k of keys) { r -= defs[k].w; if (r <= 0) return { kind: isPot ? 'potion' : 'scroll', type: k }; }
  return { kind: isPot ? 'potion' : 'scroll', type: keys[0] };
}
