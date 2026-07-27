/* Daily dungeon affixes: the whole dungeon plays slightly differently every
   day. Deterministic from the UTC date — no backend, same for everyone. */
export const AFFIXES = {
  calm: { n: 'Calm day', d: 'The dungeon rests — no modifiers', monHp: 1, monDmg: 1, gold: 1 },
  bloodmoon: { n: 'Blood moon', d: 'Monsters hit harder, the guild pays more', monHp: 1, monDmg: 1.30, gold: 1.5 },
  goldrush: { n: 'Gold rush', d: 'Treasure everywhere, sturdier guardians', monHp: 1.20, monDmg: 1, gold: 2 },
  swarm: { n: 'Swarm', d: 'Many weak monsters', monHp: .82, monDmg: .92, gold: 1, extraMobs: 3 },
  titans: { n: 'Day of titans', d: 'Fewer but mighty foes, princely loot', monHp: 1.6, monDmg: 1.25, gold: 1.8, lessMobs: 2 },
};
const KEYS = Object.keys(AFFIXES);

/** affix key for a given date (UTC); simple string hash keeps it deterministic */
export function affixKeyFor(dateStr) {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) >>> 0;
  return KEYS[h % KEYS.length];
}
/* the date provider is injectable so headless sims can map game days to
   virtual dates instead of freezing the whole run on one real-world day */
let dateProvider = () => new Date().toISOString().slice(0, 10);
export const setAffixDateProvider = fn => { dateProvider = fn; };
export const todayAffixKey = () => affixKeyFor(dateProvider());
export const todayAffix = () => AFFIXES[todayAffixKey()];
