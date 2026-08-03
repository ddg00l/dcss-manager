/* The eternal endgame powers — Pantheon favor and the Bestiary family bonus —
   accrue and display from the very first cycle, but grant no combat power until
   the account has prestiged ENDGAME_GATE times. Reaching the ladder's mid-game
   is the incentive that switches on a whole new layer of power, and because the
   bonuses arrive late they can be sized to actually matter. Tracking stays on
   before the gate so the player watches the codex and favor fill toward the
   unlock. Leaf module (no imports) so any layer can read the gate cycle-free. */
export const ENDGAME_GATE = 10;
/* Counts LIFETIME prestiges, not the current ascension-cycle's. Ascension resets
   s.prestiges to 0, and this gate shares its threshold with ASCEND_GATE — so the
   moment a player ascended, the Pantheon and Bestiary powers they had just earned
   switched back off (measured: 173k family kills, +0% family bonus). Ascension is
   supposed to cost the prestige LAYER, never the eternal Collection. */
export const endgameUnlocked = s =>
  Math.max(s.prestigesTotal || 0, s.prestiges || 0) >= ENDGAME_GATE;
