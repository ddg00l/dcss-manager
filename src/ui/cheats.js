/* Dev cheat panel. Call __cheats.show() in the console to open it. Self-contained:
   builds its own DOM, no markup in index.html. Ships with the app (same posture
   as the existing window.__save console access) — harmless unless invoked. */
import { save, persist, resetSave } from '../core/state.js';
import { doPrestige } from '../core/prestige.js';
import { gainMem } from '../data/memtree.js';
import { rollHero } from '../sim/hero.js';
import { heroWin } from '../sim/tick.js';
import { completedFtue } from '../core/ftue.js';
import { doAscension } from '../core/ascension.js';

const refresh = () => { persist(); if (window.__renderAll) window.__renderAll(); };

const cheats = {
  gold:    n => { save.gold += n; refresh(); },
  mem:     n => { gainMem(save, n); refresh(); },
  zot:     n => { save.zot += n; refresh(); },
  scrap:   n => { save.scrap += n; refresh(); },
  runes:   n => { save.runes += n; save.runesTotal = (save.runesTotal || 0) + n; refresh(); },
  legends: n => { save.legends = (save.legends || 0) + n; refresh(); },
  summon:  () => { rollHero(save, false); refresh(); },
  /** carry the Orb with the first delving hero (fires the win screen), or bump wins */
  win: () => {
    const h = save.heroes.find(x => x.state === 'run');
    if (h) heroWin(h, save);
    else { save.stat.wins = (save.stat.wins || 0) + 1; save.zot += 10; }
    refresh();
  },
  ascendancy: n => { save.ascendancy = (save.ascendancy || 0) + n; refresh(); },
  /** satisfy this cycle's Orb requirement, then prestige */
  prestige: () => {
    save.stat.wins = (save.cycBase?.wins ?? 0) + (save.prestReq ?? 1);
    const r = doPrestige(save); refresh(); return r;
  },
  prestige10: () => { for (let i = 0; i < 10; i++) { save.stat.wins = (save.cycBase?.wins ?? 0) + (save.prestReq ?? 1); doPrestige(save); } refresh(); },
  /** force an Ascension for testing: meet the gate + guarantee a positive gain */
  ascend: () => {
    save.prestiges = Math.max(save.prestiges || 0, 10);
    if ((save.stat.wins || 0) - (save.ascBase || 0) < 200) save.stat.wins = (save.ascBase || 0) + 200;
    const g = doAscension(save); refresh(); return g;
  },
  unlockAll: () => { save.ftue = completedFtue(); refresh(); },
  reset: () => { if (confirm('Wipe the save and start fresh?')) { resetSave(); refresh(); } },
};

let panel = null;
function build() {
  panel = document.createElement('div');
  panel.style.cssText =
    'position:fixed;top:52px;right:8px;z-index:300;width:min(300px,92vw);' +
    'max-height:calc(100dvh - 90px);overflow:auto;background:var(--panel,#131720);' +
    'border:1px solid var(--gold,#ecc95e);border-radius:8px;padding:10px 10px 12px;' +
    'display:flex;flex-direction:column;gap:6px;font-family:var(--mono,monospace);' +
    'box-shadow:0 6px 30px rgba(0,0,0,.7)';

  const head = document.createElement('div');
  head.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:2px';
  const title = document.createElement('b');
  title.textContent = '🛠 CHEATS';
  title.style.cssText = 'color:var(--gold,#ecc95e);font-size:12px;letter-spacing:.1em;flex:1';
  const x = mkBtn('✕', () => hide());
  x.style.minWidth = '30px';
  head.append(title, x);
  panel.appendChild(head);

  const row = (label, ...btns) => {
    const r = document.createElement('div');
    r.style.cssText = 'display:flex;align-items:center;gap:5px;flex-wrap:wrap';
    const l = document.createElement('span');
    l.textContent = label;
    l.style.cssText = 'font-size:10px;color:var(--dim,#6b7688);width:74px;flex-shrink:0';
    r.append(l, ...btns);
    panel.appendChild(r);
  };

  row('Gold 🜚',    mkBtn('+1M', () => cheats.gold(1e6)), mkBtn('+1B', () => cheats.gold(1e9)));
  row('Memory 🕯',  mkBtn('+10k', () => cheats.mem(1e4)), mkBtn('+1M', () => cheats.mem(1e6)));
  row('Zot ⚛',     mkBtn('+100', () => cheats.zot(100)), mkBtn('+1k', () => cheats.zot(1000)));
  row('Scrap ⚙',   mkBtn('+100', () => cheats.scrap(100)), mkBtn('+1k', () => cheats.scrap(1000)));
  row('Runes ᚱ',   mkBtn('+3', () => cheats.runes(3)), mkBtn('+15', () => cheats.runes(15)));
  row('Legends ⚜', mkBtn('+50', () => cheats.legends(50)), mkBtn('+500', () => cheats.legends(500)));
  row('Ascend ✦',  mkBtn('+10', () => cheats.ascendancy(10)), mkBtn('+50', () => cheats.ascendancy(50)));

  const sep = document.createElement('div');
  sep.style.cssText = 'height:1px;background:var(--line,#2a3442);margin:4px 0';
  panel.appendChild(sep);

  const acts = document.createElement('div');
  acts.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px';
  acts.append(
    mkBtn('Summon', () => cheats.summon()),
    mkBtn('Win Orb', () => cheats.win()),
    mkBtn('Prestige', () => cheats.prestige()),
    mkBtn('Prestige ×10', () => cheats.prestige10()),
    mkBtn('Ascend', () => cheats.ascend()),
    mkBtn('Unlock tabs', () => cheats.unlockAll()),
  );
  panel.appendChild(acts);
  const reset = mkBtn('Reset save', () => cheats.reset());
  reset.style.cssText += ';color:var(--hp,#c94f43);border-color:rgba(201,79,67,.5);width:100%;margin-top:2px';
  panel.appendChild(reset);

  document.body.appendChild(panel);
}
function mkBtn(label, fn) {
  const b = document.createElement('button');
  b.textContent = label;
  b.style.cssText = 'min-height:0;padding:5px 9px;font-size:11px';
  b.onclick = fn;
  return b;
}
function show() { if (!panel) build(); panel.style.display = 'flex'; }
function hide() { if (panel) panel.style.display = 'none'; }

/* expose on the console */
window.__cheats = Object.assign(cheats, { show, hide });
