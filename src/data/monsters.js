import { endgameUnlocked } from './endgame.js';

export const MONS={
  rat:{n:'rat',t:'m_rat',hp:4,dmg:2,ac:0,ev:8,xp:1},
  bat:{n:'bat',t:'m_bat',hp:5,dmg:2,ac:0,ev:14,xp:1,spd:1.6},
  kobold:{n:'kobold',t:'m_kobold',hp:6,dmg:3,ac:1,ev:9,xp:2},
  goblin:{n:'goblin',t:'m_goblin',hp:6,dmg:3,ac:0,ev:10,xp:2},
  hobgoblin:{n:'hobgoblin',t:'m_hobgoblin',hp:10,dmg:5,ac:2,ev:8,xp:3},
  jackal:{n:'jackal',t:'m_jackal',hp:7,dmg:3,ac:1,ev:10,xp:2,spd:1.3},
  adder:{n:'adder',t:'m_adder',hp:9,dmg:4,ac:1,ev:11,xp:3,pois:1},
  gnoll:{n:'gnoll',t:'m_gnoll',hp:14,dmg:7,ac:2,ev:9,xp:5},
  orc:{n:'orc',t:'m_orc',hp:12,dmg:6,ac:2,ev:8,xp:4},
  skeleton:{n:'skeleton',t:'m_skeleton',hp:14,dmg:6,ac:3,ev:6,xp:4,und:1},
  zombie:{n:'zombie',t:'m_zombie',hp:20,dmg:7,ac:2,ev:3,xp:5,spd:.7,und:1},
  killer_bee:{n:'killer bee',t:'m_killer_bee',hp:12,dmg:6,ac:1,ev:14,xp:5,spd:1.5,pois:1},
  scorpion:{n:'scorpion',t:'m_scorpion',hp:16,dmg:8,ac:4,ev:9,xp:6,pois:1},
  ogre:{n:'ogre',t:'m_ogre',hp:30,dmg:14,ac:2,ev:5,xp:10},
  centaur:{n:'centaur',t:'m_centaur',hp:24,dmg:9,ac:2,ev:9,xp:9,rng:1,spd:1.3},
  wight:{n:'wight',t:'m_wight',hp:22,dmg:10,ac:4,ev:8,xp:9,drain:1,und:1},
  orc_warrior:{n:'orc warrior',t:'m_orc_warrior',hp:32,dmg:14,ac:4,ev:8,xp:12},
  wolf_spider:{n:'wolf spider',t:'m_wolf_spider',hp:28,dmg:12,ac:3,ev:11,xp:11,pois:1},
  wraith:{n:'wraith',t:'m_wraith',hp:30,dmg:13,ac:5,ev:10,xp:13,drain:1,und:1},
  two_headed_ogre:{n:'two-headed ogre',t:'m_two_headed_ogre',hp:45,dmg:18,ac:3,ev:5,xp:16},
  cyclops:{n:'cyclops',t:'m_cyclops',hp:55,dmg:22,ac:5,ev:3,xp:20},
  troll_mon:{n:'troll',t:'m_troll_mon',hp:48,dmg:18,ac:3,ev:6,xp:18,regen:1},
  minotaur_mon:{n:'minotaur',t:'m_minotaur_mon',hp:60,dmg:24,ac:5,ev:8,xp:24},
  yak:{n:'yak',t:'m_yak',hp:26,dmg:11,ac:3,ev:6,xp:8},
  blink_frog:{n:'blink frog',t:'m_blink_frog',hp:22,dmg:10,ac:1,ev:12,xp:9,blink:1},
  komodo:{n:'komodo dragon',t:'m_komodo',hp:30,dmg:13,ac:4,ev:7,xp:11},
  black_mamba:{n:'black mamba',t:'m_black_mamba',hp:26,dmg:12,ac:2,ev:13,xp:11,pois:1,spd:1.4},
  elephant:{n:'elephant',t:'m_elephant',hp:50,dmg:18,ac:5,ev:4,xp:16},
  death_yak:{n:'death yak',t:'m_death_yak',hp:44,dmg:17,ac:5,ev:6,xp:15},
  hydra:{n:'hydra',t:'m_hydra',hp:70,dmg:22,ac:2,ev:4,xp:28,multi:3},
  orc_priest:{n:'orc priest',t:'m_orc_priest',hp:24,dmg:9,ac:2,ev:8,xp:10,rng:1,mag:1,cast:'necro'},
  orc_knight:{n:'orc knight',t:'m_orc_knight',hp:48,dmg:20,ac:7,ev:8,xp:20},
  de_mage:{n:'deep elf annihilator',t:'m_de_mage',hp:35,dmg:22,ac:2,ev:12,xp:26,rng:1,mag:1,cast:'conj'},
  de_knight:{n:'deep elf knight',t:'m_de_knight',hp:42,dmg:19,ac:5,ev:12,xp:22},
  de_archer:{n:'deep elf archer',t:'m_de_archer',hp:34,dmg:17,ac:2,ev:14,xp:22,rng:1},
  de_sorcerer:{n:'deep elf sorcerer',t:'m_de_sorcerer',hp:40,dmg:26,ac:3,ev:12,xp:30,rng:1,mag:1,cast:'fire'},
  de_high_priest:{n:'deep elf high priest',t:'m_de_high_priest',hp:48,dmg:24,ac:4,ev:11,xp:32,rng:1,mag:1,cast:'necro'},
  vault_guard:{n:'vault guard',t:'m_vault_guard',hp:60,dmg:26,ac:8,ev:9,xp:30},
  war_gargoyle:{n:'war gargoyle',t:'m_war_gargoyle',hp:55,dmg:24,ac:12,ev:7,xp:32},
  ironbound:{n:'ironbound convoker',t:'m_ironbound',hp:58,dmg:24,ac:8,ev:6,xp:32,mag:1,rng:1},
  stone_golem:{n:'iron golem',t:'m_stone_golem',hp:90,dmg:30,ac:14,ev:2,xp:40,spd:.7},
  stone_giant:{n:'stone giant',t:'m_stone_giant',hp:96,dmg:35,ac:8,ev:2,xp:45,rng:1},
  fire_giant:{n:'fire giant',t:'m_fire_giant',hp:90,dmg:36,ac:8,ev:4,xp:48,mag:1,rng:1},
  frost_giant:{n:'frost giant',t:'m_frost_giant',hp:93,dmg:36,ac:9,ev:3,xp:48,mag:1,rng:1,chill:1},
  ettin:{n:'ettin',t:'m_ettin',hp:88,dmg:38,ac:6,ev:4,xp:44,multi:2},
  ghost_moth:{n:'ghost moth',t:'m_ghost_moth',hp:70,dmg:26,ac:6,ev:10,xp:40,drain:1},
  /* dmg was 38, the highest in Zot bar the Orb of Fire itself, and it landed through
     armour twice as hard as anything else there: a caster's bolt already counts a third
     of AC and half of resistance, and the necromantic drain healed it for another 40%
     of that. Three advantages stacked on the branch's most common monster. 26 puts its
     hit alongside the ghost moth, the other drainer, and lets the bolt and the drain
     stay -- those are what makes a lich a lich. */
  lich:{n:'lich',t:'m_lich',hp:88,dmg:26,ac:10,ev:10,xp:60,mag:1,cast:'necro',rng:1,drain:1,und:1},
  draconian_mon:{n:'draconian',t:'m_draconian',hp:70,dmg:30,ac:9,ev:9,xp:42,mag:1},
  orb_guardian:{n:'orb guardian',t:'m_orb_guardian',hp:130,dmg:45,ac:12,ev:6,xp:80},
  orb_of_fire:{n:'orb of fire',t:'m_orb_of_fire',hp:110,dmg:52,ac:20,ev:16,xp:100,mag:1,rng:1},
  ghoul_mon:{n:'ghoul',t:'m_ghoul',hp:36,dmg:15,ac:4,ev:6,xp:13,und:1},
  mummy:{n:'mummy',t:'m_mummy',hp:38,dmg:16,ac:3,ev:5,xp:14,spd:.8,und:1},
};

