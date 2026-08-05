export const BRANCHES={
  dungeon:{n:'Dungeon',short:'D',floors:15,floor:'d_floor',floor2:'d_floor2',wall:'d_wall',
    mobs:[['rat',1,3],['bat',1,4],['kobold',1,4],['goblin',1,4],['jackal',1,5],['hobgoblin',2,6],
      ['adder',2,6],['gnoll',3,8],['orc',3,9],['skeleton',4,10],['zombie',4,10],['killer_bee',5,10],
      ['scorpion',5,11],['ogre',6,12],['centaur',6,12],['wight',7,12],['orc_warrior',8,14],
      ['wolf_spider',9,15],['wraith',10,15],['two_headed_ogre',11,15],['cyclops',12,15],
      ['troll_mon',12,15],['minotaur_mon',13,15],['mummy',10,15],['ghoul_mon',8,14]],
    /* The Dungeon is a corridor, not a treasury. It used to drop as much gear as
       everywhere else across fifteen unbiased floors, which drowned every branch's
       character: three roads with entirely different destinations measured 1.23x
       apart in what they brought home. Loot lives at the branch ends, as in DCSS. */
    /* Armed humanoids, so what drops is mostly what they were holding. This is also
       what keeps the neutral background from washing the roads out: an unbiased
       Dungeon spread its drops evenly over five slots, which is two-fifths jewellery,
       and fifteen floors of that pulled every road to the same share. */
    loot:{slots:['weapon','armour','shield','ring'],gear:.6}},
  lair:{n:'the Lair',short:'Lair',floors:6,floor:'d_floor_lair',floor2:'d_floor_lair',wall:'d_wall_lair',
    req:s=>s.progress.D>=8,reqTxt:'D:8',
    mobs:[['yak',1,4],['blink_frog',1,5],['komodo',2,5],['black_mamba',2,6],['elephant',3,6],
      ['death_yak',4,6],['hydra',4,6],['wolf_spider',2,6]],
    boss:'lernaean',rune:'the serpentine rune',
    /* beasts hoard nothing: the Lair pays in reagents, not steel */
    /* Beasts carry nothing worth taking, so the Lair barely contributes gear at all
       -- which is what lets it sit on every road without blurring their characters. */
    loot:{slots:['ring','amulet'],gear:.35,luck:.35,cons:1.5}},
  swamp:{n:'the Swamp',short:'Swamp',floors:4,floor:'d_floor_lair',floor2:'d_floor_lair',wall:'d_wall_lair',
    req:s=>s.progress.Lair>=3,reqTxt:'Lair:3',
    mobs:[['blink_frog',1,3],['adder',1,3],['black_mamba',1,4],['komodo',1,4],['zombie',1,4],
      ['hydra',2,4],['wolf_spider',2,4],['scorpion',1,3],['ghoul_mon',3,4]],
    bossMon:'hydra',bossN:'the bog mother',bossT:'m_hydra',bossMul:3.6,rune:'the decaying rune',
    /* the Swamp is the Wild Road's own branch and carries its character alone: bogs
       yield reagents in quantity and almost nothing you can wear */
    loot:{slots:['ring','armour'],gear:.5,luck:.4,cons:6}},
  spider:{n:'the Spider Nest',short:'Spider',floors:4,floor:'d_floor_lair',floor2:'d_floor_lair',wall:'d_wall_lair',
    req:s=>s.progress.Lair>=4,reqTxt:'Lair:4',
    mobs:[['wolf_spider',1,4],['scorpion',1,3],['killer_bee',1,4],['komodo',1,3],
      ['ghost_moth',3,4],['adder',1,2]],
    bossMon:'wolf_spider',bossN:'the broodmother',bossT:'m_wolf_spider',bossMul:3.8,
    rune:'the gossamer rune',
    /* silk and trinkets: the Nest is the second place the Arcane Road can be itself,
       which is what lets that road stop needing the Vaults for its third rune */
    loot:{slots:['ring','amulet','amulet'],gear:3,cons:.8}},
  orc:{n:'the Orcish Mines',short:'Orc',floors:4,floor:'d_floor2',floor2:'d_floor',wall:'d_wall',
    req:s=>s.progress.D>=10,reqTxt:'D:10',
    mobs:[['orc',1,4],['orc_warrior',1,4],['orc_priest',1,4],['ogre',1,4],['orc_knight',2,4],
      ['two_headed_ogre',3,4],['troll_mon',3,4]],
    bossMon:'orc_knight',bossN:'orc warlord',bossT:'m_orc_warlord',bossMul:3.6,rune:'the iron rune',
    /* the Mines are an armoury: orcs carry what they fight with */
    loot:{slots:['weapon','weapon','weapon','armour','armour','shield'],gear:4,cons:.6}},
  elf:{n:'the Elven Halls',short:'Elf',floors:3,floor:'d_floor_elf',floor2:'d_floor_elf',wall:'d_wall_elf',
    req:s=>s.progress.Orc>=4,reqTxt:'Orc:4',
    mobs:[['de_mage',1,3],['de_knight',1,3],['de_archer',1,3],['de_sorcerer',2,3],['de_high_priest',2,3]],
    bossMon:'de_knight',bossN:'deep elf blademaster',bossT:'m_de_blademaster',bossMul:4.2,rune:'the crystal rune',
    /* elven work is enchantment, not plate */
    /* pure enchantment: the Halls are the one place a road can be defined by */
    loot:{slots:['ring','ring','amulet','amulet'],gear:5,cons:.5}},
  vaults:{n:'the Vaults',short:'Vaults',floors:5,floor:'d_floor_vault',floor2:'d_floor_vault',wall:'d_wall_vault',
    req:s=>s.progress.D>=12&&s.runesTotal>=1,reqTxt:'D:12 + 1 rune',
    mobs:[['vault_guard',1,5],['war_gargoyle',1,5],['ironbound',2,5],['stone_golem',2,5],
      ['wraith',1,4],['lich',4,5],['minotaur_mon',1,4]],
    bossMon:'vault_guard',bossN:'vault warden',bossT:'m_vault_warden',bossMul:4.2,rune:'the silver rune',
    /* the Vaults are a fortress: plate and shields off dead guards */
    loot:{slots:['armour','armour','shield','shield','weapon'],gear:4,cons:.6}},
  depths:{n:'the Depths',short:'Depths',floors:5,floor:'d_floor2',floor2:'d_floor',wall:'d_wall',
    req:s=>s.progress.D>=15,reqTxt:'D:15',
    mobs:[['stone_giant',1,5],['fire_giant',1,5],['frost_giant',2,5],['ettin',1,5],
      ['ghost_moth',2,5],['lich',3,5],['draconian_mon',2,5]],
    bossMon:'fire_giant',bossN:'lord of the Depths',bossT:'m_fire_giant',bossMul:4.6,rune:'the demonic rune',
    loot:{gear:1.5,cons:.8}},
  tomb:{n:'the Tomb',short:'Tomb',floors:3,floor:'d_floor_vault',floor2:'d_floor_vault',wall:'d_wall_vault',
    req:s=>s.progress.D>=13&&s.runesTotal>=1,reqTxt:'D:13 + 1 rune',
    mobs:[['mummy',1,3],['wraith',1,3],['skeleton',1,2],['zombie',1,2],['wight',1,2],
      ['ghoul_mon',2,3],['lich',2,3]],
    bossMon:'mummy',bossN:'the royal mummy',bossT:'m_mummy',bossMul:4.4,rune:'the golden rune',
    /* grave goods: the dead are buried with their jewellery and their gold */
    loot:{slots:['armour','armour','weapon','amulet'],gear:2,gold:3.5,cons:.5}},
  abyss:{n:'the Abyss',short:'Abyss',floors:999,every:10,floor:'d_floor_abyss',floor2:'d_floor_abyss',wall:'d_wall_abyss',
    req:s=>false,reqTxt:'the Abyssal Rift keystone',
    mobs:[['orc_warrior',1,999],['ogre',1,999],['wraith',1,999],['hydra',1,999],['de_knight',1,999],
      ['vault_guard',1,999],['stone_giant',1,999],['fire_giant',1,999],['ettin',1,999],
      ['ghost_moth',1,999],['lich',1,999],['draconian_mon',1,999],['orb_guardian',1,999],['mummy',1,999]],
    bossMon:'lich',bossN:'lord of the rift',bossT:'m_lich',bossMul:3,rune:'the abyssal rune'},
  zot:{n:'the Realm of Zot',short:'Zot',floors:5,floor:'d_floor_zot',floor2:'d_floor_zot',wall:'d_wall_zot',
    req:s=>s.runesTotal>=3,reqTxt:'3 runes',loot:{gear:1.5},
    mobs:[['draconian_mon',1,5],['orb_guardian',2,5],['ghost_moth',1,4],['lich',1,5],['orb_of_fire',3,5]],
    bossMon:'orb_of_fire',bossN:'keeper of the Orb',bossT:'m_orb_of_fire',bossMul:2.6,orb:true}
};
export const BR_ORDER=['dungeon','lair','swamp','spider','orc','elf','vaults','depths','tomb','zot'];
/* The reference set for monster depth-scaling. makeMon scales a monster by how far
   the floor is from the average depth its KIND appears at, and that average used to
   be computed over every branch in BR_ORDER -- so adding a branch silently
   rescaled monsters game-wide. Putting mummies in the Tomb at depth 18 would have
   dragged the mummy average from 12 to 15 and quietly made every Dungeon mummy
   weaker. New branches draw on the existing bestiary deliberately; they must not
   redefine what that bestiary means. Pin the reference and leave it pinned. */
