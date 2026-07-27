/* Qualitative escalation: elite monster affixes and floor affixes.
   Depth stops being a number — it becomes combinatorics. Elites carry personal
   affixes (Diablo-style), floors carry their own; the pool and intensity grow
   slowly and endlessly with NG+, while raw stat multipliers stay softly capped.

   Family colors (canvas auras): tactical=violet, aggressive=red,
   defensive=blue, antibuild=gold. */

export const ELITE_AFFIXES = {
  /* --- tactical: change the geometry of the fight --- */
  blinker:    { fam: 'tactical', n: 'Blinker', d: 'teleports away when struck', col: '#b57edc' },
  caller:     { fam: 'tactical', n: 'Caller', d: 'wakes and pulls the whole floor toward the fight', col: '#b57edc' },
  raiser:     { fam: 'tactical', n: 'Bonecaller', d: 'raises slain monsters back once', col: '#b57edc' },
  /* --- aggressive: punish carelessness --- */
  volatile:   { fam: 'aggressive', n: 'Volatile', d: 'explodes on death', col: '#e05252' },
  painaura:   { fam: 'aggressive', n: 'Pain aura', d: 'burns the hero every turn nearby', col: '#e05252' },
  vampiric:   { fam: 'aggressive', n: 'Vampiric', d: 'heals off every hit it lands', col: '#e05252' },
  enrage:     { fam: 'aggressive', n: 'Furious', d: 'attacks twice as fast below half health', col: '#e05252' },
  /* --- defensive: demand variety --- */
  shielded:   { fam: 'defensive', n: 'Shielded', d: 'ignores the first three hits', col: '#5aa2e0' },
  phasing:    { fam: 'defensive', n: 'Phasing', d: 'every third hit passes through it', col: '#5aa2e0' },
  stoneskin:  { fam: 'defensive', n: 'Stoneskin', d: 'takes half damage below a third of health', col: '#5aa2e0' },
  /* --- antibuild: hard counters that ask for a different hero --- */
  antimagic:  { fam: 'antibuild', n: 'Antimagic', d: 'spells deal half damage to it', col: '#e0c05a' },
  thorns:     { fam: 'antibuild', n: 'Thorned', d: 'melee attackers take a fifth of dealt damage back', col: '#e0c05a' },
  reflector:  { fam: 'antibuild', n: 'Mirrored', d: 'ranged shots sometimes bounce back', col: '#e0c05a' },
};
export const ELITE_KEYS = Object.keys(ELITE_AFFIXES);

export const FLOOR_AFFIXES = {
  /* --- environmental: interact with races, resists and gear --- */
  darkness: { n: 'Darkness', d: 'sight is cut to a few tiles (a lantern ego negates it)', col: '#6a5a9a' },
  flooded:  { n: 'Flooded', d: 'everyone but merfolk wades at half speed (waders negate it)', col: '#4a7ac0' },
  miasma:   { n: 'Miasma', d: 'poison seeps every turn (rPois shrugs it off)', col: '#6aa050' },
  /* --- structural: change navigation itself --- */
  maze:     { n: 'Maze', d: 'a dense labyrinth of corridors', col: '#a08050' },
  cursed:   { n: 'Cursed ground', d: 'traps are twice as common and stay hidden', col: '#905090' },
};
export const FLOOR_KEYS = Object.keys(FLOOR_AFFIXES);

/* Affix pressure scales with PLAYER POWER, not account age. The effective level
   is min(NG, readiness): a player who out-prestiged their build faces affixes
   capped at what their persistent power can handle — no mid-game wall — while a
   player who kept pace gets the full NG intensity. Softened peak vs the first
   pass (max 3 affixes, ~40% floor chance). Coefficients tuned by 30-day sim. */
export function readiness(s) {
  const greatCount = s.vic ? (Object.keys(s.vic.races).length + Object.keys(s.vic.classes).length) : 0;
  /* per-hero power, not build breadth: the single strongest combo's stars plus a
     damped contribution from the rest, so a wide roster of 1-star combos doesn't
     read as a god-tier account and get max affixes + max prestige requirement */
  let starMax = 0, starTotal = 0;
  if (s.stars) for (const k in s.stars) { const v = s.stars[k]; starTotal += v; if (v > starMax) starMax = v; }
  const starPower = starMax * 2 + Math.sqrt(Math.max(0, starTotal - starMax));
  const legacy = s.pupg ? ((s.pupg.p_legacy || 0) + (s.pupg.p_dmg || 0) + (s.pupg.p_hp || 0)) : 0;
  let zot = 0; if (s.zupg) for (const k in s.zupg) zot += s.zupg[k];
  return greatCount * .35 + starPower * 1.5 + legacy * .5 + zot * .5;
}
/* Affix level tracks readiness, but a floor rising with NG guarantees that a
   low-readiness build (wide/dilute army) can never permanently outrun affix
   pressure by staying "unready" — the deeper the ladder, the more the floor
   drags the effective level up toward NG. Surgical: when readiness >= ng the
   min() still picks ng (focused mid-game unchanged); it only bites the
   deep-and-wide runaway regime where readiness lagged far behind NG. */
export const affixLevel = (s, ng) => Math.round(Math.min(ng, readiness(s) + ng * .12));
/* the escalation curves now take the effective affix level, not raw NG */
export const eliteChance = lvl => Math.min(.48, .05 + .02 * lvl);
export const eliteAffixCount = lvl => 1 + Math.min(3, Math.floor(lvl / 10));
export const floorAffixChance = lvl => Math.min(.48, .07 + .022 * lvl);

/** roll elite affixes for a monster (floor rng keeps it deterministic per seed) */
export function rollEliteAffixes(ng, rng) {
  const n = eliteAffixCount(ng);
  const out = [];
  let guard = 0;
  while (out.length < n && guard++ < 20) {
    const k = ELITE_KEYS[Math.floor(rng() * ELITE_KEYS.length)];
    if (!out.includes(k)) out.push(k);
  }
  return out;
}
