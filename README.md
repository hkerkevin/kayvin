# Kayvin

Kevin & Kaydee's shared life OS — a single installable PWA with modules for:

- **💰 Budget** — envelope budgeting with per-month history (view/edit any month)
- **💳 Debt** — debt tracker (log payments, see progress) + a payoff planner (avalanche vs snowball, extra payments, lump sums, refinance what-ifs)
- **✅ Habits** — per-person daily discipline check-off with streaks

## Stack

- Vanilla JS + HTML + CSS, no build step
- Firebase (Auth + Firestore) for shared real-time sync between the two of us
- Hosted on GitHub Pages at <https://hkerkevin.github.io/kayvin/>
- Installable as a PWA (service worker + manifest)

## Deploy

Push to `main` → GitHub Pages redeploys automatically. Bump `CACHE_NAME` in `sw.js` whenever `app.js` / `index.html` / `style.css` change so clients pick up the new code.

## Firestore

All data lives under a single shared `households/{id}` document (envelopes, transactions, debts, payments, habits, habit logs, planner config). Security rules are in `firestore.rules` — paste them into the Firebase Console (Firestore → Rules) to deploy; there is no `firebase.json`/CLI wired up.
