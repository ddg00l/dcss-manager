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
const BASE = {
  checkin: 300, tree: 'balanced', route: 'classic', caution: 'normal',
  rollFactor: 1, goldReserve: 0, forge: false, prestige: true, prestigeAfter: 2,
};

export const AXES = {
  /* how much is paying attention actually worth? */
  attention: [['5min', { checkin: 300 }], ['30min', { checkin: 1800 }], ['2h', { checkin: 7200 }],
              ['6h', { checkin: 21600 }], ['24h', { checkin: 86400 }]],
  caution:   [['cowardly', { caution: 'cautious' }], ['normal', { caution: 'normal' }], ['reckless', { caution: 'bold' }]],
  spend:     [['thrifty', { spend: 'thrifty' }], ['balanced', { spend: 'balanced' }], ['lavish', { spend: 'lavish' }]],
  route:     [['classic', { route: 'classic' }], ['speedrun', { route: 'speed', caution: 'bold' }]],
  tree:      [['balanced', { tree: 'balanced' }], ['combat', { tree: 'combat' }],
              ['slots', { tree: 'slots' }], ['keystones', { tree: 'keystones' }]],
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
      const r = session(tac, days, i); /* same seeds per variant */
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
    rows.push({
      axis, label, sessions, days,
      wins: +avg('wins').toFixed(2), prestiges: +avg('prestiges').toFixed(2),
      ascensions: +avg('ascensions').toFixed(2), depth: +avg('depth').toFixed(1),
      deaths: +avg('deaths').toFixed(1), mem: Math.round(avg('mem')),
      gold: Math.round(avg('gold')), winsLast10d: tail === null ? null : +tail.toFixed(2),
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
