/* Prestige: after a victory the cycle can be reset for Legends ⚜ — a permanent
   currency spent in its own shop. Each prestige also raises the NG+ level.
   Survives a prestige: Hall of Fame, combo stars/shards/collection, unrands
   (both the account flags and the items themselves), zot upgrades, keystones
   of the Memory tree, lifetime stats and the prestige layer itself. */
import { NODES, treeLvl, MASTERY_KEY } from '../data/memtree.js';
import { ascKeepGear, ascKeepTree } from './ascension.js';

/** effective NG+ level: prestiges only. The "New Depth" keystone used to add +1
    here, which made it a 2000-Memory no-op for any account past ng 9 — both the
    monster and the gold scalars are capped there, so the advertised "monsters x2
    stronger, all rewards x2.5, forever" bought literally nothing. It is now its
    own uncapped multiplier (ngPlusMonMul/ngPlusRewardMul) that does what it says. */
export const ngLevel = s => (s.ng || 0);
export const hasNgPlus = s => treeLvl(s, 'k_ngplus') > 0;
export const ngPlusMonMul = s => hasNgPlus(s) ? 2 : 1;
export const ngPlusRewardMul = s => hasNgPlus(s) ? 2.5 : 1;
/* NG+ is only a light seasoning on monsters (capped at +150%): the real
   difficulty valve is the in-cycle hardening that compounds with every Orb
   carried out, measuring the build's actual success instead of account age.
   The first win of a fresh cycle is always within reach — no stalls, and a
   runaway build stops itself: each win makes the next one x1.3 harder */
/* The two NG slopes, in one place and adjustable, because they are the loop.

   Traced day by day, the game leaves its 3-4 Orbs/day band on day 5-6 and reaches
   40-60 a day by day 30 -- a 7x growth from the first third of a run to the last,
   identical across three different play styles, which is the signature of a loop
   rather than of a generous constant. Days 1-5 are correctly paced; everything after
   is the loop outrunning itself.

   Here is why. Per NG level, rewards rise by 1.5 and monsters by 0.1 -- a fifteenfold
   difference in slope -- and the monster term is capped at +100% while the reward term
   runs to +1500%. At NG+6, where a thirty-day account sits, that is x25 rewards
   against x3.2 monsters. The in-cycle hardening was meant to be the difficulty valve,
   but it resets at every prestige, so within a cycle there is a valve and between
   cycles there is none: power accumulates permanently and difficulty does not.

   These are exposed as a tunable object rather than inlined because the response to
   them is threshold-shaped, not smooth -- an earlier attempt in this project solved
   for a lethality constant analytically, predicted 6.4, and measured zero. Constants
   of this kind are swept, not derived. */
export const NG_TUNE = {
  monSlope: 0.1,   /* linear form, kept for reference; unused while monBase > 1 */
  monCap: 1,
  monBase: 1.5,    /* geometric: monsters x monBase^ng -- see the sweep below */
  rewardSlope: 1.5,/* gold added per NG level */
  rewardCap: 10,   /* ...counted over at most this many levels */
};
/* 1.5 was swept, not chosen. Traced over 60 days, Orbs per day:

     stock (linear 0.1)   leaves the 3-4 band on day 8    ends at 84.6/day
     linear 1.4           leaves on day 42                 5.9/day
     geometric 1.3        leaves on day 24                20.9/day
     geometric 1.5        holds all 60 days                2.8/day
     geometric 1.6        holds -- because the account is dead: 0.0/day

   Confirmed across four play styles at 1.5, all inside the band, tails 2.8 to 4.0 a
   day and growth 1.9x to 2.1x on every one of them -- the consistency is what says
   this is a systemic parameter rather than a fit to one build.

   Note what the sweep says about the shape of this problem. Between a working 1.55 and
   a dead 1.6 lies five hundredths: a 6% change in one constant takes the game from
   playable to permanently stalled, because a geometric difficulty racing a geometric
   power is unstable by construction -- whichever grows faster wins outright. This
   constant holds only while nothing else moves player power, and a future keystone or
   a stronger route will move it. The durable answer is difficulty derived from the
   guild's measured strength, as the prestige bar already derives from its measured
   output and endgame pressure from readiness. That is a change of mechanism and is not
   attempted here. */
/* Linear scaling cannot hold a flat Orb rate, and the sweep showed why rather than
   argued it. Raising the linear slope from 0.1 to 1.4 cut the day-60 rate from 74 Orbs
   a day to 6.8 -- an elevenfold improvement -- and still lost the target band on day
   42 instead of day 8, because the curve kept climbing 5.9x across the run. The cap
   turned out to be a phantom knob entirely: 1.4/14 and 1.4/30 returned byte-identical
   numbers, since at NG+8 the slope reaches 11.2 and never meets either ceiling.

   The reason is structural. What the monsters are chasing -- Legends, Ascendancy, the
   tree, star power -- accumulates permanently and multiplies together, so it grows
   geometrically. A term linear in NG falls behind any geometric quantity eventually;
   the only question is which day. So the monster term is given the same shape as the
   thing it exists to answer. */
