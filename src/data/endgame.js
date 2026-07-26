/* The eternal endgame powers — Pantheon favor and the Bestiary family bonus —
   accrue and display from the very first cycle, but grant no combat power until
   the account has prestiged ENDGAME_GATE times. Reaching the ladder's mid-game
   is the incentive that switches on a whole new layer of power, and because the
   bonuses arrive late they can be sized to actually matter. Tracking stays on
   before the gate so the player watches the codex and favor fill toward the
   unlock. Leaf module (no imports) so any layer can read the gate cycle-free. */
export const ENDGAME_GATE = 10;
export const endgameUnlocked = s => (s.prestiges || 0) >= ENDGAME_GATE;