export const BR_CORE=['dungeon','lair','orc','elf','vaults','depths','zot'];

/* THE ROADS.

   These used to be "classic" and "speedrun", which is a difference of LENGTH:
   the short road is faster and poorer, the long one slower and richer. Measured,
   that is exactly what it did -- the two roads brought home the same kinds of
   rune (a 1.05x spread) while differing 1.75x in Orbs, i.e. the selector labelled
   "route" was really a second tempo control, and tempo already belongs to the
   Memory tree and to attention. Squeezing the speedrun to three rune branches
   made it distinct only by making it fail (1 Orb against 43).

   So the roads are now near-equal in length and differ in WHAT THEY YIELD. Each
   carries four rune branches -- the Gates demand three, so every road can afford
   one missed boss -- and each has its own loot character, which comes from the
   branches themselves (see `loot` above), not from a multiplier on the road. A branch
   that yields little gear yields BETTER gear (`luck`), so the reagent road is poorer
   in quantity without simply being poorer.

     iron   steel and the grave: weapons, plate, shields, and the Tomb's gold
     wild   fang and venom: reagents and potions, little steel
     arcane enchantment: rings, amulets, and grave goods

   The speedrun survives as an explicit fourth choice whose price is stated: it is
   the tempo option, and it is measured on the tempo axis, not against these.

   The three mandatory rune branches of each road are DEPTH-MATCHED -- one shallow,
   one middling, one deep -- and the fourth, the slack, is the deepest and comes
   last so it is skipped whenever the first three paid out. Without that the roads
   were secretly tempo again: the Wild Road's three shallowest branches let it reach
   the Gates while the Iron Road was still clearing the Vaults and the Depths, which
   measured as a 12x spread in Orbs. Every road now starts in the Lair, as every
   DCSS game does, and the sums of its mandatory depths come to 28, 30 and 31.

   Every road also has the same SHAPE: the Dungeon to D:8, the shallow rune branch,
   the rest of the Dungeon, then the deeper branches. The Iron Road used to break off
   for the Mines at D:10 and came to the Vaults two floors and a great deal of
   experience short -- it lost 160 seekers there where the Arcane Road lost 44, took
   its first Orb on day 6 instead of day 3, and so never crossed the three-Orb
   prestige threshold at all. That is what produced a 14x spread in Orbs between
   roads whose hauls were interchangeable: swapping the Iron Road's loot for
   jewellery changed nothing, so the loot was never the cause.

     iron    Lair -> Mines -> Vaults      (slack: the Tomb)
     wild    Lair -> Swamp -> Depths      (slack: the Tomb)
     arcane  Lair -> Spider Nest -> Elven Halls (slack: the Vaults)

   The Spider Nest exists for exactly one reason: without it the Arcane Road had to
   clear the Vaults for its third rune, and the Vaults' plate and shields cancelled
   the Elven Halls' jewellery so precisely that the road measured the same haul as
   every other one. A road cannot have a character it is forced to dilute. */