export const ngMonMul = s => (NG_TUNE.monBase > 1
  ? Math.pow(NG_TUNE.monBase, ngLevel(s))
  : 1 + Math.min(NG_TUNE.monCap, NG_TUNE.monSlope * ngLevel(s))) * ngPlusMonMul(s);

/* In-cycle hardening: a gentle step PER ORB, hard-capped.

   Two failure modes had to be avoided at once, and each earlier attempt hit the
   other. A pure power of the Orb count walls a long cycle (1.07^100 is 868x). A
   pure fraction of the cycle walls a SHORT one instead: with the bar down at its
   floor of 3, reaching the peak over three Orbs meant every victory added ~67%
   difficulty, and accounts took three Orbs in thirty days and then stopped.

   A capped geometric step gives both: ~7% per Orb, familiar and gentle at any
   bar length, and never more than IN_CYCLE_PEAK no matter how long the cycle
   runs. The old prose about fractions of the cycle follows. The last Orb before a prestige is always IN_CYCLE_PEAK times
   harder than the first, whether the cycle is four Orbs long or four hundred.

   It used to be GROWTH^wins, which was fine only while the bar was a small fixed
   number. Now that the bar tracks the guild's own output it can reach the
   hundreds, and any exponent on it would rebuild the wall this entire effort
   began with (1.07^100 is 868x). Tying the arc to progress THROUGH the cycle
   keeps the felt escalation — a cycle is never the same delve on repeat — while
   making that wall structurally impossible. TUNABLE. */
export const IN_CYCLE_PEAK = 3;
export const IN_CYCLE_STEP = 1.07;
export const inCycleMul = s => Math.min(IN_CYCLE_PEAK,
  Math.pow(IN_CYCLE_STEP, Math.max(0, cycleProgress(s).wins)));


export const PUPGRADES = [
  { k: 'p_dmg', n: 'Legendary might', d: '+8% damage for all heroes per lvl', max: 20, base: 3, g: 1.5 },
  { k: 'p_hp', n: 'Legendary vigour', d: '+8% health for all heroes per lvl', max: 20, base: 3, g: 1.5 },
  { k: 'p_memmul', n: 'Echo of cycles', d: '+15% Memory gain per lvl', max: 15, base: 4, g: 1.6 },
  { k: 'p_mem', n: 'Engraved paths', d: 'start each cycle with +600 Memory per lvl', max: 10, base: 5, g: 1.7 },
  { k: 'p_gold', n: 'Old treasury', d: 'start each cycle with +750 gold per lvl', max: 10, base: 3, g: 1.6 },
  { k: 'p_roll', n: 'Famous guild', d: '−5% summon cost per lvl', max: 8, base: 6, g: 1.9 },
  /* The reliquary turns the cost of a prestige from a loss into a decision. Only named
     artefacts used to survive, so a randart won in cycle two burned with everything
     else and the player had no way to see it coming. Now the question is which pieces
     are worth carrying, and the answer is limited on purpose -- an unlimited reliquary
     would simply delete the cost. */
  { k: 'p_relic', n: 'Reliquary', d: 'carry +1 item of your choosing through each prestige', max: 6, base: 4, g: 1.8 },
  { k: 'p_legacy', n: 'Legacy engraving', d: '+1% damage and health per lvl, without limit', max: 9999, base: 50, g: 1.22 },
];
export const pupg = (s, k) => (s.pupg && s.pupg[k]) || 0;
/** How many pieces the guild may carry through a prestige, over and above artefacts. */
export const reliquaryCap = s => pupg(s, 'p_relic');
export const pupgCost = (s, u) => Math.ceil(u.base * Math.pow(u.g, pupg(s, u.k)));

/** progress earned within the current cycle (lifetime stats minus the snapshot) */
export function cycleProgress(s) {
  const b = s.cycBase || { wins: 0, runes: 0, uniq: 0, mem: 0 };
  return {
    wins: (s.stat.wins || 0) - b.wins,
    runes: (s.runesTotal || 0) - b.runes,
    uniq: (s.stat.uniqKills || 0) - b.uniq,
    mem: (s.stat.memEarned || 0) - b.mem,
  };
}

