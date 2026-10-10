# palette by vixxiv

Generate, analyze, grade, and save color palettes matching established color
science. Real-time WCAG 2.1 contrast matrix checker and live layout pair analyst.

- **Frontend:** React 19 + Vite + Tailwind
- **Accounts:** the vixxiv-id identity hub (ADR-0001). palette has no sign-in
  UI and no user table; it reads `tier`/`client` from the ID token.
- **Data:** Firestore named database `palette` in project `vixxiv-id`
- **Billing:** none in this repo — the hub owns Square
- **Hosting:** Firebase Hosting site `vixxiv-id-palette`, for `palette.vixxiv.com`

## Run locally

```bash
npm install
npm run dev                         # against vixxiv-id
VITE_USE_EMULATORS=1 npm run dev    # against local emulators
npm test                            # unit + emulator suite
```

Deploy: **[DEPLOY.md](DEPLOY.md)**. Migration record, gaps and hub change
requests: **[docs/BRIEF-2-PALETTE.md](docs/BRIEF-2-PALETTE.md)**.

## Project layout

| Path | What |
|------|------|
| `src/` | React app (generator, scoring, contrast matrix) |
| `src/entitlement.ts` | features from the token; `status` vocabulary |
| `src/hub.ts` | hub sign-in and membership URLs |
| `src/vendor/vixxiv-auth.js` | byte-identical copy of the hub's shared module |
| `functions/` | codebase `palette`: purge worker for `purgeQueue` |
| `firestore.rules` | rules for database `palette` |
| `tests/` | unit + emulator tests |