const ROADS={
  iron:   [['dungeon',8],['lair',6],['dungeon',15],['orc',4],['vaults',5],['tomb',3],['zot',5]],
  wild:   [['dungeon',8],['lair',6],['swamp',4],['dungeon',15],['depths',5],['tomb',3],['zot',5]],
  /* orc is capped one floor short of the warlord: the Elven Halls lie below the
     Mines, so the arcane road passes THROUGH them without taking the iron rune */
  arcane: [['dungeon',8],['lair',6],['spider',4],['dungeon',15],['orc',3],['elf',3],['vaults',5],['zot',5]],
  /* The Short Road kept the shape the others were fixed out of -- straight to D:15
     before any branch, so its seekers met the deep Dungeon under-levelled -- and it
     carried FOUR rune branches, which is slack, which is the opposite of short. It
     measured as a pure trap on 30 days: more seekers at the Gates (3280 against
     2622), fewer Orbs (197 against 240), more dead (4150 against 3472), and no faster
     to the first Orb (6.00 days against 6.17). Now it is honestly short: the same
     shape as the rest, exactly three rune branches for the three the Gates demand, and
     the shallowest deep end of any road -- the Elven Halls rather than the Vaults. */
  speed:  [['dungeon',8],['lair',6],['dungeon',15],['orc',4],['elf',3],['zot',5]],
};
export const ROAD_KEYS=['iron','wild','arcane','speed'];
/* What the player is actually choosing between. A road that cannot be described in
   one line is a road the player cannot choose deliberately. */
