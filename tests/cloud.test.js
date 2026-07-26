import { describe, it, expect } from 'vitest';
import { compareVectors, resolvePull, shouldPush, vectorOf, makeMeta } from '../src/cloud/sync.js';
import { makeState } from '../src/core/state.js';
import { stream, hashSeed } from '../src/core/rng.js';
import { nextStream, streamAt } from '../src/core/streams.js';

const vec = o => ({ wins: 0, prestiges: 0, memEarned: 0, runesTotal: 0, kills: 0, ...o });

describe('conflict resolution', () => {
  it('dominance is decided across the whole lifetime vector', () => {
    expect(compareVectors(vec({ wins: 5 }), vec({ wins: 3 }))).toBe('local');
    expect(compareVectors(vec({ wins: 3 }), vec({ wins: 5 }))).toBe('remote');
    expect(compareVectors(vec({ wins: 5 }), vec({ wins: 5 }))).toBe('equal');
    expect(compareVectors(vec({ wins: 5, kills: 1 }), vec({ wins: 3, kills: 9 }))).toBe('dispute');
  });
  it('resolvePull picks silently on dominance and flags only genuine disputes', () => {
    expect(resolvePull(vec({ wins: 2 }), null).action).toBe('push');
    expect(resolvePull(vec({ wins: 2 }), { vector: vec({ wins: 9 }) }).action).toBe('adopt');
    expect(resolvePull(vec({ wins: 9 }), { vector: vec({ wins: 2 }) }).action).toBe('push');
    expect(resolvePull(vec({ wins: 5 }), { vector: vec({ wins: 5 }) }).action).toBe('none');
    expect(resolvePull(vec({ wins: 5, kills: 1 }), { vector: vec({ wins: 1, kills: 5 }) }).action).toBe('conflict');
  });
  it('shouldPush skips no-op uploads', () => {
    expect(shouldPush(vec({ wins: 2 }), null)).toBe(true);
    expect(shouldPush(vec({ wins: 3 }), vec({ wins: 2 }))).toBe(true);
    expect(shouldPush(vec({ wins: 2 }), vec({ wins: 2 }))).toBe(false);
    expect(shouldPush(vec({ wins: 2 }), vec({ wins: 5 }))).toBe(false);
  });
  it('vectorOf reads lifetime stats; makeMeta bumps rev', () => {
    const s = makeState();
    s.stat.wins = 4; s.prestiges = 2; s.runesTotal = 7;
    expect(vectorOf(s)).toMatchObject({ wins: 4, prestiges: 2, runesTotal: 7 });
    const m = makeMeta(s, 'devA', 'phone', 1000);
    expect(m.rev).toBe(1);
    expect(m.vector.wins).toBe(4);
    expect(m.deviceName).toBe('phone');
  });
});

describe('deterministic domain streams', () => {
  it('a stream is a pure function of (masterSeed, domain, indices)', () => {
    const a = stream(12345, 'gacha', 42)();
    const b = stream(12345, 'gacha', 42)();
    expect(a).toBe(b); // reproducible across devices with the same seed
    expect(stream(12345, 'gacha', 43)()).not.toBe(a); // different index
    expect(stream(99999, 'gacha', 42)()).not.toBe(a); // different seed
    expect(stream(12345, 'loot', 42)()).not.toBe(a);  // different domain
  });
  it('hashSeed is stable and order-sensitive', () => {
    expect(hashSeed('a', 'b', 1)).toBe(hashSeed('a', 'b', 1));
    expect(hashSeed('a', 'b', 1)).not.toBe(hashSeed('a', 'b', 2));
  });
  it('nextStream advances a per-domain counter deterministically', () => {
    const s = makeState(); s.masterSeed = 777; s.seq = {};
    const first = nextStream(s, 'gacha')();
    expect(s.seq.gacha).toBe(1);
    nextStream(s, 'gacha'); // advance
    const s2 = makeState(); s2.masterSeed = 777; s2.seq = {};
    expect(nextStream(s2, 'gacha')()).toBe(first); // replays identically on another device
    expect(streamAt(s, 'combat', 5)()).toBe(streamAt(s2, 'combat', 5)());
  });
  it('fresh saves mint a master seed; the field round-trips', () => {
    const s = makeState();
    expect(s.masterSeed).toBeGreaterThan(0);
    expect(typeof s.seq).toBe('object');
  });
});

describe('reset save', () => {
  it('resetSave wipes progress in place and re-mints a fresh account', async () => {
    const { save, resetSave } = await import('../src/core/state.js');
    save.gold = 99999; save.stat.wins = 12; save.prestiges = 4;
    save.heroes.push({ id: 1, state: 'run' });
    const before = save; // identity must be preserved (imported reference)
    resetSave();
    expect(save).toBe(before);          // same object reference
    expect(save.gold).toBe(200);        // fresh account
    expect(save.stat.wins).toBe(0);
    expect(save.prestiges).toBe(0);
    expect(save.heroes).toEqual([]);
    expect(save.masterSeed).toBeGreaterThan(0);
  });
});
