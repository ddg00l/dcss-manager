# DCSS Manager

An idle auto-battler with gacha mechanics inspired by
[Dungeon Crawl Stone Soup](https://crawl.develz.org/). You are the guild's memory:
you summon seekers (DCSS race × class, with combo rarities), equip them and send them
into the dungeon. From there heroes act entirely on their own — exploring floors,
fighting, quaffing potions, praying to gods and dying. Death is permanent (shards and
gear return to the guild). Victory means carrying the Orb of Zot out of Zot:5 with
3 runes — and a place in the Hall of Fame. Tiles are the original CC0 art from
[crawl/crawl](https://github.com/crawl/crawl).

## Commands

```bash
npm install
npm run dev     # vite dev server with HMR
npm test        # vitest, 122 tests — the core runs in node without DOM
npm run build   # bundle into a single self-contained game.html (~1.2 MB)
```

## Features

- **DCSS dungeon**: D:1–15 plus Lair/Orcish Mines/Elven Halls/Vaults/Depths/Zot/Abyss,
  portal vaults (Sewer, Ice Cave, Volcano, Trove, Gauntlet, Ziggurat), uniques, bosses, runes.
- **Honest tick simulation**: seeded mapgen, 8-way BFS pathfinding, Bresenham FOV/LOS
  (no shooting through walls), traps, clouds, shops, mutations.
- **DCSS-style skills**: 9 weapon schools, an XP pool with auto-training by usage,
  racial aptitudes, crosstraining, min-delay attack speed, stealth and stabs.
- **Items**: egos, randarts, 11 unrands (one per account), two-handers, caster
  encumbrance, holy wrath vs undead, venom and resists, per-hero identification.
- **Meta progression**: a 121-node Memory tree (fed by floors, uniques and hero deaths;
  keystones gated by achievements), hero gacha and forge gacha, combo shards/stars,
  Hall of Fame bonuses, NG+.
- **Idle loop**: offline simulation identical to online (24h cap, 72h with a keystone),
  expedition reports, a narrator-driven FTUE, up to 5 parallel expeditions.
- **i18n**: en (canonical), de, es, ru, uk. The master table lives in
  `tools/i18n_master.json`; dictionaries `src/i18n/{ru,de,es,uk}.js` are generated from it.

## Architecture

```
src/
  core/    # pure logic, no DOM: state (+save migrations), economy, ftue, rng, fmt
  data/    # DCSS content: races, classes, skills, monsters, branches, items, gods, memtree, tiles
  sim/     # simulation: hero (derived stats), mapgen (floors), tick (per-turn AI, combat, offline)
  ui/      # thin DOM layer: tabs, gacha, forge, watch canvas, character sheet, settings
  i18n/    # t()/applyStatic + generated dictionaries
  assets/tiles/  # 236 DCSS png tiles, inlined as data URIs at build time
tests/     # vitest: core/sim/i18n run headless (incl. balance corridors and 24h runs)
tools/     # i18n_master.json — the source of truth for translations
  sim/     # headless 24h player-bot simulator (worker.mjs + aggregate.py), see file header
```

Layering rules: `core` and `sim` never touch the DOM and take `state` as a parameter —
the simulation is testable headless and behaves identically online and offline. The UI
works with the `save` singleton. Canonical strings in code are English; translations are
applied via `t()` at display time (log lines — at composition time).

## Deployment

The game is hosted on GitHub Pages: every push to `master` runs tests, builds the
single-file bundle and deploys `dist/` via `.github/workflows/deploy.yml`.
`npm run build` also drops a local `game.html` (gitignored) that opens straight
from disk without a server.

## License

The game's own source code is released under the
[GNU General Public License v3.0 or later](LICENSE) — the same copyleft family
as Dungeon Crawl Stone Soup, whose spirit this project follows.

The tile art bundled under `src/assets/tiles/` is **not** covered by that GPL: it
comes from DCSS, which redistributes it from the public-domain "RLTiles" tileset
(some tiles modified). It is documented separately in
[`src/assets/tiles/LICENSE.txt`](src/assets/tiles/LICENSE.txt), mirroring the
notice DCSS ships in `crawl-ref/source/rltiles/license.txt`.
