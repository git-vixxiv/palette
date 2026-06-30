# palette by vixxiv

Generate, analyze, grade, and save color palettes matching established color
science. Real-time WCAG 2.1 contrast matrix checker and live layout pair analyst.

- **Frontend:** React 19 + Vite + Tailwind
- **Accounts:** Firebase Auth (Google + Email/Password)
- **Data:** Cloud Firestore (saved palettes + subscription profiles)
- **Billing:** Square — auto-renewing monthly/annual subscriptions + one-time
  lifetime, charged via Cloud Functions (`functions/`)
- **Hosting:** Firebase Hosting at `palette.vixxiv.com`

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in Square publishable keys
npm run dev
```

For real auth/billing you also need a populated `firebase-applet-config.json`
and the Cloud Functions deployed — see **[DEPLOY.md](DEPLOY.md)** for the full
go-live runbook.

## Project layout

| Path | What |
|------|------|
| `src/` | React app (generator, scoring, contrast matrix, auth, checkout) |
| `src/utils/square.ts` | Square Web Payments SDK loader (frontend tokenization) |
| `functions/` | Cloud Functions: `createSubscription`, `cancelSubscription`, `squareWebhook` |
| `firestore.rules` | Security rules — tier grants are backend-only |
| `DEPLOY.md` | Step-by-step go-live runbook |
