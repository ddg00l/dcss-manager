/* Spells — a simplified DCSS caster system. Casters memorise spells from spellbooks
   found in the dungeon and cast them automatically in combat, spending MP (light
   economy: out of MP → fall back to a weak magic dart). Six schools, each a level
   ladder from an L1 starter to an L8-9 capstone, so a caster grows into stronger
   spells as its spellcasting + school skill rise.

   Effect types (kept small so a deep spell list needs little extra combat code):
     bolt   — single-target ranged hit
     aoe    — hits the target and everything adjacent to it (or around the caster)
     drain  — single-target hit that also heals the caster (heal = fraction returned)
     summon — spawns temporary ally/allies (summon:{hd, count?, undead?})
     blink  — repositions the caster out of danger (no damage)
     buff   — a self buff (shroud) or a no-damage control field (slow-all)
   side fields: slow (chill/hex), burn (fire dot), knock (knockback), heal (drain %). */

export const SCHOOLS = {
  conjuration:   { n: 'Conjurations',   skill: 'conjurations',  col: '#c86bd0' },
  fire:          { n: 'Fire',           skill: 'fire',          col: '#e05a3c' },
  ice:           { n: 'Ice',            skill: 'ice',           col: '#5aa2e0' },
  necromancy:    { n: 'Necromancy',     skill: 'necromancy',    col: '#6aa050' },
  summoning:     { n: 'Summonings',     skill: 'summonings',    col: '#d0b04c' },
  translocation: { n: 'Translocation',  skill: 'translocation', col: '#b57edc' },
};

