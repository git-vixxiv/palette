# ADR-0001 Brief 2 — palette migration to vixxiv-id

Built by Kit on branch `kit/brief-2-palette` (from `feat/live-accounts-square-billing`),
2026-10-10. Contract: ADR-0001 §9 Brief 2 + §10 amendments; hub contract
`git-vixxiv/vixxiv-id` branch `kit/brief-1-identity-hub` @ `47a0a98`, `docs/CONTRACT.md`.

## What palette is now

| Concern | Before (billing branch) | Now |
|---|---|---|
| Firebase project | `palette-4df37` | `vixxiv-id` (`firebase-applet-config.json`) |
| Sign-in | own modal: Google + email/password + reset | none; **Sign In** goes to the hub page with `?redirect_to=` |
| User table | `users/{uid}` in palette's project, tier `free/pro-*` | none; hub's `users/{uid}` is read for `status` only |
| Entitlement | Firestore `tier` field | ID token claims via the hub's shared module: `tools = client \|\| tier >= gold` |
| Billing | Square Functions + Web Payments SDK in the app | none; membership prompt links to vixxiv.com |
| Data | `palettes` in `(default)` of `palette-4df37` | `palettes` in named database **`palette`** in `vixxiv-id` |
| Rules | owner + schema | owner + schema + **tool claim required** (R8: lapse stops access, data retained) |
| Purge | none | `palettePurgeOnQueue` + `palettePurgeSweep` consume `purgeQueue/{uid}` and write `confirmed.palette` |
| Hosting | GitHub Pages `colorpro.vixxiv.com` (main); also live Firebase Hosting in `palette-4df37` (see below) | target `palette` → site `vixxiv-id-palette` in `vixxiv-id`, for `palette.vixxiv.com` |

## What carried over from `feat/live-accounts-square-billing`, and why

| Kept | Why |
|---|---|
| Rename to "palette", title, metadata, `CNAME` intent (`palette.vixxiv.com`) | Joe's decision (ADR C7) |
| Generator UI fixes (hex sizing, lock button contrast, SPIN button) | Product work, unrelated to billing |
| `palettes` rules hardening (owner-only, schema, server timestamps, id pattern) | Still correct; now bound to the `palette` database and gated on the claim |
| `tsconfig` include/exclude, `vite-env.d.ts`, `.gitignore` additions | Build hygiene |

| Dropped | Why |
|---|---|
| `functions/` (createSubscription, cancelSubscription, squareWebhook, setupPlans) | Brief 1 lifted and generalised these into the hub. Brief 2: "remove palette's own Square code" |
| `src/utils/square.ts`, checkout UI, `VITE_SQUARE_*` | Same. Square is the hub's (single billing truth) |
| `AuthModal` (Google, email/password, reset, verification) | Brief 2: "remove local sign-up/sign-in code in favour of the shared flow" |
| palette `users/{uid}` profile + its rules | "no app holds its own user table" (Brief 2 done-when) |
| `pro-monthly/annual/lifetime` tiers and prices | Superseded by D4 tiers; prices are R16 (Joe). No lifetime plan exists in the hub |
| Old `DEPLOY.md` Square runbook | Replaced by `DEPLOY.md` for this topology; the hub's DEPLOY.md now owns the Square cutover |

## Data decision

Named Firestore database `palette` inside `vixxiv-id`, not namespaced collections in `(default)`.
Reason: the hub's `firestore.rules` default-deny everything outside hub collections, and
the Brief 2 boundary forbids editing the hub. A named database carries its own ruleset,
deployed from this repo, and cannot affect the hub's rules or data. `firebase.json`
binds `firestore.rules` to database `palette` only.

No data is migrated from `palette-4df37`. ADR-0001 §8 says there are no users to
migrate. **That is not verified** — see gap G4.

## Feature gating

From the token only (`entitlementFromToken` in the hub's module, vendored):

| | members (gold, black) and clients | everyone else (platinum, none, signed out) |
|---|---|---|
| Colour columns | 10 | 5 |
| Harmonies | all 7 | monochromatic, random |
| Saved palettes | cloud vault, unlimited | 2, this browser only |

`status` (`none · active · past_due · canceling · canceled`) is read verbatim from
`users/{uid}` and shown in the account menu. It never decides access.

## Change requests for the hub (to Sachin — Brief 2 boundary)

**CR-1 — No session reaches an app's origin after hub sign-in. Blocking for go-live.**
`auth.vixxiv.com` signs the user in on its own origin, then redirects to
`palette.vixxiv.com` carrying nothing. Firebase Auth persistence is per-origin, so
palette has no user on return; the user lands signed out. The hub's CONTRACT §1
assumes otherwise. Only the WordPress path has a hand-off (the form POST).
What palette would need, for the hub to define: a hand-off for allow-listed app
hosts — e.g. a callable that mints a short-lived Firebase custom token for the
signed-in user, delivered to the `redirect_to` URL in the fragment; palette then
calls `signInWithCustomToken`. Requires the Functions service account to hold
`iam.serviceAccounts.signBlob`. palette's half is about 15 lines and is not built,
because the protocol is the hub's to define.

**CR-2 — `/shared/vixxiv-auth.js` is served without `Access-Control-Allow-Origin`.**
CONTRACT §2 says import it from `https://auth.vixxiv.com/shared/vixxiv-auth.js`.
Observed on `vixxiv-id-auth.web.app` 2026-10-10: no CORS header, so a module import
from `palette.vixxiv.com` fails in the browser. palette vendors a byte-identical copy
(`src/vendor/`) and `npm run check:hub` fails on drift. Hub fix: a `headers` entry for
`/shared/**` with `Access-Control-Allow-Origin` for the app hosts, or publish the
module as a package.

## Contract gaps (ADR silent)

- **G1 — Where a member manages or cancels.** palette's cancel button was removed with
  its billing. The hub has `cancelSubscription` but no member-facing account page.
- **G2 — Membership URL.** The vixxiv.com Tools page does not exist (R5).
  `VITE_MEMBERSHIP_URL` defaults to `https://vixxiv.com/`.
- **G3 — Preview for non-members.** R4 says "no free tier". palette keeps its old free
  limits as a logged-out/non-member preview with browser-only saves. If the
  answer is "nothing without membership", change `featuresFor()` in one place.
- **G4 — palette-4df37 is live, not "never deployed".** Observed 2026-10-10:
  `palette.vixxiv.com` resolves to Firebase Hosting (151.101.1.195, .65.195) and serves
  the billing-branch build against `palette-4df37`, with a Square **sandbox** checkout.
  `colorpro.vixxiv.com` has no DNS record (NXDOMAIN) though GitHub Pages still names it.
  Whether `palette-4df37` holds real users or palettes is unknown to Kit (no
  production access). ADR §8 "no user data migrates" rests on there being none.
