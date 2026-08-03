/* Why the dungeon is as hard as it is, in the player's words.

   Monsters are multiplied by several independent systems at once — the NG+
   ladder, the escalation inside a prestige cycle, the Realm of Zot's own
   scaling, the day's affix — and until now every one of them was invisible. The
   player saw coloured rings on elites and an affix name, which are decorations,
   and none of the systemic pressure that actually decides whether a delve
   survives. A player who cannot see why the dungeon got harder cannot make a
   decision about it, and an idle game where difficulty moves silently reads as
   the numbers cheating.

   Pure and DOM-free so it can be tested and reused: returns an ordered list of
   the pressures currently acting, each with the multiplier it applies and the
   reason it applies. Sources that are inactive are omitted rather than shown at
   x1.00 — a list of no-ops teaches nothing. */
import { ngMonMul, inCycleMul, ngLevel, cycleProgress, prestigeReq } from './prestige.js';
import { affixLevel, eliteChance, endgamePressure, ENDGAME_FROM, readiness, feltAffix } from '../data/eliteAffixes.js';
import { todayAffix } from '../data/affixes.js';
import { brDepth } from '../data/branches.js';
import { FLOOR_AFFIXES } from '../data/eliteAffixes.js';
import { memHas } from '../data/memtree.js';

const pct = m => (m >= 1 ? '+' : '') + Math.round((m - 1) * 100) + '%';

/** Every difficulty source currently acting on `h`'s floor. */
export function dungeonPressure(s, h) {
  const out = [];
  const ng = ngLevel(s);
  if (ng > 0) out.push({
    key: 'ng', n: 'New Game+', mul: ngMonMul(s), txt: pct(ngMonMul(s)),
    why: 'Every prestige deepens the ladder. Permanent.',
  });

  const cyc = Math.max(0, cycleProgress(s).wins);
  if (cyc > 0) out.push({
    key: 'cycle', n: 'Orbs taken this cycle', mul: inCycleMul(s), txt: pct(inCycleMul(s)),
    why: 'Each Orb carried out hardens the dungeon. Resets when you prestige.',
    detail: cyc + ' / ' + prestigeReq(s),
  });

  const depth = h && !h.inPortal ? brDepth(h) : 0;
  if (depth >= ENDGAME_FROM) {
    const z = endgamePressure(s, depth);
    out.push({
      key: 'endgame', n: 'The deep places', mul: z, txt: pct(z),
      why: 'Pressure climbs with every floor from the Vaults down to Zot, and it '
         + 'answers to your guild: gentler on a young one, merciless on a great one.',
    });
  }

  /* what the panel shows must be what the dungeon does: a young guild feels a
     fraction of the day, so quoting the raw affix here would be a lie */
  const afx = feltAffix(s, todayAffix());
  if (afx.monHp !== 1 || afx.monDmg !== 1) out.push({
    key: 'daily', n: afx.n, mul: Math.max(afx.monHp, afx.monDmg),
    txt: (afx.monHp !== 1 ? pct(afx.monHp) + ' HP' : '') +
         (afx.monHp !== 1 && afx.monDmg !== 1 ? ', ' : '') +
         (afx.monDmg !== 1 ? pct(afx.monDmg) + ' damage' : ''),
    why: "Today's omen. It changes at midnight.",
  });

  if (h && h.map && h.map.fafx) {
    const f = FLOOR_AFFIXES[h.map.fafx];
    out.push({ key: 'floor', n: f.n, mul: 1, txt: '', why: f.d });
  }

  const lvl = affixLevel(s, ng);
  const ech = eliteChance(lvl) * (memHas(s, 'k_elite') ? 1.5 : 1);
  out.push({
    key: 'elite', n: 'Elite monsters', mul: 1, txt: Math.round(ech * 100) + '%',
    why: 'Share of monsters carrying affixes. Grows with your guild’s power.',
  });
  return out;
}

/** One-line summary: the combined multiplier on monster stats right now. */
export function pressureTotal(s, h) {
  return dungeonPressure(s, h)
    .filter(p => p.key === 'ng' || p.key === 'cycle' || p.key === 'endgame' || p.key === 'daily')
    .reduce((m, p) => m * (p.mul || 1), 1);
}