/* Bestiary families: every MONS key belongs to exactly one. The eternal
   Bestiary grants a permanent, hard-capped damage bonus against a family once
   enough of its members have been slain across all cycles. Uniques inherit
   their family from their `base` monster. Grouping is thematic, not by tier. */
export const FAMILIES = {
  beast:     ['rat','bat','jackal','adder','killer_bee','scorpion','centaur','wolf_spider','yak','blink_frog','komodo','black_mamba','elephant','death_yak','hydra','ghost_moth'],
  humanoid:  ['kobold','goblin','hobgoblin','gnoll','orc','orc_warrior','orc_priest','orc_knight','de_mage','de_knight','de_archer','de_sorcerer','de_high_priest','vault_guard','ironbound','draconian_mon'],
  giant:     ['ogre','two_headed_ogre','cyclops','troll_mon','minotaur_mon','stone_giant','fire_giant','frost_giant','ettin'],
  undead:    ['skeleton','zombie','wight','wraith','lich','ghoul_mon','mummy'],
  construct: ['war_gargoyle','stone_golem','orb_guardian','orb_of_fire'],
};
export const FAMILY_META = {
  beast:     { n:'Beasts',     ico:'🐺' },
  humanoid:  { n:'Humanoids',  ico:'⚔'  },
  giant:     { n:'Giants',     ico:'👹' },
  undead:    { n:'Undead',     ico:'💀' },
  construct: { n:'Constructs', ico:'🗿' },
};
export const FAMILY_KEYS = Object.keys(FAMILIES);
/** monster key → family key */
export const FAMILY_OF = {};
for (const fam in FAMILIES) for (const k of FAMILIES[fam]) FAMILY_OF[k] = fam;

