/* 24h session simulator: a "player bot" with a tactic acts on top of the pure game sim.
   Usage:  node tools/sim/worker.mjs <tactic> <sessions>   (streams NDJSON to stdout)
   Parallel run over all tactics (16 shards ~= full CPU):
     for t in afk lazy active rush_slots keystoner whale smith speedrun; do
       node tools/sim/worker.mjs $t 125 > out_a_$t.ndjson &
       node tools/sim/worker.mjs $t 125 > out_b_$t.ndjson &
     done; wait
   Live progress:  wc -l out_*.ndjson
   Aggregate:      python3 tools/sim/aggregate.py 'out_*.ndjson' */
import { makeState } from '../../src/core/state.js';
import { newHero, rollHero } from '../../src/sim/hero.js';
import { advanceHeroes, startRun, equipBestFromArmory, recallHero } from '../../src/sim/tick.js';
import { NODES, canBuy, buyNode, treeLvl, nodeCost, memHas } from '../../src/data/memtree.js';
import { rollCost, maxSlots, forgeDisc, freeRollAvailable, ZUPGRADES, zupg, zupgCost, zupgCap } from '../../src/core/economy.js';
import { canPrestige, doPrestige, PUPGRADES, pupg, pupgCost, cycleProgress, ngLevel } from '../../src/core/prestige.js';
import { achMet } from '../../src/data/memtree.js';
const achMetSafe = (s, n) => { try { return achMet(s, n); } catch { return false; } };
import { randomItem, doForge, forgeCost as fCost, forgeScrap as fScrap } from '../../src/data/items.js';
import { BR_OFFSET } from '../../src/data/branches.js';
import { starNeed } from '../../src/data/combos.js';
import { greatRaces, greatClasses } from '../../src/core/chronicle.js';
import { setAffixDateProvider, todayAffixKey } from '../../src/data/affixes.js';
import { mulberry32 } from '../../src/core/rng.js';



function buyTree(s, tactic, budgetShare) {
  for (let guard = 0; guard < 40; guard++) {
    const affordable = NODES.filter(n => canBuy(s, n));
    if (!affordable.length) {
      /* a real player saves for a keystone he can already see is reachable:
         requirements owned, gate met, only the memory is short */
      const saving = NODES.some(n => n.keystone && !treeLvl(s, n.id) &&
        n.req.some(r => treeLvl(s, r) > 0) && achMetSafe(s, n) && nodeCost(s, n) > s.mem);
      return;
    }
    const reachableKey = NODES.find(n => n.keystone && !treeLvl(s, n.id) &&
      n.req.some(r => treeLvl(s, r) > 0) && achMetSafe(s, n));
    if (reachableKey && nodeCost(s, reachableKey) > s.mem) return; /* hold the treasury for it */
    let pick = null;
    if (tactic.tree === 'keystones') {
      pick = affordable.find(n => n.keystone) ||
        affordable.sort((a, b) => nodeCost(s, a) - nodeCost(s, b))[0];
    } else if (tactic.tree === 'slots') {
      pick = affordable.find(n => n.id.startsWith('hslot')) ||
        affordable.find(n => n.region === 'heroes') ||
        affordable.sort((a, b) => nodeCost(s, a) - nodeCost(s, b))[0];
    } else if (tactic.tree === 'combat') {
      pick = affordable.find(n => n.keystone && (n.region === 'combat' || n.region === 'dungeon')) ||
        affordable.filter(n => n.region === 'combat' || n.region === 'dungeon')
          .sort((a, b) => nodeCost(s, a) - nodeCost(s, b))[0] ||
        affordable.sort((a, b) => nodeCost(s, a) - nodeCost(s, b))[0];
    } else { /* balanced: cheapest first, keystones when seen */
      pick = affordable.find(n => n.keystone) ||
        affordable.sort((a, b) => nodeCost(s, a) - nodeCost(s, b))[0];
    }
    if (!pick) return;
    if (nodeCost(s, pick) > s.mem * budgetShare && !pick.keystone) return;
    if (!buyNode(s, pick)) return;
  }
}

