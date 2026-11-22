# palette by vixxiv — Go-Live Runbook

Everything in the codebase is wired for **real Firebase accounts** (Google +
email/password) and **real Square billing** (auto-renewing monthly/annual
subscriptions + one-time lifetime). What remains is connecting your accounts.
Do the steps in order.

---

## 1. Firebase project

```bash
firebase login                       # one-time, pick the right Google account
firebase projects:create palette-vixxiv --display-name "palette by vixxiv"
firebase use palette-vixxiv
```

Then in the [Firebase console](https://console.firebase.google.com):

- **Upgrade to the Blaze (pay-as-you-go) plan** — required for Cloud Functions.
- **Build → Authentication → Get started** → enable **Google** and
  **Email/Password** providers.
- **Build → Firestore Database → Create database** (Production mode).

Register a web app and pull its config into `firebase-applet-config.json`:

```bash
firebase apps:create web "palette web"
firebase apps:sdkconfig web > tmp-config.txt   # copy the values into firebase-applet-config.json
```

`firebase-applet-config.json` must end up with real values for: `apiKey`,
`authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`.
Leave `firestoreDatabaseId` as `(default)` unless you created a named DB.

## 2. Square configuration

In the [Square Developer dashboard](https://developer.squareup.com/apps):

- Note your **Application ID**, **Access Token**, and **Location ID**
  (Sandbox set first; Production set when going live).

Create the subscription plans (run once, from `functions/`):

```bash
cd functions
SQUARE_ACCESS_TOKEN=<token> SQUARE_ENVIRONMENT=sandbox npm run setup:plans
# → prints SQUARE_PLAN_MONTHLY=... and SQUARE_PLAN_ANNUAL=...
```

Fill in **`functions/.env`** (copy from `functions/.env.example`):

```
SQUARE_ENVIRONMENT=sandbox
SQUARE_LOCATION_ID=<location id>
SQUARE_PLAN_MONTHLY=<from setup script>
SQUARE_PLAN_ANNUAL=<from setup script>
LIFETIME_PRICE_CENTS=5000
SQUARE_WEBHOOK_URL=https://us-central1-palette-4df37.cloudfunctions.net/squareWebhook
```

Store the secrets (never in a file):

```bash
firebase functions:secrets:set SQUARE_ACCESS_TOKEN
firebase functions:secrets:set SQUARE_WEBHOOK_SIGNATURE_KEY   # from the webhook step below
```

Fill in the **frontend** `.env.local` at the repo root (copy from `.env.example`):

```
VITE_SQUARE_APP_ID=<application id>
VITE_SQUARE_LOCATION_ID=<location id>
VITE_SQUARE_ENV=sandbox
```

## 3. Deploy

```bash
# from repo root
firebase deploy --only firestore:rules
firebase deploy --only functions
npm run build
firebase deploy --only hosting
```

## 4. Square webhook

In the Square dashboard → your app → **Webhooks → Subscriptions**:

- URL: `https://us-central1-palette-4df37.cloudfunctions.net/squareWebhook`
- Subscribe to events: `subscription.updated`, `invoice.payment_made`,
  `invoice.scheduled_charge_failed`.
- Copy the **Signature Key** → `firebase functions:secrets:set SQUARE_WEBHOOK_SIGNATURE_KEY`,
  then redeploy functions.

## 5. Custom domain

Firebase console → **Hosting → Add custom domain → `palette.vixxiv.com`**, then
add the TXT/A records it gives you at the vixxiv DNS host. (The repo `CNAME`
file is a GitHub-Pages artifact and is not used by Firebase Hosting.)

## 6. Production cutover (sandbox → live Square)

Square keeps **sandbox and production fully separate** — different credentials,
a different catalog, and different webhooks. Nothing sandbox carries over, so we
recreate the same setup against live keys. It's the steps below repeated with
production values (~10 min) and is fully reversible (flip the values back).

### Prerequisites — only go live once all are true
- Sandbox flow fully tested: signup, all three plans, cancel, and webhook sync
  (renewal / cancellation reflected in Firestore).
- The Square account is **activated for live payments** (business details + bank
  account on file — required before production credentials can actually charge).
- Custom domain + Auth authorized domains are live, so you test on
  `palette.vixxiv.com`.
- Final prices confirmed (these bake into the production catalog): currently
  **$5/mo, $25/yr, $50 lifetime**.

### What changes
| Where | Sandbox | Production |
|-------|---------|-----------|
| `VITE_SQUARE_APP_ID` (`.env.local`) | `sandbox-sq0idb-…` | live `sq0idp-…` |
| `VITE_SQUARE_LOCATION_ID` (`.env.local`) | sandbox location | live location ID |
| `VITE_SQUARE_ENV` (`.env.local`) | `sandbox` | `production` |
| `SQUARE_ACCESS_TOKEN` (secret) | sandbox token | production token |
| `SQUARE_ENVIRONMENT` (`functions/.env`) | `sandbox` | `production` |
| `SQUARE_LOCATION_ID` (`functions/.env`) | sandbox location | live location ID |
| `SQUARE_PLAN_MONTHLY` / `_ANNUAL` (`functions/.env`) | sandbox IDs | recreated in prod catalog |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` (secret) | sandbox key | new key from prod webhook |

`SQUARE_WEBHOOK_URL` is unchanged (same function URL). The frontend SDK loader
auto-switches to Square's production JS when `VITE_SQUARE_ENV=production`.

### Steps
```bash
# 1. Production access-token secret
firebase functions:secrets:set SQUARE_ACCESS_TOKEN --project palette-4df37   # paste PROD token

# 2. Recreate the plans in the PRODUCTION catalog → new variation IDs
cd functions
SQUARE_ACCESS_TOKEN=<prod-token> SQUARE_ENVIRONMENT=production npm run setup:plans

# 3. Edit functions/.env  -> SQUARE_ENVIRONMENT=production, live location, new plan IDs
#    Edit .env.local       -> live VITE_SQUARE_APP_ID / _LOCATION_ID, VITE_SQUARE_ENV=production

# 4. Redeploy
cd ..
firebase deploy --only functions --project palette-4df37
npm run build && firebase deploy --only hosting --project palette-4df37
```

### 7. Production webhook
Register a **new** webhook in Square's **Production** environment (separate from
sandbox) pointing at
`https://us-central1-palette-4df37.cloudfunctions.net/squareWebhook`, subscribe
to the same events, copy its **Signature Key**, then:
```bash
firebase functions:secrets:set SQUARE_WEBHOOK_SIGNATURE_KEY --project palette-4df37
firebase deploy --only functions --project palette-4df37
```

### 8. Smoke test in production
Run one real purchase with a real card, confirm the tier grants and the
subscription appears in the Square dashboard, then cancel/refund as needed.

---

### Test cards (Square sandbox)
`4111 1111 1111 1111`, any future expiry, any CVV, any postal code.