/* Per-monster codex milestones — purely a display/collection track (discovered,
   hunted, nemesis, slayer). Kills are lifetime, across all cycles. */
export const TYPE_TIERS = [1, 10, 50, 200];
export const monTier = (s, kind) => {
  const n = (s.bestiary && s.bestiary[kind]) || 0;
  let t = 0; for (const need of TYPE_TIERS) if (n >= need) t++; return t;
};

export const familyKills = (s, fam) => {
  let n = 0; for (const k of FAMILIES[fam] || []) n += (s.bestiary && s.bestiary[k]) || 0; return n;
};
/* Family damage bonus — the capped eternal power, gated behind ENDGAME_GATE
   prestiges. A logarithmic curve on total family kills: it never saturates (each
   10x kills is another +FAM_STEP) and log naturally compresses the ~30x spread
   in how fast families are slain, so common and rare families land close
   together. A hero only ever gets the bonus for the family it is striking, so
   the effective average is well under the cap — it extends the curve without
   re-arming a runaway. Zero until the endgame unlocks. */
export const FAM_STEP = 0.05, FAM_CAP = 0.30;
export const familyDmgBonus = (s, fam) =>
  endgameUnlocked(s) ? Math.min(FAM_CAP, FAM_STEP * Math.log10(1 + familyKills(s, fam))) : 0;
/** display-only 0..4 "mastery" derived from the bonus, for the codex grid */
export const familyMastery = (s, fam) => Math.round((familyDmgBonus(s, fam) / FAM_CAP) * 4);
export const UNIQUES={
  ijyb:{n:'Ijyb',t:'u_ijyb',base:'goblin',mul:3,fl:[1,3],phr:'Ijyb shrieks, clutching his club!'},
  terence:{n:'Terence',t:'u_terence',base:'hobgoblin',mul:2.6,fl:[2,4],phr:'Terence thirsts for your blood!'},
  sigmund:{n:'Sigmund',t:'u_sigmund',base:'hobgoblin',mul:3.6,fl:[3,6],phr:'Sigmund grins and raises his scythe!'},
  grinder:{n:'Grinder',t:'u_grinder',base:'skeleton',mul:3,fl:[3,6],phr:'Grinder grinds out: "Pain!"'},
  edmund:{n:'Edmund',t:'u_edmund',base:'gnoll',mul:3.2,fl:[4,7],phr:'Edmund swings his flail idly.'},
  prince_ribbit:{n:'Prince Ribbit',t:'u_prince_ribbit',base:'blink_frog',mul:3,fl:[4,8],phr:'Prince Ribbit croaks about his throne.'},
  erica:{n:'Erica',t:'u_erica',base:'orc_warrior',mul:2.8,fl:[6,10],phr:'Erica salutes you with a curved blade.'},
  urug:{n:'Urug',t:'u_urug',base:'orc_knight',mul:2.4,fl:[6,10],phr:'Urug spits at your feet.'},
  snorg:{n:'Snorg',t:'u_snorg',base:'troll_mon',mul:2.6,fl:[8,13],phr:'Snorg is HUNGRY!'},
  rupert:{n:'Rupert',t:'u_rupert',base:'cyclops',mul:2.8,fl:[9,14],phr:'Rupert bellows a battle cry!'},
  frances:{n:'Frances',t:'u_frances',base:'de_knight',mul:3,fl:[11,15],phr:'Frances whispers a curse.'},
  boris:{n:'Boris',t:'u_boris',base:'lich',mul:1.6,fl:[13,15],phr:'Boris has risen from the dead. Again.'},
  blork:{n:'Blork',t:'u_blork',base:'orc',mul:4,fl:[2,5],phr:'Blork is an unusually angry orc.'},
  xtahua:{n:'Xtahua',t:'u_xtahua',base:'fire_giant',mul:2.2,fl:[1,5],br:'depths',phr:'XTAHUA ROARS!'},
  margery:{n:'Margery',t:'u_margery',base:'draconian_mon',mul:2.4,fl:[2,5],br:'depths',phr:'Margery commands the flames.'},
  lernaean:{n:'the Lernaean hydra',t:'u_lernaean',base:'hydra',mul:2.8,fl:[6,6],br:'lair',phr:'The Lernaean hydra hisses with a hundred heads!'},
};
