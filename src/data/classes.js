export const CLASSES={
  fighter:{n:'Fighter',style:'melee',wep:'long_sword',arm:'scale_mail',sh:1,skills:{fighting:3,long_blades:3,armour:3},ac:2,d:'+AC, sturdy defence'},
  berserker:{n:'Berserker',style:'melee',wep:'war_axe',arm:'leather',god:'trog',skills:{fighting:4,axes:3},rage:1,d:'Trog\'s wrath in battle'},
  gladiator:{n:'Gladiator',style:'melee',wep:'short_sword',arm:'leather',sh:1,skills:{fighting:3,short_blades:4,dodging:2},aspd:1.15,d:'+15% attack speed'},
  monk:{n:'Monk',style:'melee',wep:null,arm:'robe',skills:{fighting:3,unarmed:4,dodging:3},dodge:1,d:'Fists and dodging'},
  hunter:{n:'Hunter',style:'ranged',wep:'bow',arm:'leather',skills:{bows:4,fighting:2,dodging:2},d:'Strikes from afar'},
  assassin:{n:'Assassin',style:'melee',wep:'dagger',arm:'robe',skills:{short_blades:3,stealth:4,dodging:3},crit:.15,d:'+15% stab crit chance'},
  wizard:{n:'Wizard',style:'magic',wep:'quarterstaff',arm:'robe',skills:{spellcasting:4,conjurations:2,dodging:2},blink:1,d:'Blinks away from danger'},
  conjurer:{n:'Conjurer',style:'magic',wep:null,arm:'robe',skills:{spellcasting:3,conjurations:4},mag:1.2,d:'+20% spell damage'},
  necromancer:{n:'Necromancer',style:'magic',wep:null,arm:'robe',skills:{spellcasting:3,necromancy:4},drain:.25,raise:1,d:'Drains life and raises the fallen'},
  fire_el:{n:'Fire Elementalist',style:'magic',wep:null,arm:'robe',skills:{spellcasting:3,fire:4},aoe:1,d:'Fire splashes onto neighbours'},
  ice_el:{n:'Ice Elementalist',style:'magic',wep:null,arm:'robe',skills:{spellcasting:3,ice:4},chill:1,d:'Frost slows enemies'},
  summoner:{n:'Summoner',style:'magic',wep:null,arm:'robe',skills:{spellcasting:3,summonings:4},summon:1,d:'Summons creatures to fight'},
};
export const CKEYS=Object.keys(CLASSES);