export const SPELLS = {
  /* --- Conjurations: pure magical damage, single → pierce → burst --- */
  magic_dart:     { id: 'magic_dart',     n: 'Magic Dart',                  school: 'conjuration', lvl: 1, mp: 1, type: 'bolt',  pow: 1.0, fx: 'fx_magic_dart', icon: 'sp_magic_dart' },
  force_lance:    { id: 'force_lance',    n: 'Force Lance',                 school: 'conjuration', lvl: 3, mp: 3, type: 'bolt',  pow: 1.3, knock: 1, fx: 'fx_force_lance', icon: 'sp_force_lance' },
  mystic_blast:   { id: 'mystic_blast',   n: "Iskenderun's Mystic Blast",   school: 'conjuration', lvl: 4, mp: 4, type: 'aoe',   pow: 2.0, fx: 'fx_mystic_blast', icon: 'sp_mystic_blast' },
  iron_shot:      { id: 'iron_shot',      n: 'Iron Shot',                   school: 'conjuration', lvl: 6, mp: 6, type: 'bolt',  pow: 3.0, fx: 'fx_iron_shot', icon: 'sp_iron_shot' },
  crystal_spear:  { id: 'crystal_spear', book: 1,  n: "Lehudib's Crystal Spear",     school: 'conjuration', lvl: 8, mp: 8, type: 'bolt',  pow: 4.5, fx: 'fx_crystal_spear', icon: 'sp_crystal_spear' },

  /* --- Fire: bolts, sticky dots and big bursts --- */
  flame_tongue:   { id: 'flame_tongue',   n: 'Flame Tongue',                school: 'fire', lvl: 1, mp: 1, type: 'bolt', pow: 1.1, fx: 'fx_flame_tongue', icon: 'sp_flame_tongue' },
  sticky_flame:   { id: 'sticky_flame',   n: 'Sticky Flame',                school: 'fire', lvl: 3, mp: 3, type: 'bolt', pow: 1.2, burn: 1, fx: 'fx_sticky_flame', icon: 'sp_sticky_flame' },
  fireball:       { id: 'fireball',       n: 'Fireball',                    school: 'fire', lvl: 5, mp: 5, type: 'aoe',  pow: 2.6, burn: 1, fx: 'fx_fireball', icon: 'sp_fireball' },
  bolt_of_fire:   { id: 'bolt_of_fire',   n: 'Bolt of Fire',                school: 'fire', lvl: 6, mp: 6, type: 'bolt', pow: 3.0, fx: 'fx_bolt_of_fire', icon: 'sp_bolt_of_fire' },
  starburst:      { id: 'starburst', book: 1,      n: 'Starburst',                   school: 'fire', lvl: 9, mp: 9, type: 'aoe',  pow: 4.8, burn: 1, fx: 'fx_starburst', icon: 'sp_starburst' },

  /* --- Ice: damage plus slow, single and area --- */
  freeze:         { id: 'freeze',         n: 'Freeze',                      school: 'ice', lvl: 1, mp: 1, type: 'bolt', pow: 1.0, slow: 1, fx: 'fx_freeze', icon: 'sp_freeze' },
  throw_icicle:   { id: 'throw_icicle',   n: 'Throw Icicle',                school: 'ice', lvl: 4, mp: 4, type: 'bolt', pow: 2.1, slow: 1, fx: 'fx_throw_icicle', icon: 'sp_throw_icicle' },
  refrigeration:  { id: 'refrigeration',  n: "Ozocubu's Refrigeration",     school: 'ice', lvl: 6, mp: 6, type: 'aoe',  pow: 2.4, slow: 1, selfaoe: 1, fx: 'fx_refrigeration', icon: 'sp_refrigeration' },
  bolt_of_cold:   { id: 'bolt_of_cold',   n: 'Bolt of Cold',                school: 'ice', lvl: 6, mp: 6, type: 'bolt', pow: 2.7, slow: 1, fx: 'fx_bolt_of_cold', icon: 'sp_bolt_of_cold' },
  glaciate:       { id: 'glaciate', book: 1,       n: 'Glaciate',                    school: 'ice', lvl: 9, mp: 9, type: 'aoe',  pow: 4.5, slow: 1, fx: 'fx_glaciate', icon: 'sp_glaciate' },

  /* --- Necromancy: drain (heal on hit) and raising the dead --- */
  pain:           { id: 'pain',           n: 'Pain',                        school: 'necromancy', lvl: 1, mp: 1, type: 'drain',  pow: 0.9, heal: 0.4, fx: 'fx_pain', icon: 'sp_pain' },
  vampiric:       { id: 'vampiric',       n: 'Vampiric Draining',           school: 'necromancy', lvl: 3, mp: 3, type: 'drain',  pow: 1.3, heal: 0.7, fx: 'fx_vampiric', icon: 'sp_vampiric' },
  death_channel:  { id: 'death_channel',  n: 'Death Channel',               school: 'necromancy', lvl: 4, mp: 4, type: 'summon', pow: 1.0, summon: { hd: 1.0, undead: 1 }, fx: 'fx_death_channel', icon: 'sp_death_channel' },
  bolt_draining:  { id: 'bolt_draining',  n: 'Bolt of Draining',            school: 'necromancy', lvl: 6, mp: 6, type: 'drain',  pow: 2.5, heal: 0.35, fx: 'fx_bolt_draining', icon: 'sp_bolt_draining' },
  haunt:          { id: 'haunt', book: 1,          n: 'Haunt',                       school: 'necromancy', lvl: 7, mp: 7, type: 'summon', pow: 1.0, summon: { hd: 1.5, undead: 1, count: 2 }, fx: 'fx_haunt', icon: 'sp_haunt' },

  /* --- Summonings: temporary allies of growing strength --- */
  summon_mammal:  { id: 'summon_mammal',  n: 'Summon Small Mammal',         school: 'summoning', lvl: 1, mp: 2, type: 'summon', pow: 1.0, summon: { hd: 1.5 }, icon: 'sp_summon_mammal' },
  call_imp:       { id: 'call_imp',       n: 'Call Imp',                    school: 'summoning', lvl: 3, mp: 3, type: 'summon', pow: 1.0, summon: { hd: 2.2 }, icon: 'sp_call_imp' },
  summon_beast:   { id: 'summon_beast',   n: 'Summon Ice Beast',            school: 'summoning', lvl: 5, mp: 5, type: 'summon', pow: 1.0, summon: { hd: 3.0 }, icon: 'sp_summon_beast' },
  menagerie:      { id: 'menagerie',      n: 'Monstrous Menagerie',         school: 'summoning', lvl: 6, mp: 6, type: 'summon', pow: 1.0, summon: { hd: 3.0, count: 2 }, icon: 'sp_menagerie' },
  dragon_call:    { id: 'dragon_call', book: 1,    n: 'Dragon Call',                 school: 'summoning', lvl: 9, mp: 9, type: 'summon', pow: 1.0, summon: { hd: 5.0 }, icon: 'sp_dragon_call' },

  /* --- Translocation: escape and control --- */
  blink:          { id: 'blink',          n: 'Blink',                       school: 'translocation', lvl: 2, mp: 2, type: 'blink', pow: 0, fx: 'fx_blink', icon: 'sp_blink' },
  shroud:         { id: 'shroud',         n: 'Shroud of Golubria',          school: 'translocation', lvl: 4, mp: 4, type: 'buff',  pow: 0, shroud: 1, fx: 'fx_shroud', icon: 'sp_shroud' },
  controlled_blink:{ id: 'controlled_blink', n: 'Controlled Blink',         school: 'translocation', lvl: 5, mp: 5, type: 'blink', pow: 0, safe: 1, fx: 'fx_controlled_blink', icon: 'sp_blink' },
  disjunction:    { id: 'disjunction', book: 1,    n: 'Disjunction',                 school: 'translocation', lvl: 8, mp: 8, type: 'buff',  pow: 0, slowall: 1, fx: 'fx_disjunction', icon: 'sp_disjunction' },
};

