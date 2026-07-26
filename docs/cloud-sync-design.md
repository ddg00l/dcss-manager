# Cloud Save Sync — Design (Firebase)

Backend-as-a-service: Firebase Authentication (Google sign-in) keeps a refresh
token in the browser's IndexedDB and renews the session silently for months —
no per-hour re-login, no reload popup. Saves live in Cloud Firestore at
`saves/{uid}`, readable/writable only by their owner (security rules in
`firestore.rules`). The pure conflict resolver (`sync.js`) and the master-seed
determinism layer are reused unchanged. Offline escape hatch: export/import the
save as a file (`export.js`), independent of any account.

Owner setup: Firebase project `dcss-manager-e4668` with Google auth enabled,
`ddg00l.github.io` in Authorized domains, Firestore in production mode, and the
rules from `firestore.rules` published.


## Determinism status (closed)

All gameplay randomness now derives from the account `masterSeed`:
- **gacha** — `nextStream(s,'gacha')`, summon #N is the same hero everywhere.
- **maps** — `h.seed = hashSeed(masterSeed,'map',id)`; identical floors.
- **combat/AI/consumables/traps** — a per-hero cursor `h.rngState` seeded from
  `hashSeed(masterSeed,'combat',id)`, advanced by every draw (`rnd(h)` in tick.js).
- **loot/forge** — item and craft rolls draw the hero stream / `nextStream(s,'forge')`.
- **hero names** — `hashSeed(masterSeed,'name',id)`.

Only UI-only randomness (particles, jingles) stays on `Math.random`. Verified:
two runs with the same master seed and action sequence replay byte-identically.
The headless simulator sets `s.masterSeed` for paired-seed (CRN) comparisons.

---

# Cloud Save Sync — Design (Google Drive, no backend)

Decisions locked with the game owner (2026-07-26):
auto sync + manual buttons · auto-resolve with a dialog on dispute ·
play anywhere, but the player is **fully deterministic from a master seed
with per-domain RNG streams** · pushes on milestones + interval, ~10 rollback
versions.

## 0. Prerequisite: the determinism layer

Everything random in the *simulation* derives from one account-level
`masterSeed` (crypto-random, minted on first save, synced forever). Randomness
is split into **domain streams**, each keyed by the master seed plus a stable
monotonic index, so a divergence in one domain never cascades into others:

| domain  | stream key                          | effect |
|---------|-------------------------------------|--------|
| gacha   | `(masterSeed, 'gacha', rollIndex)`  | summon #42 yields the same hero on any device |
| maps    | `(masterSeed, 'hero', heroId)` → per-floor seeds (already seeded today) | identical floors |
| combat  | `(masterSeed, 'combat', heroId, h.turn)` | identical fight outcomes per tick |
| loot    | `(masterSeed, 'loot', dropIndex)`   | identical drops/egos/unrands |
| forge   | `(masterSeed, 'forge', forgeIndex)` | identical crafts |

UI-only randomness (particles, jingles) stays on `Math.random` — it is not
state. Timelines on two devices can still diverge (different player actions,
different wall-clock), but identical action sequences replay identically,
saves become reproducible and debuggable, and the conflict comparison below
is meaningful. The sim's CRN mode already proves the engine tolerates seeded
streams.

Implementation: `rng.js` gains `stream(seed, domain, ...indices)` (hash into
mulberry32). The sim core swaps every gameplay `Math.random` for a domain
stream draw. One-time behavioural reshuffle; tests re-anchored once.

## 1. Storage layout (Drive appDataFolder)

- `save.json.gz` — the gzipped save (~20 KB), field `meta` first:
  `{ rev, deviceId, deviceName, ts, balV, vector }` where
  `vector = { wins, prestiges, memEarned, runesTotal, kills }` (lifetime,
  monotonic).
- Rollback: Drive's built-in file revisions (free). Milestone pushes
  (prestige, victory) set `keepRevisionForever` on their revision, capped at
  the last 10 pinned; older pins are unpinned FIFO.
- The scope is `drive.appdata`: invisible to the user's Drive UI, removed
  with the app. A manual "Export save to file" button remains the
  user-visible escape hatch (works offline, no Google).

## 2. Sync protocol

**Push** (upload local → cloud): on victory, prestige, keystone purchase;
every 10 minutes of active play; on `visibilitychange → hidden`. Push is
skipped unless the local vector advanced since the last push.

**Pull** (boot and `visibilitychange → visible`): fetch remote `meta` only
(cheap `files.get` fields query), compare vectors:

1. remote dominates local (≥ everywhere, > somewhere) → adopt remote
   silently; local becomes a pinned revision first.
2. local dominates remote → push local.
3. equal → nothing.
4. **dispute** (each side ahead somewhere) → conflict dialog: a side-by-side
   table (wins / prestiges / Memory / runes / last played / device name),
   player picks a side; the losing save is pinned to Drive revisions before
   overwrite, so the choice is always reversible.

**Auth**: Google Identity Services token client, scope `drive.appdata`.
Access tokens live ~1 h; renewal is attempted silently. On failure the game
keeps playing locally and the settings row shows "not synced since …" — next
successful sign-in resumes pushes. No token, no nagging.

## 3. UI (settings window, "Cloud sync" section)

- Sign in with Google / signed-in as … / sign out
- status line: last sync time + device name of the latest cloud write
- buttons: "Upload now", "Download from cloud", "Export to file"
- the conflict dialog described above (modal, two columns, two buttons)

## 4. Rollout phases

1. **Determinism refactor** (sim core; the largest piece, independently
   valuable: reproducible bugs, honest sync comparisons).
2. GIS auth + Drive I/O + auto push/pull with dominance auto-resolve.
3. Conflict dialog + pinned revisions + manual buttons + export file.
4. Polish: sync badge, offline queue, i18n, sim-assisted soak test.

Needs from the owner: a Google Cloud OAuth **Client ID** (web application,
origin `https://ddg00l.github.io`).

Non-goals (v1): merge of parallel timelines (revisit if disputes prove
frequent), multi-account, encryption (saves hold no secrets).