/** Legends granted for the current cycle: long, rich cycles beat quick spam */
export function legendsReward(s) {
  const c = cycleProgress(s);
  if (c.wins < 1) return 0;
  const raw = c.wins * 8 + c.runes * 3 + c.uniq + Math.sqrt(Math.max(0, c.mem) / 50);
  const runner = 1 + .15 * Math.max(0, (s.cycRunnerBest || 0) - 3); /* greed pays */
  /* the NG reward multiplier caps at +500%: difficulty is capped, so an
     uncapped reward would arm a power->cadence->reward runaway loop */
  return Math.max(1, Math.round(raw * runner * (1 + .25 * Math.min(20, ngLevel(s)))));
}

/* the deeper the ladder, the more Orbs a cycle must produce before it can be
   reset: the requirement runs into the in-cycle x1.3 compound, so the prestige
   cadence self-balances against the build's real power — no spam, no stall */
/* The prestige requirement is a SNAPSHOT, locked in when a cycle begins
   (account creation and every doPrestige), never recomputed while the cycle is
   in progress. This is the whole fix for the first-prestige deadlock: the old
   live formula read from readiness, so as a delver banked Orbs it raised its own
   readiness (stars) and the goal it was chasing crept out of reach — win 5, need
   6, freeze forever. A fixed target can always be finished.

   The bar for the NEXT cycle is a function of the account's LIFETIME Orb count
   (stat.wins), not of the current cycle. Because that total only ever climbs and
   is independent of cadence, a prestige-ASAP loop can't keep the bar flat: its
   lifetime total accrues just as fast, so its bar rises just as fast — no
   artificial per-prestige floor needed. Greed still pays, since this cycle's
   Orbs are part of the total. The curve is sqrt (sub-linear) so early cycles stay
   fast and frequent.

   It is now CAPPED, and the cap is not cosmetic. The in-cycle hardening is
   geometric, so a cycle that demands B Orbs demands IN_CYCLE_GROWTH^B power. An
   uncapped bar therefore prices itself out of reach no matter how gently it
   grows — that is precisely how the loop died before (bar 18, cost 55x, every
   tactic frozen). With the cap the hardest cycle the game can ever ask for is a
   fixed constant, and an account that keeps growing keeps clearing it. */
/* The live target, from current output. */
export const livePrestigeReq = s => Math.max(PREST_FLOOR, Math.round(orbRate(s) * TARGET_DAYS));
/* The bar a cycle is actually chasing. The snapshot exists so the goal can never
   RISE under a delver mid-cycle — but a snapshot alone cannot FALL either, and
   that is a deadlock: a bar locked in at 46 Orbs while output was high became
   unreachable when output dropped, and since clearing it is the only way to take
   a new snapshot, the account never prestiged again. Measured: ninety days
   returned exactly what thirty did.
   So it may only ever get easier while you chase it. A brand-new account still
   gets its one-Orb onboarding prestige. */
export const prestigeReq = s => Math.min(s.prestReq || 1, livePrestigeReq(s));
/** requirement for the next cycle, from lifetime Orbs — snapshotted at prestige time */
/* the bar tracks Orbs won SINCE the last Ascension: ascending resets the whole
   power layer, so the requirement resets with it — otherwise a fresh, weak
   post-ascension account faces a lifetime-high bar and the loop dead-ends.
   Accounts that never ascend (ascBase 0) are unaffected. */
/* Hard ceiling on Orbs-per-cycle. The in-cycle hardening is geometric, so this
   cap is what bounds the hardest fight the game can ever demand:
   IN_CYCLE_GROWTH^PREST_CAP (1.18^7 = 3.2x). Without it the bar keeps climbing
   and the required power climbs exponentially with it — the measured death of
   the loop. Raise this and the endgame gets exponentially harder, fast. */
/* The bar is measured in DAYS OF THE GUILD'S OWN OUTPUT, not in a fixed number
   of Orbs. A fixed bar cannot hold a steady cadence, because output is not
   steady: the same build took 12.9 Orbs a day at day eight and 68 a day by day
   twelve, so a 7-Orb bar meant 1.8 prestiges a day early and 5 later. Every
   fixed value is wrong at some point on that curve.

   Expressed as "roughly a day and a half of whatever you currently produce", the
   cadence holds by construction at both ends: a fast guild faces a proportionally
   larger bar, a struggling one a smaller, and neither can be walled or run away.
   PREST_FLOOR still guarantees a reachable first target for a brand-new account.

   TARGET_DAYS is NOT the observed cadence, it is the Orb budget expressed in
   days, and the two differ by more than the escalation alone: the rate is
   smoothed over a day and the bar is snapshotted from it, so while output is
   climbing a cycle finishes against a target set by a lower, older rate. 0.8
   measured out at 3.4 prestiges a day; 3.5 lands in the intended band. A cycle takes longer than budget/rate because the in-cycle escalation
   slows its final Orbs, so 1.5 measured out at one prestige per 2.2-3.7 days.
   0.8 lands inside the design goal of one per one to two days. TUNABLE — this is
   the dial for that goal. */
