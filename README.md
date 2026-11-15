# Tripmate

**Good trips. Clear tabs.**

Tripmate is a shared travel expenses app. A group logs who paid for what during a trip; Tripmate splits every bill to the cent and tells the group the fewest payments needed for everyone to be square.

---

## The problem

Five friends go away together. Different people pay for different things: the apartment, a taxi, dinner, museum tickets that only some of them used. By the end nobody knows who owes whom, and settling up turns into a spreadsheet, a long chat thread, or quietly absorbing the loss.

Tripmate makes that transparent while the trip is happening, and reduces the end of the trip to a short list: *Aysel pays Maryam €275.09. Ali pays Leyla €217.12. Done.*

## How I interpreted the task

- **A travel companion, not an accounting tool.** The language is "who paid", "gets back", "owes", "settle up", never "debit/credit" or "ledger". Numbers are big where they matter (what you owe) and quiet elsewhere.
- **Correctness is the product.** If the maths is wrong once, nobody trusts it again. All money is stored as integers in the currency's smallest unit, every split sums exactly to the expense, and the settlement is *provably* minimal, not just a heuristic.
- **Real trips are messy.** Not everyone joins every activity, someone has the bigger room, someone pays in dollars, someone pays back half now and half later. The app handles each of those without workarounds.
- **No backend for v1.** Data lives in `localStorage`, so the app works instantly, offline and with no account. Sharing works by putting the whole trip inside a link.

## Product approach

The design system was built for this product rather than taken from a UI kit:

- **Palette:** linen paper `#F3F0E7`, forest green `#173B2F` for primary actions and the brand, and *airport-signage marigold* `#F2B33D` as the single accent, used for the thing you should act on. Muted green and brick red mean *gets back* and *owes* everywhere.
- **Type:** Newsreader (an editorial serif with optical sizes) for headings and big figures; Schibsted Grotesk (designed for a newspaper) for the interface, always with tabular figures so amounts line up.
- **One signature element:** the *settle-up board*, a dark departure-board panel where each row is a payment and the amount sits on a "split-flap" tile. It appears on the landing page, the overview and the settle screen, so the outcome of the app always looks the same.
- **Restraint:** one orchestrated motion moment (the landing ticket lands and the board rows flip in), and otherwise motion only in response to actions: drawers, toasts, a highlight on a row you just marked paid. `prefers-reduced-motion` is respected.

## Main features

| Area | What it does |
|---|---|
| **Landing** | Live "boarding pass" built from a real sample trip, with the settlement computed from the actual data, plus a worked example of how the maths works and a list of your trips. |
| **Create / edit a trip** | Destination, name, dates, currency and participants. Starts with five rows (one click fills example names). Add, rename and remove people; tap an avatar to change its colour. Duplicate names are blocked. People who already have expenses can be renamed but not removed. |
| **Trip overview** | Total spent, people, expense count, spend per person per day, amount still to settle, each person's paid / share / balance with a diverging bar, the settle-up board and recent expenses. |
| **Add / edit expense** | Title, amount, currency (with exchange rate), payer, category, date, note and who shared it. Three split modes: **equally**, **exact amounts** (live "€x still to assign" / "€x over", plus "Rest" and "start from an even split" helpers) and **by shares** (e.g. nights stayed). A live preview shows everyone's share. Opens as a drawer on desktop and a bottom sheet on phones. |
| **Expense history** | Grouped by day with day totals; search; filters by category, payer and date; edit and delete on every row; empty and no-results states. |
| **Settle up** | Minimum set of payments; who pays whom and how much; a clear split into *gets back*, *owes* and *square*; **Mark paid** with undo; record a partial or ad-hoc payment; payment history; progress bar; an explanation of how it's worked out. |
| **Summary** | Trip completion page: category breakdown, what each person's trip cost (by category), day-by-day spend, biggest expense, who covered the most. When everything is settled the page turns into a "settled" card and the trip can be closed. |
| **Export & share** | CSV export (one row per expense, a share column per person, then recorded payments; opens cleanly in Excel / Sheets). Shareable link that carries the trip compressed in the URL fragment; the recipient can add it to their own browser. |
| **Quality details** | Undo after deleting an expense or payment; a confirmation step before deleting a trip; toasts; keyboard support (native `<dialog>` focus trapping, Esc to close, arrow keys in segmented controls, visible focus rings, skip link); recovery screen if saved data is corrupt; sync across open tabs; a warning if storage is full. |

## How the maths works

All logic lives in `src/lib/` as pure, framework-free functions with unit tests. No business logic sits in components.

### Money
Every amount is an **integer in minor units** (cents for EUR, whole yen for JPY, fils for KWD; the number of decimals comes from `Intl`). Parsing rejects more precision than the currency allows. Floating point never touches a stored amount.

### Splitting (`split.ts`)
- **Equal:** `amount / n`, with the leftover minor units handed out one at a time, *payer first*, then in participant order. €100 ÷ 3 paid by Leyla → Leyla €33.34, the others €33.33.
- **Exact:** the amounts are used as entered and must sum exactly to the total; the form won't save otherwise.
- **Shares:** largest-remainder allocation by weight, with the same tie-break rule.
- **Foreign currency:** the amount is converted once at the user's rate and rounded half-up; that converted figure is what gets split. Exact amounts typed in the foreign currency are converted by proportional allocation, so they still add up exactly. The original amount and rate are kept for display and CSV.

