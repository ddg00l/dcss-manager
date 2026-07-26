import {RACES} from './races.js';
import {CLASSES} from './classes.js';
export const LEG_COMBOS=['minotaur/berserker','troll/berserker','deep_elf/conjurer','spriggan/assassin',
  'merfolk/gladiator','gargoyle/fighter','draconian/fire_el','felid/monk','naga/wizard','demonspawn/necromancer'];
export const EPIC_COMBOS=['minotaur/fighter','minotaur/gladiator','troll/monk','troll/fighter','deep_elf/wizard',
  'deep_elf/summoner','deep_elf/fire_el','deep_elf/ice_el','spriggan/hunter','merfolk/fighter',
  'gargoyle/monk','gargoyle/berserker','draconian/conjurer','kobold/assassin','kobold/hunter',
  'demonspawn/wizard','ghoul/berserker','ghoul/monk','naga/necromancer','octopode/assassin',
  'octopode/wizard','felid_x','tengu/conjurer','tengu/gladiator','human/fighter_x','dwarf/fighter','dwarf/berserker'];
export function comboRarity(r,c){
  const k=r+'/'+c;
  if(LEG_COMBOS.includes(k))return 3;
  if(EPIC_COMBOS.includes(k))return 2;
  const st=CLASSES[c].style;
  const good=(st==='magic'&&(RACES[r].mag||RACES[r].mp>=1.1))||
             (st==='melee'&&(RACES[r].dmg>=1.05||RACES[r].hp>=1.1))||
             (st==='ranged'&&RACES[r].ev>=3);
  return good?1:0;
}
export const RARN=['Common','Rare','Epic','Legendary'];
export const RARMUL=[1,1.15,1.35,1.6];
export const SHARDS_PER=[1,2,4,8];
/* star promotions never cap: exponential shard costs, +8% power each —
   any activity (even dying) feeds shards, so account power always grows */
export const starNeed=st=>Math.pow(2,st+1);
export const starStr=n=>!n?'':n<=5?'\u2605'.repeat(n):'\u2605\u00d7'+n;

export const comboKey=(r,c)=>r+'/'+c;
