/* Per-day trajectory of an account: where the Orbs actually come from.

   The ablation prices a DECISION; it cannot answer "why is the game six times faster
   than intended". For that you need the shape of the curve rather than its total. An
   economy that settles at a steady 23 Orbs a day and one that starts at 2 and doubles
   every four days both report the same 30-day sum, and they are entirely different
   problems: the first is a difficulty question, the second a compounding one.

   Emits one NDJSON row per session with the per-day series, so the report can show the
   trajectory and the growth factor rather than an average that describes no day.

   Usage:  node tools/sim/trace.mjs <tactic> [sessions] [days]
   Output: NDJSON, one line per session.  */
import { session, TACTICS } from './worker.mjs';
import { pathToFileURL } from 'node:url';

const SEED_BASE = parseInt(process.env.SEED_BASE || '0', 10);

/** Run `sessions` accounts of one tactic and return their per-day series. */
export function trace(name, sessions, days) {
  const tac = TACTICS[name];
  if (!tac) throw new Error(`unknown tactic: ${name}`);
  const rows = [];
  for (let i = 0; i < sessions; i++) {
    const t0 = Date.now();
    const r = session(tac, days, SEED_BASE + i);
    /* per-day deltas: byDay carries cumulative totals */
    const perDay = [], prestPerDay = [];
    let pw = 0, pp = 0;
    for (const d of r.byDay) {
      perDay.push(d.wins - pw); pw = d.wins;
      prestPerDay.push(d.prest - pp); pp = d.prest;
    }
    rows.push({
      tactic: name, seed: SEED_BASE + i, days,
      wins: r.wins, prestiges: r.prestiges,
      perDay, prestPerDay,
      ng: r.byDay.map(d => d.ng),
      bar: r.byDay.map(d => d.bar),      /* the prestige requirement as it moved */
      rate: r.byDay.map(d => d.rate),    /* the game's own smoothed Orbs/day */
    });
    console.error(`[trace/${name}] seed ${i + 1}/${sessions} · ` +
      `${((Date.now() - t0) / 1000).toFixed(1)}s · ${r.wins} Orbs`);
  }
  return rows;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , name, nStr, dStr] = process.argv;
  const sessions = parseInt(nStr || '3', 10), days = parseInt(dStr || '30', 10);
  for (const row of trace(name, sessions, days)) console.log(JSON.stringify(row));
  console.error(`[trace/${name}] done`);
}
