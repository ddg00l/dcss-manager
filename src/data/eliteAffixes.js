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
/* The Realm of Zot scales to the guild that walks into it, in BOTH directions.
   An account can otherwise stall on the very first Orb and never start the
   meta-loop at all: one seed reached Zot:4 again and again across ten days at
   readiness 12.9 with a prestige bar of 1, and a single victory would have
   opened prestige, Legends and NG. A struggling guild meets a Realm it can
   finish; a titan meets one worth the name. Bounded at both ends. */
/* ZOT_LETHALITY is what makes the Orb an achievement again. Measured before it:
   69% of delves ended in victory, so two expedition slots produced 16 Orbs a day
   and the prestige bar — quoted in days of output — ballooned to 275 Orbs a
   cycle. The Orb of Zot is a life's achievement in the source material; here it
   was a harvest unit.

   The lethality sits on the Realm of Zot alone, deliberately. Runs stay fast and
   everything on the way there still pays (deep floors carry a Memory premium),
   so the change is not "slower", it is "most expeditions do not come back with
   the Orb" — which is what DCSS actually feels like.

   Calibrated by sim at n=12 (8 days each), with the easing working:
     x3.0  8.2 +/-2.2 Orbs/day, 20.2% of delves win, 0.76 prestiges/day, 1/12 dead
     x3.5  6.0 +/-2.0,          13.5%,                0.58,               2/12 dead
   x3.5 ships: victory is roughly one delve in seven, against 69% before any of
   this, and Orbs fall from 16 a day to 6 while the prestige cadence stays inside
   its one-per-1-to-2-days target.

   Two cautions for whoever tunes this next, both learned the hard way here.
   First, n=3 is worthless on this metric: at that size x3.0 measured a 95%
   interval of [0.1 .. 12.9], which cannot distinguish a healthy loop from a dead
   one, and it produced two wrong conclusions in a row -- a phantom cliff at x3.0
   (one unlucky seed) and a 50% overestimate of x3.5. Resolving a 2 Orbs/day
   difference needs n>=9; 1 Orb/day needs n>=35.
   Second, raising lethality without lowering the base of the easing curve makes
   the easing stop easing: it multiplied that base too, so a struggling guild met
   a Realm ~1.9x harder than baseline and simply died. A fresh guild now meets
   Zot at x0.98 and a titan at x7.
   */
export const ZOT_LETHALITY = 3.5;
export const ZOT_EASE_FLOOR = 0.28;
export const ZOT_HARD_CEIL = 2.0;
/* The floor had to drop when lethality went up: multiplying it too meant even a
   struggling guild met a Realm ~1.9x harder than baseline, so the easing stopped
   easing and accounts died outright (2 of 12 never took an Orb at all). At 0.28
   a guild that cannot yet finish Zot meets it at roughly baseline strength,
   while a titan still faces the full multiple. */
export const zotScale = s => ZOT_LETHALITY * Math.min(ZOT_HARD_CEIL,
  Math.max(ZOT_EASE_FLOOR, ZOT_EASE_FLOOR + readiness(s) / 55));

/* Affix level is capped by NG again.

   Letting it follow readiness was the right instinct — a strong guild should
   meet a dangerous dungeon rather than a poorer one — but the version measured
   here overtightened badly. With the ceilings raised alongside it (elites to
   80%, five affixes) accounts stopped being able to start at all: thirty
   simulated days produced two Orbs, and a run that ascended met a hard world
   with a beginner's tree and never took another Orb in the following eighty
   days. Readiness also proved a poor proxy for CURRENT power, since stars are
   eternal and survive an Ascension that wipes everything else.

   Reverted to the NG-capped form until the escalation can be re-derived against
   a measure of power the account actually still has. The Realm of Zot keeps its
   own two-way scaling (zotScale), which was measured separately and is bounded.  */
export const affixLevel = (s, ng) => Math.round(Math.min(ng, readiness(s) + ng * .12));
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
