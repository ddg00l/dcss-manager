import { endgameUnlocked } from './endgame.js';

export const GODS={
  trog:{n:'Trog',alt:'d_altar_trog',d:'+30% melee damage, berserk below 30% HP',mel:1.3,berserk30:1},
  okawaru:{n:'Okawaru',alt:'d_altar_oka',d:'+8% damage, heroism against uniques and bosses',dmg:1.08,hero:1.25},
  makhleb:{n:'Makhleb',alt:'d_altar_makhleb',d:'Heals 3% HP on every kill',healkill:.03},
  sif_muna:{n:'Sif Muna',alt:'d_altar_sif',d:'+25% spell damage, casts freely in armour',mag:1.25},
  vehumet:{n:'Vehumet',alt:'d_altar_vehumet',d:'+35% spell damage',mag:1.35},
  elyvilon:{n:'Elyvilon',alt:'d_altar_ely',d:'Periodic healing, +15% HP',hp:1.15,healtick:1},
  kikubaaqudgha:{n:'Kikubaaqudgha',alt:'d_altar_kiku',d:'+28% spell damage, drains 2% HP on kill',mag:1.28,healkill:.02},
  yredelemnul:{n:'Yredelemnul',alt:'d_altar_yred',d:'+25% HP, +20% melee — the reaper is hard to fell',hp:1.25,mel:1.2},
  cheibriados:{n:'Cheibriados',alt:'d_altar_chei',d:'The patient titan: +30% HP, +15% damage, steady renewal',hp:1.3,dmg:1.15,healtick:1},
  nemelex:{n:'Nemelex Xobeh',alt:'d_altar_nemelex',d:'+12% damage, draws a winning card against uniques and bosses',dmg:1.12,hero:1.2},
};
export const GODKEYS=Object.keys(GODS);

/* Pantheon: favor is lifetime Orbs carried out while pledged to a god. It never
   resets across cycles. Reaching a threshold raises that god's favor tier, which
   permanently amplifies the god's own bonuses for any future hero who pledges to
   it. Favor accrues from the first cycle, but the amplification is gated behind
   ENDGAME_GATE prestiges — so at unlock the favor already earned across the run
   switches on at once. Hard-capped (max tier 4 → +40% of the bonus) so it
   extends the curve without re-arming a runaway. */
export const FAVOR_TIERS=[1,5,15,40]; /* Orbs for tiers 1..4 */
export const FAVOR_STEP=.10;          /* +10% of the bonus per favor tier, cap +40% */
export const godFavor=(s,g)=>{const w=(s.pantheon&&s.pantheon[g])||0;let t=0;for(const need of FAVOR_TIERS)if(w>=need)t++;return t;};
export const godFavorMul=(s,g)=>endgameUnlocked(s)?1+godFavor(s,g)*FAVOR_STEP:1;
/* Multiplicative combat fields whose "bonus" (value − 1) is amplified by favor. */
const MULT_FIELDS=new Set(['mel','dmg','mag','hp','hero']);
/** a god's effect field for a hero, with favor amplification applied */
export function godField(s,g,field){
  const base=GODS[g]&&GODS[g][field];
  if(base===undefined)return undefined;
  const mul=godFavorMul(s,g);
  if(MULT_FIELDS.has(field))return 1+(base-1)*mul; /* amplify the bonus above 1x */
  if(field==='healkill')return base*mul;           /* amplify the lifesteal directly */
  return base;                                     /* slow / flags: favor never worsens a penalty */
}
