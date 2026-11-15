# TRIPMATE

**Sən səyahətindən zövq al, xərclərin hesabını Tripmate həll etsin.**

TRIPMATE is a shared travel-expense app. Friends on a trip record who paid what. TRIPMATE works out every person's share, tracks settlement payments (confirmed by the person receiving the money) and shows who owes whom, in the fewest possible transfers. The entire interface is in Azerbaijani.

## Stack

React 19 · TypeScript · Vite · hand-written CSS design system · Supabase (Auth, Postgres, Storage, Realtime) · react-icons (Lucide set).

Tailwind was removed: the visual design is a custom token-based system (`src/styles/`) built from the design reference.

## Two modes

| Mode | When | Data |
|---|---|---|
| **Demo rejimi** (local) | `VITE_SUPABASE_*` not set | Stored in the browser (localStorage). Five demo accounts + two trips are seeded. No e-mails are sent; password reset shows a one-time code on screen. Google sign-in is disabled. |
| **Supabase** | both env vars set | Real accounts, shared data between devices, realtime updates, image uploads to Storage. |

Demo accounts: `maryam@demo.tripmate.az`, `ali@…`, `leyla@…`, `murad@…`, `nigar@…`, all with password `demo1234`. To try the two-sided payment confirmation, sign in as Əli and mark a payment, then sign in as Məryəm and confirm it.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional — leave empty for demo mode
npm run dev
npm test          # finance engine + backend rules (32 tests)
npm run build     # typecheck + production build
```

## Supabase setup (to switch off demo mode)

1. Create a Supabase project.
2. SQL editor → run `supabase/schema.sql`. It creates the tables, Row Level Security, the RPC functions every write goes through, realtime publication and the `media` storage bucket.
3. Authentication → URL configuration: set the Site URL to your production domain, and add `https://<domain>/sifre-yenile` and `https://<domain>/profil-tamamla` to the redirect URLs.
4. Optional — Google sign-in: Authentication → Providers → Google. Add the OAuth client ID and secret from Google Cloud, and use Supabase's callback URL as the authorised redirect URI.
5. Vercel → Project → Settings → Environment Variables: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the public anon key, **never** the service-role key), then redeploy.

`supabase/tests/` contains a plain-Postgres harness and a scenario script. They were used to test the schema, permissions and the payment workflow without a Supabase project.

## Financial engine (`src/lib/`)

- Money is integer minor units (cents/qəpik) everywhere, including in the database (`bigint`).
- **Splits:**
  - Equal split: leftover cents go to the payer first, then in trip order.
  - Custom split: amounts must add up to the total.
  - Percent split: basis points must total exactly 100%; rounding uses the largest-remainder method.
  - Shares are stored per expense when it is saved, so a participant added later is never part of earlier expenses.
- **Balances:** `paid − share = net`, and `outstanding = net + confirmed sent − confirmed received`. Pending, rejected and cancelled payments never change a debt.
- **Settlement:** minimum number of transfers, exact via bitmask dynamic programming over zero-sum groups (≤18 people with a non-zero balance), greedy above that. Checked against brute force in the tests.
- **Payments:**
  1. The debtor marks a payment as sent (partial amounts allowed, capped at what is still open minus what is already pending). Its status becomes *Təsdiq gözləyir*.
  2. Only the receiver can confirm or reject it. An admin can act for a participant who has no account.
  3. Confirmation records who confirmed it and when. A row lock / state check prevents double confirmation.

## Roles

- **Admin** (trip creator): edits and archives the trip, adds and removes participants, and manages all expenses. A participant can be removed only once their balance is settled; their history is kept.
- **Member:** adds expenses, edits their own, sees all balances, and reports payments.

## Deployment

`vercel.json` rewrites every path to `index.html`, so refreshing works on any page. It also sets long cache headers on hashed assets. CI (`.github/workflows/ci.yml`) runs the typecheck, the tests and the production build on every push.
