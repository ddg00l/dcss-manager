export const GODS={
  trog:{n:'Trog',alt:'d_altar_trog',d:'+30% melee damage, berserk below 30% HP',mel:1.3,berserk30:1},
  okawaru:{n:'Okawaru',alt:'d_altar_oka',d:'+8% damage, heroism against uniques and bosses',dmg:1.08,hero:1.25},
  makhleb:{n:'Makhleb',alt:'d_altar_makhleb',d:'Heals 3% HP on every kill',healkill:.03},
  sif_muna:{n:'Sif Muna',alt:'d_altar_sif',d:'+25% spell damage, casts freely in armour',mag:1.25},
  vehumet:{n:'Vehumet',alt:'d_altar_vehumet',d:'+35% spell damage',mag:1.35},
  elyvilon:{n:'Elyvilon',alt:'d_altar_ely',d:'Periodic healing, +15% HP',hp:1.15,healtick:1},
};
export const GODKEYS=Object.keys(GODS);