export const SPELL_KEYS = Object.keys(SPELLS);
export const spellById = id => SPELLS[id];

/* Spellbooks: themed collections that drop in the dungeon. Finding one lets a
   caster memorise the spells inside that it can handle (see the combat layer). */
export const SPELLBOOKS = {
  book_conjurations: { id: 'book_conjurations', n: 'Book of Conjurations',            school: 'conjuration',   spells: ['crystal_spear'], icon: 'b_conjuration' },
  book_flames:       { id: 'book_flames',       n: 'Book of Flames',                  school: 'fire',          spells: ['starburst'],   icon: 'b_fire' },
  book_frost:        { id: 'book_frost',        n: 'Book of Frost',                   school: 'ice',           spells: ['glaciate'],     icon: 'b_ice' },
  book_necromancy:   { id: 'book_necromancy',   n: 'Book of Necromancy',              school: 'necromancy',    spells: ['haunt'],             icon: 'b_necro' },
  book_callings:     { id: 'book_callings',     n: 'Book of Callings',                school: 'summoning',     spells: ['dragon_call'],   icon: 'b_summon' },
  book_spatial:      { id: 'book_spatial',      n: 'Book of Spatial Translocations',  school: 'translocation', spells: ['disjunction'],                     icon: 'b_transloc' },
};
export const SPELLBOOK_KEYS = Object.keys(SPELLBOOKS);
export const spellbookById = id => SPELLBOOKS[id];

/* the starting spell every caster class knows without a book — its class signature */
export const CLASS_START_SPELL = {
  wizard:      'magic_dart',
  conjurer:    'magic_dart',
  fire_el:     'flame_tongue',
  ice_el:      'freeze',
  necromancer: 'pain',
  summoner:    'summon_mammal',
};

/* ---- caster helpers (pure: read the hero's skills, no combat deps) ---- */

/** spellpower drives spell damage: spellcasting + the spell's own school skill */
export const spellPower = (h, spell) =>
  (h.skills?.spellcasting || 0) + (h.skills?.[SCHOOLS[spell.school].skill] || 0);

/** max MP: a pool from XL and spellcasting (light economy) */
export const mpMaxOf = h => Math.round(3 + (h.xl || 1) * 0.7 + (h.skills?.spellcasting || 0) * 1.2);

/* spells are not learned from books — they UNLOCK by level. A caster knows a spell
   once it trains that school (a class school skill) and its skill clears the gate;
   the school skill grows with XL, so higher spells arrive as the caster matures. */
export const SPELL_GATE = 2.0; /* required (spellcasting + school skill) = lvl × this */
export function spellUnlocked(h, sp) {
  if (sp.book) return (h.spells || []).includes(sp.id); // capstones ONLY come from a book
  const sk = h.skills?.[SCHOOLS[sp.school].skill] || 0;
  if (sk <= 0) return false;                                  // not one of this caster's schools
  return (h.skills?.spellcasting || 0) + sk >= sp.lvl * SPELL_GATE;
}

/** learn a book's capstone if the caster trains that school. Returns learned ids. */
export function learnBook(h, bookId) {
  const book = SPELLBOOKS[bookId];
  if (!book) return [];
  if ((h.skills?.[SCHOOLS[book.school].skill] || 0) <= 0) return []; // wrong aptitude
  h.spells = h.spells || [];
  const learned = [];
  for (const id of book.spells)
    if (!h.spells.includes(id)) { h.spells.push(id); learned.push(id); }
  return learned;
}
/** every spell the hero can currently cast (for the sheet + combat selection) */
export const knownSpells = h => SPELL_KEYS.map(id => SPELLS[id]).filter(sp => spellUnlocked(h, sp));

/** the strongest affordable damage spell for the situation (AOE when foes cluster) */
export function bestDamageSpell(h, clustered, lowHp) {
  const mp = h.mp || 0;
  const known = knownSpells(h)
    .filter(sp => sp.mp <= mp && (sp.type === 'bolt' || sp.type === 'aoe' || sp.type === 'drain'));
  if (!known.length) return null;
  /* a hurt caster prefers a drain (heals); a cluster prefers AOE; else raw power */
  const score = sp => sp.pow
    + (clustered && sp.type === 'aoe' ? 1.5 : 0)
    + (lowHp && sp.type === 'drain' ? 2.0 : 0);
  return known.sort((a, b) => score(b) - score(a))[0];
}

/** the strongest affordable summon spell (summoner/necromancer call spells) */
export function bestSummonSpell(h) {
  const mp = h.mp || 0;
  const known = knownSpells(h).filter(sp => sp.type === 'summon' && sp.summon && sp.mp <= mp);
  if (!known.length) return null;
  return known.sort((a, b) => b.summon.hd - a.summon.hd)[0];
}
