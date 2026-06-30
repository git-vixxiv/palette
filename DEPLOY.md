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
SQUARE_WEBHOOK_URL=https://us-central1-palette-vixxiv.cloudfunctions.net/squareWebhook
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

- URL: `https://us-central1-palette-vixxiv.cloudfunctions.net/squareWebhook`
- Subscribe to events: `subscription.updated`, `invoice.payment_made`,
  `invoice.scheduled_charge_failed`, `invoice.payment_failed`.
- Copy the **Signature Key** → `firebase functions:secrets:set SQUARE_WEBHOOK_SIGNATURE_KEY`,
  then redeploy functions.

## 5. Custom domain

Firebase console → **Hosting → Add custom domain → `palette.vixxiv.com`**, then
add the TXT/A records it gives you at the vixxiv DNS host. (The repo `CNAME`
file is a GitHub-Pages artifact and is not used by Firebase Hosting.)

## 6. Go to production

When sandbox testing passes: swap every Square value to the **Production**
credentials, set `SQUARE_ENVIRONMENT=production` (functions/.env) and
`VITE_SQUARE_ENV=production` (.env.local), recreate the plans against the
production catalog, re-set the production access token secret, and redeploy.

---

### Test cards (Square sandbox)
`4111 1111 1111 1111`, any future expiry, any CVV, any postal code.

### Notes / follow-ups
- `src/context/AppContext.tsx` still contains a creator auto-unlock that grants
  lifetime Pro to the hardcoded email `jrozsa@gmail.com` (leftover from the
  template). Decide whether to remove it or change it to a vixxiv address before
  launch.
