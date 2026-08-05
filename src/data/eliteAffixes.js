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
/** How much of the day's omen a guild actually feels.

    The daily affix landed at full strength on a brand-new account. Three of the five
    days are harsher than calm, so a player starting on the wrong one met Day of Titans
    -- monsters at +60% health and +25% damage -- in their first minute, with no tree,
    no stars and one seeker, and nothing to tell them that tomorrow would be easier or
    that the day before would have been. Whether the game is fair depended on the date
    they happened to install it.

    The endgame already scales to the guild rather than to the calendar (see
    endgamePressure and readiness below). The weather does the same now: a young guild
    plays in near-calm and grows into the full swing of the days. The LOOT side is left
    alone -- a newcomer stumbling into a gold rush should enjoy it. */
const AFFIX_FULL = 12;   /* readiness at which the day is felt in full */
export const affixWeight = s => Math.max(0, Math.min(1, readiness(s) / AFFIX_FULL));
/** the day's monster modifiers as this particular guild experiences them */
export const feltAffix = (s, afx) => ({
  ...afx,
  monHp: 1 + (afx.monHp - 1) * affixWeight(s),
  monDmg: 1 + (afx.monDmg - 1) * affixWeight(s),
});

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

   Calibrated against a target of 3-4 Orbs a day, on the convex ramp:
     L=4.5  5.88 Orbs/day, 9.0% win, seeds consistent
     L=4.9  4.50,          6.9%,     seeds 4.3/3.5/5.9/4.4  <- chosen
     L=5.3  2.25,          3.0%,     seeds 4.6/0.1/3.4/0.9  BIMODAL
     L=5.7  2.56,          3.2%,     seeds 5.5/0.1/0.1/4.5  BIMODAL
     L=6.4  0.13,          0.1%      dead
   Above ~5.0 the population splits: some accounts never get going at all. The
   means at 5.3 and 5.7 land closer to the target on paper, but they are means
   over "half thrive, half die", which is the exact trap this rebalance spent a
   day escaping. 4.9 overshoots the band slightly and keeps every seed alive,
   which is the better trade.

   A note on method: extrapolating this constant from an elasticity fitted to two
   points predicted 6.4 for 3.5 Orbs/day. Measured, 6.4 produces zero. The
   response is threshold-shaped, not a power law -- heroes die before reaching
   the content the constant was meant to govern, so it must be swept, never
   solved.
   */
/* Where the endgame begins to bite, and where it peaks. Concentrating all the
   lethality on the Realm of Zot made a cliff: every delve died at the same
   place, at the last step, which is both the least informative death a player
   can have and the reason outcomes were binary. Heroes are homogeneous, so a
   single threshold means either the whole guild clears it or none of it does —
   there is no "one delve in twenty" regime to be had from a wall.

   Ramping the same pressure across the second half of a run spreads deaths over
   a range of depths instead. Runs then differ from one another, which is the
   variance the win rate needs, and a player watching a seeker die on Depths:3
   learns something a death on Zot:5 never told them.

   It starts well before the Vaults on purpose. Beginning at Vaults:1 left the
   whole mid-game unpressured and still bunched the deaths late; from depth 8 the
   climb is longer, so a given late floor is harder and the spread reaches
   further. Young guilds are not punished by this: the magnitude is readiness-
   scaled, so a fresh account meets roughly baseline strength anyway. */
export const ENDGAME_FROM = 8;    /* mid-Dungeon / Lair — the pressure starts here */
export const ENDGAME_PEAK = 26;   /* Zot:5 — and reaches zotScale() here */

export const ZOT_LETHALITY = 4.9;
export const ZOT_EASE_FLOOR = 0.28;
/* How far readiness may push the endgame UP. The easing was designed to work
   downward: a young guild must not stall forever on its first Orb. It scales both ways
   though, and a ceiling of 2.0 means a guild that invests in stars, Legends and Zot
   upgrades meets a Zot:5 nearly four times harsher than a modest one does -- 8.5x
   against 2.3x. Investment then buys nothing at the wall; you run to stand still, and
   the Vaults-to-Zot stretch is where the t-squared ramp puts most of that increase.
   Swept rather than argued, like the NG slopes: ZOT_TUNE='{"hardCeil":1.0}'. */
export const ZOT_TUNE = {
  hardCeil: 2.0,
  density: 0,   /* extra monsters on a Zot floor, over the usual 5-10 */
  curve: 2,     /* how sharply the endgame ramp leans toward its peak */
  /* Fewer arrivals, better seekers. Orbs a day is arrivals at the Gates times the share
     that come back out, and at 2.8% the second term WAS the pacing: the guild made its
     target by feeding Zot forty bodies a day. Emptying the Zot crowd lifts that share to
     nearly 7%, which is a fight rather than a queue -- and then the first term has to
     come down, or the loop runs four times its target. This scales how fast a seeker
     delves, so fewer runs finish per day without a single fight becoming harder. */
  pace: 1,
};
export const ZOT_HARD_CEIL = 2.0;
/* The floor had to drop when lethality went up: multiplying it too meant even a
   struggling guild met a Realm ~1.9x harder than baseline, so the easing stopped
   easing and accounts died outright (2 of 12 never took an Orb at all). At 0.28
   a guild that cannot yet finish Zot meets it at roughly baseline strength,
   while a titan still faces the full multiple. */
export const zotScale = s => ZOT_LETHALITY * Math.min(ZOT_TUNE.hardCeil,
  Math.max(ZOT_EASE_FLOOR, ZOT_EASE_FLOOR + readiness(s) / 55));
/** endgame pressure at a given depth: 1x until Vaults, rising to zotScale at Zot:5 */
/* The ramp is CONVEX, not linear, and that is the whole reason the peak can be
   raised at all. A linear climb from depth 8 means the peak also sets mid-game
   difficulty: at ZOT_LETHALITY 6.4 the Lair alone reached x3.6, heroes died at
   depth 8-13 in 71% of cases, and the run produced zero Orbs — the guild never
   reached the endgame to be tested by it. Squaring the progress keeps the middle
   gentle (Lair ~x1.6 at the same peak) while the last floors carry nearly all of
   the increase, so raising the ceiling makes Zot harder instead of making the
   Lair lethal. */
export const ENDGAME_CURVE = 2; /* superseded by ZOT_TUNE.curve; kept for readers */
export const endgamePressure = (s, depth) => {
  const t = Math.min(1, Math.max(0, (depth - ENDGAME_FROM) / (ENDGAME_PEAK - ENDGAME_FROM)));
  return 1 + (zotScale(s) - 1) * Math.pow(t, ZOT_TUNE.curve);
};

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
