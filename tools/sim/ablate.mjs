/* Controlled ablation: vary ONE decision at a time on IDENTICAL seeds (CRN) and
   measure how much it actually changes the outcome.

   This exists because the 14 named tactics in worker.mjs differ along several
   axes at once, so they cannot answer "does this choice matter?". A tactic that
   wins more may simply be prestiging on a different schedule. Ablations hold
   everything else fixed, which is the only way to price a single decision.

   What it already found: route classic vs speedrun = 2% (noise), caution 7% and
   non-monotonic, spend non-monotonic, i.e. three of the player-facing selectors
   were statistically indistinguishable from placebo, while the Memory-tree
   choice moved outcomes 2x. Re-run after any change that claims to give a
   decision weight — the target is a spread no smaller than ~1.5x.

   Usage:  node tools/sim/ablate.mjs <axis> [sessions] [days]
           node tools/sim/ablate.mjs all 8 30
   Axes:   attention | caution | spend | route | tree | ascend
   Output: NDJSON, one line per variant (mean over `sessions` paired seeds).  */
import { session } from './worker.mjs';

/* the control tactic every axis perturbs — a plain engaged player */
const SEED_BASE = parseInt(process.env.SEED_BASE || '0', 10);

const BASE = {
  checkin: 300, tree: 'balanced', route: 'iron', caution: 'normal',
  rollFactor: 1, goldReserve: 0, forge: false, prestige: true, prestigeAfter: 2,
};

export const AXES = {
  /* how much is paying attention actually worth? */
  attention: [['5min', { checkin: 300 }], ['30min', { checkin: 1800 }], ['2h', { checkin: 7200 }],
              ['6h', { checkin: 21600 }], ['24h', { checkin: 86400 }]],
  caution:   [['cowardly', { caution: 'cautious' }], ['normal', { caution: 'normal' }], ['reckless', { caution: 'bold' }]],
  spend:     [['thrifty', { spend: 'thrifty' }], ['balanced', { spend: 'balanced' }], ['lavish', { spend: 'lavish' }]],
  /* The roads are near-equal in length and differ in what they YIELD, so this axis
     is judged on loot composition, not on Orbs -- an Orb spread here is a FAILURE,
     it means the selector went back to being a tempo control. */
  route:     [['iron', { route: 'iron' }], ['wild', { route: 'wild' }], ['arcane', { route: 'arcane' }]],
  /* the speedrun is openly a tempo choice, so it is measured as one */
  tempo:     [['full road', { route: 'iron' }], ['short road', { route: 'speed', caution: 'bold' }]],
  /* Specialists against generalists. The old variant list could not answer the
     question the tree poses -- balanced, slots and combat_fair all bought expedition
     slots first and then differed on stat noise, so the axis measured 1.70x where it
     needs 3x. These variants commit to one region and take its mastery keystone. */
  tree:      [['spread', { tree: 'balanced' }], ['slots', { tree: 'slots' }],
              ['keystones', { tree: 'keystones' }],
              ['m:combat', { tree: 'master_combat' }],
              ['m:dungeon', { tree: 'master_dungeon' }],
              ['m:economy', { tree: 'master_economy' }],
              /* the control: same builds, oath refused */
              ['spread-noM', { tree: 'balanced', noOath: true }],
              ['m:econ-noM', { tree: 'master_economy', noOath: true }]],
  /* is the Ascension layer worth taking at all? tactic.ascend===false opts out */
  ascend:    [['ascend ON', {}], ['ascend OFF', { ascend: false }]],
};

