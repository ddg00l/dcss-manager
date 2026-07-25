import { describe, it, expect } from 'vitest';
import { makeState, loadState } from '../src/core/state.js';
import {
  defaultFtue, completedFtue, isVeteranSave, railStage, tabUnlocked, darkSummonUnlocked,
} from '../src/core/ftue.js';
import { newHero } from '../src/sim/hero.js';
import { startRun } from '../src/sim/tick.js';

function fresh() {
  const s = makeState();
  s.ftue = defaultFtue();
  return s;
}

describe('FTUE rail', () => {
  it('walks the opening rail: summon → dispatch → map → log → sheet → done', () => {
    const s = fresh();
    expect(railStage(s)).toBe(0);                 // summon a hero
    const h = newHero('minotaur', 'fighter', 2, s);
    s.heroes.push(h);
    expect(railStage(s)).toBe(1);                 // send to the dungeon
    startRun(h, s);
    expect(railStage(s)).toBe(2);                 // map
    s.ftue.sawMap = true;
    expect(railStage(s)).toBe(3);                 // log
    s.ftue.sawLog = true;
    expect(railStage(s)).toBe(4);                 // sheet
    s.ftue.sawSheet = true;
    expect(railStage(s)).toBe(99);
  });
});

describe('tab gating', () => {
  it('only Heroes visible at start; Dungeon appears after dispatch', () => {
    const s = fresh();
    expect(tabUnlocked(s, 'pHeroes')).toBe(true);
    expect(tabUnlocked(s, 'pDun')).toBe(false);
    expect(tabUnlocked(s, 'pForge')).toBe(false);
    expect(tabUnlocked(s, 'pUpg')).toBe(false);
    expect(tabUnlocked(s, 'pFame')).toBe(false);
    const h = newHero('human', 'monk', 0, s);
    s.heroes.push(h); startRun(h, s);
    expect(tabUnlocked(s, 'pDun')).toBe(true);
  });
  it('Forge unlocks on first item/scrap; Memory and Fame on first death', () => {
    const s = fresh();
    s.scrap = 1;
    expect(tabUnlocked(s, 'pForge')).toBe(true);
    expect(tabUnlocked(s, 'pUpg')).toBe(false);
    s.stat.deaths = 1;
    expect(tabUnlocked(s, 'pUpg')).toBe(true);
    expect(tabUnlocked(s, 'pFame')).toBe(true);
  });
  it('dark summon hides until the first rune', () => {
    const s = fresh();
    expect(darkSummonUnlocked(s)).toBe(false);
    s.runesTotal = 1;
    expect(darkSummonUnlocked(s)).toBe(true);
  });
});

describe('veterans skip FTUE', () => {
  it('an existing save with progress loads with completed FTUE', () => {
    const raw = { gold: 5000, rolls: 12, stat: { kills: 300, deaths: 4 }, fame: [{ won: false }] };
    const storage = { getItem: () => JSON.stringify(raw), setItem() {} };
    const s = loadState(storage);
    expect(isVeteranSave(s)).toBe(true);
    expect(s.ftue.railDone).toBe(true);
    expect(railStage(s)).toBe(99);
    expect(tabUnlocked(s, 'pDun')).toBe(true);
  });
  it('a brand-new save starts the rail', () => {
    const s = loadState({ getItem: () => null, setItem() {} });
    expect(s.ftue.railDone).toBe(false);
    expect(railStage(s)).toBe(0);
  });
  it('completedFtue covers every tour key', () => {
    const done = completedFtue();
    for (const p of ['pDun', 'pHeroes', 'pForge', 'pUpg', 'pFame', 'equip'])
      expect(done.tours[p]).toBeTruthy();
  });
});
