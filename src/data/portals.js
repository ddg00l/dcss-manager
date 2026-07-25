/* DCSS portal locations: temporary mini-dungeons with concentrated loot. */
export const PORTALS = {
  sewer:    { n: 'the Sewer',     t: 'p_sewer',    fl: [2, 6],   floors: 1,
    mobs: ['rat', 'adder', 'blink_frog', 'zombie'], lootN: 4, goldMul: 2,
    floor: 'd_floor_lair', wall: 'd_wall_lair' },
  icecave:  { n: 'the Ice Cave',  t: 'p_icecave',  fl: [8, 14],  floors: 1,
    mobs: ['yak', 'wight', 'frost_giant'], lootN: 5, goldMul: 3,
    floor: 'd_floor_elf', wall: 'd_wall_vault' },
  volcano:  { n: 'the Volcano',          t: 'p_volcano',  fl: [9, 15],  floors: 1,
    mobs: ['ogre', 'fire_giant', 'draconian_mon'], lootN: 5, goldMul: 3, clouds: 'fire',
    floor: 'd_floor2', wall: 'd_wall' },
  trove:    { n: 'the Treasure Trove',    t: 'p_trove',    fl: [8, 25],  floors: 1,
    mobs: [], lootN: 10, goldMul: 8, needKey: 1,
    floor: 'd_floor_vault', wall: 'd_wall_vault' },
  gauntlet: { n: 'the Gauntlet',        t: 'p_gauntlet', fl: [9, 15],  floors: 1,
    mobs: ['minotaur_mon', 'cyclops', 'two_headed_ogre'], lootN: 6, goldMul: 4,
    floor: 'd_floor_zot', wall: 'd_wall_zot' },
  zig:      { n: 'the Ziggurat',        t: 'p_zig',      fl: [14, 26], floors: 27,
    mobs: ['orc_warlord_x', 'stone_giant', 'fire_giant', 'frost_giant', 'ettin', 'lich',
      'draconian_mon', 'orb_guardian', 'ghost_moth', 'orb_of_fire'].filter(m => m !== 'orc_warlord_x'),
    lootN: 3, goldMul: 5, needWin: 1, depthRamp: 2,
    floor: 'd_floor_zot', wall: 'd_wall_abyss' },
};
export const PORTAL_KEYS = Object.keys(PORTALS);