export const TARGET_DAYS = 3.5;
export const PREST_FLOOR = 3;
export const PREST_ASC_STEP = 4;
export const orbRate = s => Math.max(0, s.orbRate || 0); /* Orbs per day, smoothed */
/* No Ascension term. It used to add PREST_ASC_STEP per ascension as a floor, and
   that floor is independent of output — at twelve ascensions it demanded 51 Orbs
   a cycle from an account producing far fewer, which is the same output-blind
   wall this whole rebalance started from. Measured: the loop stopped dead around
   day 30 and ninety days returned exactly what thirty did.

   Ascension already costs what it costs by wiping the layer, and its power feeds
   output, which raises this bar on its own. Anything that does not scale with
   output does not belong in it. */
export const nextPrestigeReq = s =>
  Math.max(PREST_FLOOR, Math.round(orbRate(s) * TARGET_DAYS));

export const canPrestige = s => cycleProgress(s).wins >= prestigeReq(s);

/** the reset itself; returns the Legends earned or 0 when not allowed */
export function doPrestige(s, keepIds) {
  if (!canPrestige(s)) return 0;
  const reward = legendsReward(s);
  if (reward <= 0) return 0;
  const nextReq = nextPrestigeReq(s); /* lock in next cycle's bar before stats reset */
  s.legends = (s.legends || 0) + reward;
  s.ng = (s.ng || 0) + 1;
  s.prestiges = (s.prestiges || 0) + 1;
  s.prestigesTotal = (s.prestigesTotal || 0) + 1; /* lifetime; Ascension never resets it */

  /* unrand items survive — collect them from the armory and from worn gear.
     Ascension "Engraved Armoury" lets ALL gear survive, not just artefacts. */
  const keepAll = ascKeepGear(s);
  /* the reliquary: named pieces the player chose to carry, capped by the upgrade so the
     choice stays a choice */
  const chosen = new Set((keepIds || []).slice(0, reliquaryCap(s)));
  const survives = it => keepAll || it.unrandId || chosen.has(it.id);
  const keep = s.armory.filter(survives);
  for (const h of s.heroes)
    for (const slot of Object.keys(h.gear || {}))
      if (h.gear[slot] && survives(h.gear[slot])) keep.push(h.gear[slot]);

  s.heroes = [];
  s.armory = keep;
  s.gold = 200 + pupg(s, 'p_gold') * 750;
  s.scrap = 0; s.runes = 0; s.rolls = 0; s.forges = 0; s.pity = 0;
  s.mem = pupg(s, 'p_mem') * 600;
  s.pendingDeaths = []; s.pendingWins = [];
  s.progress = { D: 0, Lair: 0, Swamp: 0, Spider: 0, Orc: 0, Elf: 0, Vaults: 0, Depths: 0, Tomb: 0, Zot: 0, Abyss: 0 };

  /* the tree burns down to its engraved keystones — unless Ascension "Living
     Memory" preserves the whole tree. Keystones are the one thing prestige does
     NOT take: they are the account's engraved mechanics. Ascension, by contrast,
     burns them too — that is the price of the meta-layer. */
  if (!ascKeepTree(s)) {
    const tree = { root: 1 };
    /* Keystones are the account's engraved mechanics and prestige does not take them --
       except the Ways. An oath that outlived the cycle locked the account into one
       region forever, and its multiplier counts nodes owned in that region, which the
       prestige burns: the keystone stayed and its effect fell from x1.60 to x1.03, an
       inert icon rebuilding itself every cycle. Releasing it makes the next cycle a
       fresh question -- which region is this run about? -- which is what a Way was for. */
    const ways = new Set(Object.values(MASTERY_KEY));
    for (const n of NODES)
      if (n.keystone && !ways.has(n.id) && treeLvl(s, n.id) > 0) tree[n.id] = s.tree[n.id];
    s.tree = tree;
  }
  s.rev = (s.rev || 0) + 1; /* tree changed: invalidate stat caches */

  s.cofferBuys = 0; s.zigFunded = 0; s.provisions = {}; /* gold sinks reset each cycle */
  s.darkRolls = 0; /* the dark summoning's escalating price resets with the cycle */
  s.cycRunes = []; /* named runes become collectable again */
  s.cycRunnerBest = 0; s.cycContractDone = 0; /* runner arc and contract reset */
  s.prestReq = nextReq; /* the next cycle's fixed target */
  /* new cycle snapshot */
  s.cycBase = {
    wins: s.stat.wins || 0,
    runes: s.runesTotal || 0,
    uniq: s.stat.uniqKills || 0,
    mem: s.stat.memEarned || 0,
  };
  if (typeof window !== 'undefined' && window.__cloudPush) window.__cloudPush(true);
  return reward;
}
