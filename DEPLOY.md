# palette — deploy runbook (vixxiv-id)

ADR-0001 Brief 2. palette is a client of the vixxiv-id identity hub: its Auth,
billing and user records are the hub's. This repo deploys three things into
project `vixxiv-id`, and only these:

| What | Deploy filter | Touches |
|---|---|---|
| Hosting site `vixxiv-id-palette` | `hosting:palette` | that site only |
| Firestore rules + indexes for database `palette` | `firestore:palette` | the named database only, never `(default)` |
| Functions codebase `palette` (purge worker) | `functions:palette` | `palettePurgeOnQueue`, `palettePurgeSweep` only |

**Never run a bare `firebase deploy` from this repo.** Always use the filters
below. The codebase name stops a palette deploy from offering to delete the
hub's functions; the filters stop it touching the hub's rules or sites.

Kit deployed nothing. Every step below is Joe's (or Sam's with Joe's sign-off).

---

## 0. Preconditions

1. The hub's Functions are deployed (`syncCustomClaims` sets the `tier`/`client`
   claims palette gates on; `scheduledPurge` writes `purgeQueue`). Until then,
   every signed-in user looks like tier `none` to palette.
2. `vixxiv-id` is on Blaze (named databases and Functions need it).
3. **Change request CR-1 is resolved** (see `docs/BRIEF-2-PALETTE.md`). Until the
   hub hands a session to app origins, a user who signs in at the hub returns
   to palette signed out. Do not cut `palette.vixxiv.com` over before this.

## 1. Create the database and the site (once)

```bash
firebase firestore:databases:create palette --location=nam5 --project vixxiv-id
firebase hosting:sites:create vixxiv-id-palette --project vixxiv-id
```

`nam5` matches the hub's `(default)` database (hub DEPLOY.md §1). `.firebaserc`
already maps target `palette` → `vixxiv-id-palette`.

## 2. Build and deploy

```bash
npm ci
npm --prefix functions ci
npm test                 # emulators only
npm run check:hub        # vendored hub module has not drifted
npm run build
firebase deploy --project vixxiv-id --only firestore:palette,functions:palette,hosting:palette
```

Kit could not run the deploy command (no production access), so the
`firestore:palette` filter syntax is unverified here. Add `--dry-run` the first
time and confirm it lists only the `palette` database.

The site is then live at `https://vixxiv-id-palette.web.app`.

Optional: set `VITE_HUB_SIGN_IN_URL=https://vixxiv-id-auth.web.app/` in
`.env.production.local` before building, until `auth.vixxiv.com` DNS exists.
Set `VITE_MEMBERSHIP_URL` once the vixxiv.com Tools page exists.

## 3. Move `palette.vixxiv.com` (Joe — DNS and console)

**Observed 2026-10-10:** `palette.vixxiv.com` is already served by Firebase
Hosting from the OLD project `palette-4df37` (A records `151.101.1.195`,
`151.101.65.195`). A custom domain can be attached to one Hosting site at a time.

1. Console → project `palette-4df37` → Hosting → remove custom domain
   `palette.vixxiv.com`. (The site goes dark here; do steps 1–3 together.)
2. Console → project `vixxiv-id` → Hosting → `vixxiv-id-palette` → Add custom
   domain `palette.vixxiv.com`. It prints the records.
3. DNS at the vixxiv.com zone (nameservers observed: `ns-us01/ns-us02.webhostcluster.com`,
   i.e. MechanicWeb cPanel → Zone Editor):

| Type | Name | Value | Note |
|---|---|---|---|
| TXT | `palette.vixxiv.com` | `hosting-site=vixxiv-id-palette` (exact string **as the console prints it**) | ownership check for the new site |
| A | `palette.vixxiv.com` | `151.101.1.195` | already present — keep if the console prints the same |
| A | `palette.vixxiv.com` | `151.101.65.195` | already present — keep if the console prints the same |

   If the console prints different A values, replace both. Alternative: one
   `CNAME palette.vixxiv.com → vixxiv-id-palette.web.app` instead of the two A
   records — never both.

4. Wait for **Connected** and the certificate.

## 4. Retire the old homes (Joe)

- **GitHub Pages `colorpro.vixxiv.com`.** `git-vixxiv/palette` Pages builds from
  `main` with custom domain `colorpro.vixxiv.com` (observed via the GitHub API).
  That name has **no DNS record** today, so nothing is served there. Settings →
  Pages → remove the custom domain and unpublish. This branch deletes the
  `CNAME` file; merge it only after step 3.
- **`palette-4df37`.** Before deleting anything, check Auth → Users and
  Firestore `palettes` for real data (see gap G4). Then delete its Functions
  (`createSubscription`, `cancelSubscription`, `squareWebhook`) and remove any
  Square sandbox webhook subscription pointing at it. The ADR (§8) says the
  project becomes data-only or is retired.

## Local development

```bash
npm install
VITE_USE_EMULATORS=1 npm run dev
firebase emulators:start --project vixxiv-id --only auth,firestore,functions
```

Auth emulator on **9399** (TourBox holds 9099), Firestore 8085, Functions 5012.