/** run one axis; returns a row per variant with means over paired seeds */
export function ablate(axis, sessions, days) {
  const rows = [];
  for (const [label, patch] of AXES[axis]) {
    const tac = { ...BASE, ...patch };
    const rs = [];
    for (let i = 0; i < sessions; i++) {
      /* Cost is super-linear in days, because a session's work scales with the
         Orbs it wins and an unbalanced economy wins exponentially more of them:
         measured 5 days = 10s / 54 Orbs but 10 days = 42s / 472 Orbs. A single
         30-day sweep ran past 90 minutes on CI for this reason alone. Report
         each session's cost so a runaway is visible in the log immediately
         instead of looking like a stuck job. */
      const t0 = Date.now();
      /* Honour SEED_BASE. The workflow gives each shard its own base so the two
         explore different accounts; ignoring it made both shards run seeds 0..N
         and return byte-identical rows — double the CI cost for zero extra
         information, and a seed list that looked twice as large as it was. */
      const r = session(tac, days, SEED_BASE + i); /* same seeds per variant */
      rs.push(r);
      console.error(`[${axis}/${label}] seed ${i + 1}/${sessions} · ` +
        `${((Date.now() - t0) / 1000).toFixed(1)}s · ${r.wins} Orbs`);
    }
    const avg = k => rs.reduce((a, r) => a + (r[k] || 0), 0) / rs.length;
    /* wins earned in the LAST 10 days: 0 means the account has hard-stalled,
       which a cumulative total cannot reveal */
    const tail = days > 10
      ? rs.reduce((a, r) => a + (r.byDay[days - 1].wins - r.byDay[days - 11].wins), 0) / rs.length
      : null;
    /* The per-seed spread matters as much as the mean, and a mean hides it
       completely. This loop's accounts do not cluster around their average:
       they split into a fast mode and a stalled one, and the same constant can
       produce 70 Orbs or 2482 depending only on the seed. Reporting just the
       centre made that invisible and cost several rounds of chasing phantom
       tuning. Ship the whole distribution and let the report judge it. */
    /* Days to the first Orb. Orbs-per-window turned out to be the wrong instrument
       for anything but the tempo axis: an account that crosses the three-Orb
       prestige threshold inside the window compounds and one that misses it by a day
       does not, so the SAME road measured 2 Orbs on one seed and 15 on the next. The
       window was amplifying a threshold, not reading a road. Time to the first Orb
       has no threshold in it. */
    const firstOrb = rs.map(r => {
      const i = r.byDay.findIndex(d => d.wins > 0);
      return i < 0 ? days + 1 : i + 1;
    });
    const perSeed = rs.map(r => r.wins).sort((a, b) => a - b);
    const at = q => perSeed[Math.min(perSeed.length - 1, Math.floor(q * perSeed.length))];
    rows.push({
      axis, label, sessions, days,
      wins: +avg('wins').toFixed(2), prestiges: +avg('prestiges').toFixed(2),
      ascensions: +avg('ascensions').toFixed(2), depth: +avg('depth').toFixed(1),
      deaths: +avg('deaths').toFixed(1), mem: Math.round(avg('mem')),
      gold: Math.round(avg('gold')), winsLast10d: tail === null ? null : +tail.toFixed(2),
      winsPerSeed: perSeed, median: at(0.5), lo: perSeed[0], hi: perSeed[perSeed.length - 1],
      stalledSeeds: perSeed.filter(w => w === 0).length,
      /* Per-axis metrics. Judging every control by Orbs per day is what flattened
         them: four different decisions competing in one number can only be
         equalised, and balancing them was therefore guaranteed to converge them.
         Each control is now scored on what it is FOR. */
      fallenXL: +avg('fallenXL').toFixed(2),
      fallenDepth: +avg('fallenDepth').toFixed(2), /* caution: how FAR a seeker got */
      gearHome: Math.round(avg('gearHome')),   /* spend/route: what came home */
      artefacts: Math.round(avg('artefacts')),
      runeKinds: +avg('runeKinds').toFixed(1), /* route: how many kinds the path yields */
      godKinds: +avg('godKinds').toFixed(1),
      /* Composition, which is what a road actually decides. Counting kinds of rune
         could not price the roads: give two roads four rune branches each and the
         COUNT is identical however different the runes are. Steel against
         enchantment is a difference a number can hold. */
      martialHome: Math.round(avg('martialHome')),
      jewelHome: Math.round(avg('jewelHome')),
      jewelShare: +(avg('jewelHome') / Math.max(1, avg('martialHome') + avg('jewelHome'))).toFixed(3),
      consFound: Math.round(avg('consFound')),
      firstOrbDay: +(firstOrb.reduce((a, b) => a + b, 0) / firstOrb.length).toFixed(2),
      sealed: Math.round(avg('sealed')), gateOk: Math.round(avg('gateOk')),
      zotXL: +avg('zotXL').toFixed(2), zotHp: Math.round(avg('zotHp')),
    });
  }
  return rows;
}

if (process.argv[1] && import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href) {
  const [, , axis, nStr, dStr] = process.argv;
  const sessions = parseInt(nStr || '5', 10), days = parseInt(dStr || '20', 10);
  const list = (!axis || axis === 'all') ? Object.keys(AXES) : [axis];
  for (const ax of list) {
    if (!AXES[ax]) { console.error(`unknown axis: ${ax} (have: ${Object.keys(AXES).join(', ')})`); process.exit(1); }
    for (const row of ablate(ax, sessions, days)) console.log(JSON.stringify(row));
    console.error(`[${ax}] done`);
  }
}