function playerActions(s, tactic, m) {
  /* star promotions from shards */
  for (const ck of Object.keys(s.shards)) {
    const stars = s.stars[ck] || 0;
    const need = starNeed(stars);
    if ((s.shards[ck] || 0) >= need) { s.shards[ck] -= need; s.stars[ck] = stars + 1; }
  }
  /* every archetype prestiges: speedrun right after the first Orb, the rest
     squeeze one more win out of the cycle before resetting */
  if (tactic.prestige && canPrestige(s) && cycleProgress(s).wins >= (tactic.prestigeAfter || 1)) {
    doPrestige(s); m.prestiges++;
  }
  /* both permanent shops: greedy cheapest affordable */
  for (let g = 0; g < 20; g++) {
    const buy = ZUPGRADES.filter(u => zupg(s, u.k) < zupgCap(s, u) && zupgCost(s, u) <= s.zot)
      .sort((a, b) => zupgCost(s, a) - zupgCost(s, b))[0];
    if (!buy) break;
    s.zot -= zupgCost(s, buy);
    s.zupg[buy.k] = zupg(s, buy.k) + 1;
  }
  for (let g = 0; g < 20; g++) {
    const buy = PUPGRADES.filter(u => pupg(s, u.k) < u.max && pupgCost(s, u) <= (s.legends || 0))
      .sort((a, b) => pupgCost(s, a) - pupgCost(s, b))[0];
    if (!buy) break;
    m.spentLegends += pupgCost(s, buy);
    s.legends -= pupgCost(s, buy);
    s.pupg[buy.k] = pupg(s, buy.k) + 1;
  }
  buyTree(s, tactic, tactic.treeBudget ?? .9);
  /* forging */
  if (tactic.forge) {
    /* dismantle non-worn spares beyond 25 items */
    while (s.armory.length > 25) {
      const worst = s.armory.reduce((a, b) => (a.rar <= b.rar ? a : b));
      if (worst.unrandId) break;
      s.armory.splice(s.armory.indexOf(worst), 1);
      s.scrap += 2 + worst.rar * 2;
      s.stat.dismantled++;
    }
    const slots = ['weapon', 'armour', 'shield', 'ring', 'amulet'];
    let guard = 0;
    while (guard++ < 20) {
      const slot = slots[Math.floor(Math.random() * slots.length)];
      if (s.gold < fCost(s, slot) + tactic.goldReserve || s.scrap < fScrap(slot)) break;
      if (!doForge(s, slot)) break;
    }
  }
  /* a real player replaces a weak hero when the treasury allows a far better
     roll: recall the weakest runeless delver and free the slot (this was the
     blind spot that dead-locked "stalled" bot sessions on one free seeker) */
  if (s.gold >= rollCost(s) * 10) {
    const weakest = s.heroes
      .filter(h => h.state === 'run' && h.runes.length === 0 && h.rarity <= 1)
      .sort((a, b) => a.xl - b.xl)[0];
    if (weakest && s.heroes.filter(h => h.state === 'camp').length === 0) recallHero(weakest, s);
  }
  /* shard whale: burn the treasury on rolls purely for duplicate shards */
  if (tactic.shardFarm) {
    let f = 0;
    while (f++ < 15 && s.gold >= rollCost(s) * 1.2) {
      if (!rollHero(s, false)) break;
      m.summons++;
    }
  }
  /* summons */
  let guard = 0;
  while (guard++ < 12) {
    const camp = s.heroes.filter(h => h.state === 'camp').length;
    const running = s.heroes.filter(h => h.state === 'run').length;
    if (camp + running >= maxSlots(s)) break; /* no idle spares: a camp hero blocks free guild seekers */
    if (tactic.dark && s.runes > 0) { if (rollHero(s, true)) { m.summons++; continue; } }
    if (freeRollAvailable(s) || s.gold >= rollCost(s) * tactic.rollFactor) {
      if (rollHero(s, false)) { m.summons++; continue; }
    }
    break;
  }
  /* equip and dispatch */
  for (const h of s.heroes) {
    if (h.state !== 'camp') continue;
    h.strategy = tactic.route; h.caution = tactic.caution;
    equipBestFromArmory(h, s);
    if (s.heroes.filter(x => x.state === 'run').length < maxSlots(s)) startRun(h, s);
  }
}

function depthScore(s) {
  const map = { D: 'dungeon', Lair: 'lair', Orc: 'orc', Elf: 'elf', Vaults: 'vaults', Depths: 'depths', Zot: 'zot', Abyss: 'abyss' };
  let best = 0, bestTag = 'D:0';
  for (const [k, br] of Object.entries(map)) {
    const p = s.progress[k] || 0;
    if (p > 0 && BR_OFFSET[br] + p > best) { best = BR_OFFSET[br] + p; bestTag = k + ':' + p; }
  }
  return { score: best, tag: bestTag };
}

let simDay = 0, GAMEPLAY_SEED = 1;
setAffixDateProvider(() => '2026-01-' + String(1 + (simDay % 28)).padStart(2, '0'));
/* CRN: every session index draws the same random stream regardless of tactic
   or code revision — paired comparisons cut variance dramatically */
