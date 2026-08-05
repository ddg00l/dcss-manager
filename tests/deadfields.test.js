import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* Data the game declares and never reads.

   Every mechanical bug found by playing this build was of exactly this shape, and none
   of them could be caught by a simulation: a class fighting at half its arsenal still
   wins some Orbs, so the numbers look healthy. They were all visible statically.

     mr on armour        the willpower ego, dropped by itemInfo's copy list, so nothing
                         downstream could read it however hard it looked -- casters were
                         unanswerable
     multi on the hydra  a multi-headed attack that never happened
     bossMulU on Lair    a branch boss multiplier the spawner never consulted
     fast, clever        two mutations the game describes to the player and does not apply
     slowall, knock,     spell properties that do nothing; Disjunction, whose ONLY effect
     burn, selfaoe       is slowall, is a level-8 spell that does nothing at all
     cursed              an elite affix named and described on screen, with no effect

   A declared field that nothing reads is either a bug or a lie to the player, and the
   only cheap way to tell them apart is to make someone write down which. */

const DATA_DIRS = ['src/data'];
/* tiles.js is an asset loader, not game data: its "properties" are Vite glob options. */
const NOT_DATA = /tiles\.js$/;
const CODE_GLOBS = ['src', 'tools'];

/* Table KEYS, not properties: monsters, gods, portals, affixes, families and the like
   are reached by computed index, so their names never appear literally in code. */
const TABLE_KEY = /^[a-z][a-z0-9_]*$/;

/* Known and accepted. Each line is a claim someone had to make on purpose. */
const ACCEPTED = new Set([
  'phr',      // unique's entrance line: written, never surfaced. Flavour debt, harmless.
  'reqTxt',   // branch requirement text ("D:8"): not shown anywhere yet.
  'invocations', // an aptitude for a skill this game does not have. Dead weight, harmless.
  'safe',     // Controlled Blink's "no risk" flag; blink has no risk to disarm.
  'undead',   // Death Channel's flavour on its summons; allies have no undead handling.
  'selfaoe',  // Refrigeration is centred on the caster; `type: 'aoe'` already does the work.
]);

function walk(dir) {
  const out = [];
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    if (e.isDirectory()) out.push(...walk(join(dir, e.name)));
    else if (/\.(js|mjs)$/.test(e.name)) out.push(join(dir, e.name));
  }
  return out;
}

describe('every declared field is read by something', () => {
  it('no data property is dead', () => {
    const dataFiles = DATA_DIRS.flatMap(walk).filter(f => !NOT_DATA.test(f));
    const codeFiles = CODE_GLOBS.flatMap(walk).filter(f => !f.includes('/data/'));
    const dataSrc = Object.fromEntries(dataFiles.map(f => [f, readFileSync(join(ROOT, f), 'utf8')]));
    const codeSrc = codeFiles.map(f => readFileSync(join(ROOT, f), 'utf8')).join('\n');

    /* property keys declared in object literals inside the data files */
    const declared = new Map();
    for (const [f, src] of Object.entries(dataSrc))
      for (const m of src.matchAll(/[{,]\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g))
        if (!declared.has(m[1])) declared.set(m[1], f);

    const dead = [];
    for (const [key, where] of declared) {
      if (ACCEPTED.has(key) || key.length < 2) continue;
      const read = new RegExp('[.\\[\'"]' + key + '\\b');
      /* read anywhere outside the data files, or destructured/consulted within them */
      const inCode = read.test(codeSrc);
      const inData = Object.entries(dataSrc)
        .some(([f, src]) => f !== where && read.test(src)) ||
        new RegExp('[.\\[]' + key + '\\b').test(dataSrc[where]);
      if (inCode || inData) continue;
      /* a table key: its name is the entry, not a property of one */
      if (TABLE_KEY.test(key) && new RegExp('^\\s*' + key + ':\\s*\\{', 'm').test(dataSrc[where])) continue;
      dead.push(key + '  (' + where + ')');
    }

    expect(dead.sort(), 'declared and never read — wire it up, delete it, or list it in ACCEPTED with a reason')
      .toEqual([]);
  });
});
