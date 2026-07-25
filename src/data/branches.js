export const BRANCHES={
  dungeon:{n:'Dungeon',short:'D',floors:15,floor:'d_floor',floor2:'d_floor2',wall:'d_wall',
    mobs:[['rat',1,3],['bat',1,4],['kobold',1,4],['goblin',1,4],['jackal',1,5],['hobgoblin',2,6],
      ['adder',2,6],['gnoll',3,8],['orc',3,9],['skeleton',4,10],['zombie',4,10],['killer_bee',5,10],
      ['scorpion',5,11],['ogre',6,12],['centaur',6,12],['wight',7,12],['orc_warrior',8,14],
      ['wolf_spider',9,15],['wraith',10,15],['two_headed_ogre',11,15],['cyclops',12,15],
      ['troll_mon',12,15],['minotaur_mon',13,15],['mummy',10,15],['ghoul_mon',8,14]]},
  lair:{n:'the Lair',short:'Lair',floors:6,floor:'d_floor_lair',floor2:'d_floor_lair',wall:'d_wall_lair',
    req:s=>s.progress.D>=8,reqTxt:'D:8',
    mobs:[['yak',1,4],['blink_frog',1,5],['komodo',2,5],['black_mamba',2,6],['elephant',3,6],
      ['death_yak',4,6],['hydra',4,6],['wolf_spider',2,6]],
    boss:'lernaean',rune:'the serpentine rune',bossMulU:3.5},
  orc:{n:'the Orcish Mines',short:'Orc',floors:4,floor:'d_floor2',floor2:'d_floor',wall:'d_wall',
    req:s=>s.progress.D>=10,reqTxt:'D:10',
    mobs:[['orc',1,4],['orc_warrior',1,4],['orc_priest',1,4],['ogre',1,4],['orc_knight',2,4],
      ['two_headed_ogre',3,4],['troll_mon',3,4]],
    bossMon:'orc_knight',bossN:'orc warlord',bossT:'m_orc_warlord',bossMul:3.6,rune:'the iron rune'},
  elf:{n:'the Elven Halls',short:'Elf',floors:3,floor:'d_floor_elf',floor2:'d_floor_elf',wall:'d_wall_elf',
    req:s=>s.progress.Orc>=4,reqTxt:'Orc:4',
    mobs:[['de_mage',1,3],['de_knight',1,3],['de_archer',1,3],['de_sorcerer',2,3],['de_high_priest',2,3]],
    bossMon:'de_knight',bossN:'deep elf blademaster',bossT:'m_de_blademaster',bossMul:4.2,rune:'the crystal rune'},
  vaults:{n:'the Vaults',short:'Vaults',floors:5,floor:'d_floor_vault',floor2:'d_floor_vault',wall:'d_wall_vault',
    req:s=>s.progress.D>=12&&s.runesTotal>=1,reqTxt:'D:12 + 1 rune',
    mobs:[['vault_guard',1,5],['war_gargoyle',1,5],['ironbound',2,5],['stone_golem',2,5],
      ['wraith',1,4],['lich',4,5],['minotaur_mon',1,4]],
    bossMon:'vault_guard',bossN:'vault warden',bossT:'m_vault_warden',bossMul:4.2,rune:'the silver rune'},
  depths:{n:'the Depths',short:'Depths',floors:5,floor:'d_floor2',floor2:'d_floor',wall:'d_wall',
    req:s=>s.progress.D>=15,reqTxt:'D:15',
    mobs:[['stone_giant',1,5],['fire_giant',1,5],['frost_giant',2,5],['ettin',1,5],
      ['ghost_moth',2,5],['lich',3,5],['draconian_mon',2,5]],
    bossMon:'fire_giant',bossN:'lord of the Depths',bossT:'m_fire_giant',bossMul:4.6,rune:'the demonic rune'},
  abyss:{n:'the Abyss',short:'Abyss',floors:999,every:10,floor:'d_floor_abyss',floor2:'d_floor_abyss',wall:'d_wall_abyss',
    req:s=>false,reqTxt:'the Abyssal Rift keystone',
    mobs:[['orc_warrior',1,999],['ogre',1,999],['wraith',1,999],['hydra',1,999],['de_knight',1,999],
      ['vault_guard',1,999],['stone_giant',1,999],['fire_giant',1,999],['ettin',1,999],
      ['ghost_moth',1,999],['lich',1,999],['draconian_mon',1,999],['orb_guardian',1,999],['mummy',1,999]],
    bossMon:'lich',bossN:'lord of the rift',bossT:'m_lich',bossMul:3,rune:'the abyssal rune'},
  zot:{n:'the Realm of Zot',short:'Zot',floors:5,floor:'d_floor_zot',floor2:'d_floor_zot',wall:'d_wall_zot',
    req:s=>s.runesTotal>=3,reqTxt:'3 runes',
    mobs:[['draconian_mon',1,5],['orb_guardian',2,5],['ghost_moth',1,4],['lich',1,5],['orb_of_fire',3,5]],
    bossMon:'orb_of_fire',bossN:'keeper of the Orb',bossT:'m_orb_of_fire',bossMul:2.6,orb:true}
};
export const BR_ORDER=['dungeon','lair','orc','elf','vaults','depths','zot'];
/* classic route: list of [branch, floors] segments */
export function buildRoute(strategy){
  if(strategy==='abyss')return [['dungeon',8],['abyss',999]];
  if(strategy==='speed')return [['dungeon',15],['lair',6],['orc',4],['depths',5],['zot',5]];
  return [['dungeon',8],['lair',6],['dungeon',10],['orc',4],['elf',3],['dungeon',15],
    ['vaults',5],['depths',5],['zot',5]];
}

export const BR_OFFSET={dungeon:0,lair:6,orc:9,elf:12,vaults:13,depths:16,zot:21,abyss:12};
export const brDepth=h=>BR_OFFSET[h.branch]+h.floor;
import {PORTALS} from './portals.js';
import { t } from '../i18n/index.js';
export const brTag=h=>{
  if(h.inPortal)return t(PORTALS[h.inPortal.type].n)+(PORTALS[h.inPortal.type].floors>1?':'+h.inPortal.floor:'');
  return h.branch?BRANCHES[h.branch].short+':'+h.floor:'—';
};