const trueRandom = Math.random;
function session(tactic, days = 1, seed = 0) {
  Math.random = mulberry32(0x9e3779b9 ^ seed); /* bot decisions (tactic/forge choices) */
  GAMEPLAY_SEED = (0x1234567 ^ seed) >>> 0; /* gameplay determinism via the account master seed */
  const s = makeState(); s.masterSeed = GAMEPLAY_SEED; s.seq = {};
  const m = { summons: 0, prestiges: 0, spentLegends: 0 };
  const step = tactic.checkin;
  const byDay = [];
  for (let day = 0; day < days; day++) {
    simDay = day; /* each game day gets its own affix, deterministically */
    for (let t = 0; t < 24 * 3600; t += step) {
      playerActions(s, tactic, m);
      advanceHeroes(s, step, true);
    }
    byDay.push({ wins: s.stat.wins, prest: m.prestiges, ng: ngLevel(s), mem: s.stat.memEarned, afx: todayAffixKey() });
  }
  playerActions(s, tactic, m);
  Math.random = trueRandom;
  if (process.env.SIM_DEBUG) {
    m.debug = {
      gold: Math.round(s.gold), mem: Math.round(s.mem), scrap: s.scrap,
      treeNodes: Object.keys(s.tree).length,
      heroes: s.heroes.map(h => h.state + ':XL' + h.xl + (h.state === 'run' ? '@' + (h.branch || '?') + ':' + h.floor : '')).slice(-8),
      camp: s.heroes.filter(h => h.state === 'camp').length,
      running: s.heroes.filter(h => h.state === 'run').length,
      rolls: s.rolls, cycWins: (s.stat.wins || 0) - ((s.cycBase && s.cycBase.wins) || 0),
    };
  }
  const d = depthScore(s);
  return {
    wins: s.stat.wins, deaths: s.stat.deaths, kills: s.stat.kills,
    summons: m.summons, prestiges: m.prestiges, legends: s.legends || 0,
    runes: s.runesTotal, mem: s.stat.memEarned, nodes: Object.keys(s.tree).length - 1,
    keystones: NODES.filter(n => n.keystone && treeLvl(s, n.id) > 0).length,
    slots: maxSlots(s), depth: d.score, depthTag: d.tag,
    uniq: s.stat.uniqKills, forged: s.stat.forged,
    zlv: Object.values(s.zupg||{}).reduce((a,b)=>a+b,0),
    plv: Object.values(s.pupg||{}).reduce((a,b)=>a+b,0),
    ng: ngLevel(s), byDay, debug: m.debug,
    greats: greatRaces(s).length + greatClasses(s).length,
    zig: s.stat.zigBest || 0, contracts: s.stat.contracts || 0,
    gold: Math.round(s.gold), spentLegends: m.spentLegends,
    clsWins: (s.vic && s.vic.classes) || {},
    stars: Object.values(s.stars || {}).reduce((a, b) => a + b, 0),
    nemMax: Math.max(0, ...Object.values(s.nemeses || {})),
  };
}

const TACTICS = {
  afk:        { checkin: 6 * 3600, tree: 'balanced', route: 'classic', caution: 'normal', rollFactor: 1, goldReserve: 0, forge: false , prestige: true, prestigeAfter: 1 },
  lazy:       { checkin: 1800, tree: 'balanced', route: 'classic', caution: 'normal', rollFactor: 1, goldReserve: 0, forge: false , prestige: true, prestigeAfter: 2 },
  active:     { checkin: 300, tree: 'balanced', route: 'classic', caution: 'normal', rollFactor: 1, goldReserve: 0, forge: false , prestige: true, prestigeAfter: 2 },
  rush_slots: { checkin: 300, tree: 'slots', route: 'classic', caution: 'cautious', rollFactor: 1, goldReserve: 0, forge: false , prestige: true, prestigeAfter: 2 },
  keystoner:  { checkin: 300, tree: 'keystones', route: 'classic', caution: 'normal', rollFactor: 1, goldReserve: 0, forge: false , prestige: true, prestigeAfter: 2 },
  whale:      { checkin: 300, tree: 'balanced', route: 'classic', caution: 'normal', rollFactor: 1, dark: true, goldReserve: 0, forge: false , prestige: true, prestigeAfter: 2 },
  smith:      { checkin: 300, tree: 'combat', route: 'classic', caution: 'normal', rollFactor: 2, goldReserve: 300, forge: true , prestige: true, prestigeAfter: 2 },
  speedrun:   { checkin: 300, tree: 'combat', route: 'speed', caution: 'bold', rollFactor: 1, goldReserve: 0, forge: false, prestige: true },
  shardwhale: { checkin: 300, tree: 'balanced', route: 'classic', caution: 'normal', rollFactor: 1, dark: true, shardFarm: true, goldReserve: 0, forge: false, prestige: true, prestigeAfter: 2 },
};

const [, , name, countStr, daysStr] = process.argv;
const n = parseInt(countStr || '2', 10);
const days = parseInt(daysStr || '1', 10);
const t0 = Date.now();
/* streaming NDJSON: one line per finished session, flushed immediately —
   progress is monitorable in realtime with `wc -l *.ndjson` */
for (let i = 0; i < n; i++) {
  const r = session(TACTICS[name], days, parseInt(process.env.SEED_BASE || '0', 10) + i);
  r.tactic = name;
  r.i = i;
  console.log(JSON.stringify(r));
}
console.error(JSON.stringify({ name, n, ms: Date.now() - t0 }));