**Invariant:** for every expense, the sum of shares equals the amount, so the sum of all balances is exactly 0, and the total owed always equals the total receivable.

### Balances (`balances.ts`)
```
net         = total paid − total share of expenses
outstanding = net + payments sent − payments received
```
Positive means the person gets money back, negative means they owe, zero means square (and they never appear in the settlement).

Marking a settlement as paid **appends a `Payment` record**; it never edits expenses. Balances are always recomputed from scratch from expenses plus payments, so editing or deleting an expense, or undoing a payment, can't double-count or drift.

### Minimum transfers (`settle.ts`)
A group of *n* people with non-zero balances can always be settled in *n − 1* payments. But if the group splits into *k* subgroups whose balances each sum to zero, it needs only *n − k*, and nothing can do better. So minimising payments means **finding the largest number of zero-sum subgroups**.

Tripmate finds that number exactly with a dynamic programme over subsets (`O(2ⁿ · n)`; up to 18 people with non-zero balances, which takes a few milliseconds), then settles each subgroup with a greedy pass. Above 18 it falls back to greedy, which is still ≤ n − 1.

On the brief's example (Maryam +100, Ali −50, Leyla −100, Murad +50, Aysel 0):

| | Payments |
|---|---|
| Brief's suggested settlement | 3 (Ali → Maryam 50, Leyla → Maryam 50, Leyla → Murad 50) |
| **Tripmate** | **2** (Leyla → Maryam 100, Ali → Murad 50) |

And a case where the common "largest debtor pays largest creditor" greedy rule is suboptimal: balances −20, +40, −20, −30, +30. Greedy needs 4 payments; Tripmate finds 3 (`{−30, +30}` and `{−20, −20, +40}`). This is covered by a unit test.

### Tests
`npm test` runs 26 unit tests (Node's built-in test runner) covering parsing and formatting, equal/exact/share splits, cent handling, payers who don't share an expense, subset splits, edit/delete recalculation, payments not double-counting, owed = receivable, the brief's worked example, and **optimality checked against a brute-force solver on hundreds of random groups**, plus groups of 2, 10 and 25 people.

The UI was also tested end to end in a real browser (Playwright, Chromium) with 37 checks: creating a trip with five people and validation; equal, exact, subset, shares and foreign-currency expenses; balances against hand-calculated values; edit, delete and undo; filters; mark-paid until settled; refresh persistence; CSV contents; importing a share link in a fresh browser; trip deletion with confirmation and undo; and zero console errors. Layouts were inspected at 1440, 1280 and 390 px wide, with no horizontal overflow on any screen.

## Technical stack

- **React 19 + TypeScript**, **Vite 7**
- **Tailwind CSS v4** (CSS-first `@theme` tokens in `src/index.css`)
- **Lucide icons** via `react-icons/lu`
- No charting library: the charts are a handful of styled `div`s, which is lighter and fully themeable.
- No router library: a ~60-line hash router (`src/state/router.ts`), so deep links work on any static host with no rewrite rules.
- State: a single reducer (`src/state/store.tsx`) persisted to `localStorage` under a versioned key.

```
src/
  lib/          pure domain logic + tests (money, split, balances, settle, trip, csv, share, storage)
  state/        store (reducer + persistence) and hash router
  components/   design-system primitives (Button, Dialog, Avatar, Money, Toast…)
  screens/      Landing, TripForm, TripWorkspace + tabs, ExpenseSheet, ImportScreen
```

## Assumptions

- **Persistence is per browser (localStorage).** There's no backend or account. This was a deliberate v1 choice: zero friction, instant, private. Clearing site data removes trips, so CSV export is the backup.
- **One trip currency.** Expenses in other currencies are converted at a rate the user enters (e.g. from their card statement). There are no live FX rates, so the app needs no network and no API key.
- **The payer takes the odd cent** on uneven splits. This is the convention most groups already use, and it's deterministic.
- **"Mark paid" means the full suggested amount changed hands.** Partial payments use "Record a payment", and the plan re-optimises around them.
- Dates are plain `YYYY-MM-DD` strings, so they don't shift across time zones.

## Limitations and unfinished parts

- **No real-time collaboration.** A share link gives the recipient a *copy*; later edits on either side don't sync. Real multi-user editing needs a backend (the reducer and actions are structured so they could be sent to a server).
- **Share links grow with the trip.** A 15-expense trip is about 1 KB, which is fine, but a trip with hundreds of expenses would produce a very long URL.
- **No receipt photos, recurring expenses or per-item bill splitting.**
- **No live exchange rates** (see assumptions).
- **Above 18 people with non-zero balances**, settlement uses the greedy fallback, which is not guaranteed minimal (still at most n − 1 payments).
- Fonts load from Google Fonts. Offline first loads fall back to system serif and sans fonts.
- Static type-checking (`npm run typecheck`) and `vite build` could not be run in the sandbox where this was built (no npm registry access). The app was built and tested there with esbuild and Tailwind's compiler, using the same source. Vercel runs the real `vite build`.

## Run it locally

Requires Node 20.19+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for splitting and settlement
npm run build      # production build into dist/
npm run preview    # serve the production build
```

Deploying on Vercel: import the repository; the framework preset is detected as Vite (also set in `vercel.json`). Build command `npm run build`, output `dist`. No environment variables are needed.
