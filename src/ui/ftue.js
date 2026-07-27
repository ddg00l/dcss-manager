/* FTUE scripts: opening rail + per-tab tours. The narrator is the shade of a fallen seeker. */
import { $ } from './dom.js';
import { save, persist } from '../core/state.js';
import { railStage, tabUnlocked, darkSummonUnlocked } from '../core/ftue.js';
import { canPrestige } from '../core/prestige.js';
import { coach, coachActive, playTour } from './coach.js';
import { sfx } from './audio.js';

const RAIL = {
  0: { sel: '#btnSummon', mode: 'click',
    text: 'I am the shade of one who never reached Zot. Now I am only a voice in these walls, and yours is to guide the new. <b>Summon your first seeker</b> — the guild pays for the first call.' },
  1: { sel: '[data-ftue="dispatch"]', mode: 'click',
    text: 'A worthy choice. But heroes don\'t live in barracks — their home is below. <b>Send them into the Dungeon.</b>' },
  2: { sel: '#watchCv', mode: 'next',
    text: 'Watch: they walk <b>on their own</b>. Exploring, fighting, drinking potions, praying. You don\'t hold their hand — you are the guild\'s memory.' },
  3: { sel: '#wlog', mode: 'next',
    text: 'Every step is recorded here. Misses, finds, the cries of the dying. <b>Read the log</b> — it is more honest than the gods.' },
  4: { sel: '#wSheetBtn', mode: 'next',
    text: 'Want to know everything — attributes, skills, inventory, mutations — press <b>“Status”</b>. And now... let them go. Death here is not the end, but the beginning of Memory.' },
};

export const TOURS = {
  pHeroes: [
    { sel: '[data-ftue="strategy"]', mode: 'next', text: 'The route decides where the hero goes: classic covers every branch, speedrun races straight for Zot.' },
    { sel: '[data-ftue="caution"]', mode: 'next', text: 'Caution sets when to drink healing potions. Cowardly lives longer, reckless moves faster.' },
    { sel: '[data-ftue="spend"]', mode: 'next', text: 'There are shops in the dungeon. This policy decides how much of the wallet the hero leaves there.' },
    { sel: '[data-ftue="recall"]', mode: 'next', text: 'Recall brings the hero back and frees the slot — but all run progress burns away. Forever.' },
  ],
  pForge: [
    { sel: '#btnForge', mode: 'next', text: 'The forge crafts a random item of the chosen slot — for gold and scrap ⚙. Egos, pluses, the occasional randart. Keep it or dismantle it on the spot.' },
    { sel: '#armoryList', mode: 'next', text: 'The armory holds everything found and forged. Dismantle what you don\'t need back into scrap.' },
  ],
  pUpg: [
    { sel: '#memBal', mode: 'next', text: 'Your seeker\'s death gave birth to <b>Dungeon Memory</b>. Floors and uniques give crumbs — heroes\' deaths give plenty.' },
    { sel: '#memWrap', mode: 'next', text: 'The tree grows from the center in every direction. Small nodes are percentages. Diamond keystones change the rules of the game.' },
    { sel: '#memInfo', mode: 'next', text: 'Pick a node and invest Memory. Hint: the blue Heroes branch holds <b>“2nd seeker”</b> — a second expedition slot.' },
  ],
  pFame: [
    { sel: '#fameSummary', mode: 'next', text: 'Victors grant eternal bonuses to the whole guild. Zot essence ⚛ buys elite upgrades.' },
    { sel: '#fameList', mode: 'next', text: 'Here rest the fallen. I was on this list once too. Their shards empower those to come.' },
  ],
  pTreasury: [
    { sel: '#treasuryBody .card', mode: 'next', text: 'Late cycles drown in gold that would only burn at prestige. <b>Gozag\'s Coffers</b> exchange that surplus for eternal Memory 🕯.' },
    { sel: '#treasuryBody', mode: 'next', text: 'Below: <b>Guild Provisions</b> — temporary boosts for this cycle only. And you can fund a hero into a <b>Ziggurat</b> from the Heroes tab for a deep farm run.' },
  ],
  prestige: [
    { sel: '#prestigeBox .card', mode: 'next', text: 'The Orb is carried out — the cycle has peaked. <b>Prestige</b> burns heroes, armory and the small nodes of the tree; keystones, fame and the collection remain. In return — Legends ⚜ and a new depth.' },
    { sel: '#prestigeBox .upgRow', mode: 'next', text: 'Legends ⚜ buy eternal upgrades that survive every cycle. The richer the cycle lived, the more Legends it pays out.' },
  ],
  equip: [
    { sel: '#equipBox .eqRow', mode: 'next', text: 'Tap a slot to see what\'s equipped and every matching armory item. The ↑ arrow means “better than current”.' },
    { sel: '#eqBest', mode: 'next', text: 'Or trust me: one button, and the hero wears the best you have.' },
  ],
};

let railShowing = false, lastStage = -1;

/** called from the main loop (after render) */
export function ftueTick(switchPane) {
  if (!save.ftue) return;
  updateGates();
  if (save.ftue.railDone) return;
  const st = railStage(save);
  if (st === 99) { save.ftue.railDone = true; persist(); sfx.level(); return; }
  if (coachActive() && st === lastStage) return;
  lastStage = st;
  /* the rail lives on its proper tab */
  if (st <= 1) switchPane('pHeroes', true);
  else switchPane('pDun', true);
  const step = RAIL[st];
  coach(step, () => {
    if (st === 2) save.ftue.sawMap = true;
    if (st === 3) save.ftue.sawLog = true;
    if (st === 4) save.ftue.sawSheet = true;
    lastStage = -1;
    persist();
  });
  railShowing = true;
}

/** hiding/badges for tabs and the dark summon */
export function updateGates() {
  document.querySelectorAll('#nav .tb').forEach(b => {
    const p = b.dataset.p;
    const open = tabUnlocked(save, p);
    b.style.display = ''; /* all tabs are always visible — locked ones show the depth ahead */
    b.classList.toggle('locked', !open);
    if (open && !save.ftue.tours[p] && save.ftue.railDone && p !== 'pDun' && p !== 'pHeroes')
      b.classList.add('newBadge');
    else b.classList.remove('newBadge');
  });
  /* prestige just unlocked: pull attention to the Fame tab */
  if (save.ftue.railDone && !save.ftue.tours.prestige && canPrestige(save)) {
    const fb = document.querySelector('#nav .tb[data-p="pFame"]');
    if (fb && fb.style.display !== 'none') fb.classList.add('newBadge');
  }
}

/** tab tour on first open (after the rail); skippable */
export function maybeTour(p) {
  if (!save.ftue || !save.ftue.railDone) return;
  if (save.ftue.tours[p]) return;
  const steps = TOURS[p];
  if (!steps) return;
  save.ftue.tours[p] = 1;
  persist();
  setTimeout(() => playTour(steps, () => persist(), true), 150);
}