/** The runes a road actually bottoms out in. Derived rather than written down: a
    hand-kept list drifts the moment a segment changes, and deriving it also means
    the names go through the dictionary like every other rune name. A segment capped
    short of the branch floor (the arcane road passing through the Mines) holds no
    rune -- the boss does, and the road never reaches it. */
export const roadRunes=road=>buildRoute(road)
  .filter(([k,lim])=>BRANCHES[k].rune&&lim>=BRANCHES[k].floors)
  .map(([k])=>BRANCHES[k].rune);
export const ROAD_INFO={
  iron:{n:'the Iron Road',yield:'weapons, plate and shields; the Tomb pays in gold'},
  wild:{n:'the Wild Road',yield:'potions and scrolls in quantity, little steel'},
  arcane:{n:'the Arcane Road',yield:'rings, amulets and grave goods'},
  speed:{n:'the Short Road',yield:'least of everything, soonest — and it can fail: '
    +'three rune branches for the three the Gates demand',runes:'serpentine · iron · crystal · demonic'},
};
/* saves predate the themed roads */
export const ROAD_ALIAS={classic:'iron'};
export const roadOf=strategy=>ROAD_ALIAS[strategy]||(ROADS[strategy]?strategy:'iron');
export function buildRoute(strategy){
  if(strategy==='abyss')return [['dungeon',8],['abyss',999]];
  return ROADS[roadOf(strategy)];
}

export const BR_OFFSET={dungeon:0,lair:6,swamp:8,spider:10,orc:9,elf:12,vaults:13,depths:16,tomb:17,zot:21,abyss:12};
export const brDepth=h=>BR_OFFSET[h.branch]+h.floor;
import {PORTALS} from './portals.js';
import { t } from '../i18n/index.js';
export const brTag=h=>{
  if(h.inPortal)return t(PORTALS[h.inPortal.type].n)+(PORTALS[h.inPortal.type].floors>1?':'+h.inPortal.floor:'');
  return h.branch?BRANCHES[h.branch].short+':'+h.floor:'—';
};
