# TRIPMATE

**Xərcləri asan bölüşün.** (*Split expenses easily.*)

Five friends travel together and different people pay for different things. TRIPMATE records who paid what and works out who should pay whom, and how much, in as few payments as possible.

The interface, notifications, exports and printed report are entirely in **Azerbaijani**; only the product name TRIPMATE stays in English.

## The product in one minute

A first-time user should manage the whole journey without instructions:

1. **Səfərlərim** (home): your trips as cards and one prominent **Yeni səfər yarat** button.
2. **Create a trip:** name, destination, dates, currency, an optional budget, and the friends (five rows ready to fill).
3. **Inside a trip** there are three tabs:
   - **Ümumi məlumat:** the trip's details (destination, dates and duration, currency, budget with a progress bar), everyone's position, and a short **recent activity** list.
   - **Xərclər:** every expense in a wide table, with search, payer/date filters, sorting and **category chips that show each category's total**. Click a row to see each person's share.
   - **Hesablaşma:** a clear **Ödəyən / Alan / Məbləğ / Vəziyyət** table with the minimum number of payments, **Ödənildi** (mark paid) with **Geri al** (undo), balances, a short trip summary, and export to **CSV** or a printable **PDF report**.
4. **Xərc əlavə et** is available on every trip tab (a floating button on phones). One form covers it: name and amount, a category, who paid, and who shares it (equally, or **Fərdi** with exact amounts). The date and note sit behind a collapsible "Tarix və qeyd".

### What we deliberately left out

This version is not a dashboard. There are no stat cards, no charts and no admin sidebar. Earlier iterations had them, and they made the product feel like a financial SaaS tool rather than a trip companion. Secondary features live where they're used: the budget in *Ümumi məlumat*, categories in *Xərclər*, export in *Hesablaşma*.

## Design

The design follows the Pinterest reference (a warm budget-tracker app), translated into a desktop-first website:

- **Palette:** a cream page (`#FDF0DC`), sunny orange (`#FBB54C`) as the one accent, near-black text and soft greys. Green and red appear only on money owed or received.
- **Type:** Poppins throughout, bold and tight for headings.
- **Elements from the reference:** the orange summary pill (*Ümumi xərc | Adambaşı*), orange-rimmed icon tiles, section headers underlined in orange, and a round orange "+" for adding.
- **Layout:**
  - Top navigation and a 1200px content width.
  - The trip header holds the name, dates, people and summary pill, with underline tabs below it.
  - Wide tables on desktop, which collapse into readable rows on phones.
  - Designed for 1440px first, then checked at 1024, 768 and 390px.
- **Micro-interactions:** cards lift on hover, row actions appear on hover, the payment progress bar animates, and forms open as a bottom sheet on phones. `prefers-reduced-motion` is respected.

## How the maths works

All logic is in `src/lib/` as small, pure, unit-tested functions. Components contain no business logic.

- **Money is stored as integer qəpik,** never floats. Input accepts `25`, `25,5`, `25.50`, `1.234,50` and `1 234,50`. Output uses the Azerbaijani format `1.234,50 ₼`.
- **Equal split:** `amount ÷ people`. Leftover qəpik go one at a time to the payer first, then in the order friends were added, so shares always add up to exactly the amount (10,00 ₼ ÷ 3 paid by Əli → Əli 3,34 ₼, the others 3,33 ₼).
- **Custom split:** exact amounts per person. The form shows what's still unassigned or over, and won't save until the total matches. "Bərabər doldur" starts from an exact equal split.
- **Net balance = total paid − total share.** Positive means the person receives, negative means they owe, zero means they're square. Balances always sum to zero, so total owed = total receivable.
- **Payments:**
  - Marking a transfer as paid records a separate payment.
  - The expense history is never edited.
  - Outstanding = net + sent − received.
  - Editing or deleting an expense later re-plans only what's still open. Nothing is double-counted: for example, deleting a 10 ₼ taxi after everyone has paid reopens exactly the 6,66 ₼ difference.
- **Fewest payments:** *n* people can always settle in *n − 1* payments, and every subgroup whose balances cancel out saves one more. TRIPMATE finds the most such subgroups **exactly** (dynamic programming over subsets, for up to 18 people with non-zero balances; above that a greedy fallback). People who are square never appear.
  - The brief's example (Məryəm +100, Əli −50, Leyla −100, Murad +50, Aysel 0) settles in **2** payments, where the brief suggested 3.
  - For balances −20, +40, −20, −30, +30, the usual "biggest debtor pays biggest creditor" rule needs 4 payments; TRIPMATE needs 3.

## Testing

- **25 unit tests** (`npm test`):
  - Parsing and Azerbaijani formatting.
  - Equal and custom splits, including leftover qəpik.
  - Balances, edit and delete recalculation.
  - Payments never double-counting, and marking every transfer paid settles the trip.
  - Dates in Azerbaijani, and the CSV report.
  - Settlement **optimality checked against a brute-force solver** on hundreds of random groups.
- **59 browser checks** (Playwright/Chromium), run at **1440, 1024, 768 and 390px**:
  - Create a trip with five friends, with validation; switch between trips.
  - Equal, selected-participant and custom splits; filters, search, sorting and expanded shares.
  - Editing and deleting with confirmation; balances against hand-calculated values.
  - Mark paid, undo and full settlement; activity history.
  - Budget tracking and overspend; CSV and the print/PDF report.
  - Refresh persistence, and migration of data saved by the previous version.
  - Welcome, not-found and corrupt-data screens.
  - No horizontal overflow and no console errors.
  - An automated scan of **~450 interface strings** (text, labels, placeholders, options) for English.

## Technical notes

- React 19, TypeScript, Vite 7, Tailwind CSS v4, Lucide icons (`react-icons/lu`). No other runtime dependencies. There's no charting library and no router library.
- **Hash routes:**
  - `#/` home
  - `#/yeni` new trip
  - `#/sefer/:id` overview
  - `#/sefer/:id/xercler` expenses
  - `#/sefer/:id/hesablasma` settlement
  - `#/sefer/:id/duzelt` edit trip

  These work on any static host, and a refresh keeps you on the same screen.
- **Persistence:** `localStorage` (`tripmate:v3`), since there's no backend. Data saved by the previous version (`tripmate:v2`) is migrated automatically. Damaged data shows a recovery screen instead of crashing.
- **Accessibility:** native `<dialog>` (focus trap, Esc to close), labelled controls, `aria-current` tabs, a skip link and visible focus.

```
src/
  lib/          money, split, balances, settle, dates, categories, report (CSV, insights), storage, sample + tests
  state/        store (reducer + activity log + localStorage) and hash router
  components/   site header, trip layout with tabs, UI primitives, toasts, category icons
  screens/      HomePage, OverviewTab, ExpensesPage, SettlePage, ExpenseSheet, TripForm, PrintReport, NotFound
```

## Assumptions and limitations

- Data lives in one browser. There's no account or sync between friends; clearing site data removes trips. Export CSV or a PDF to keep a copy.
- One currency per trip, with no conversion.
- The activity history records what changed and when, not who changed it, because there are no user accounts.
- The PDF report uses the browser's print dialog ("Save as PDF").
- Poppins loads from Google Fonts. Poppins has no ₼ glyph, so the manat sign is drawn by the system font.

## Run locally

Requires Node 20.19+.

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # unit tests
npm run build     # production build in dist/
npm run preview   # serve the production build
```

Vercel: the repository is connected; every push to `main` deploys. The Vite preset is set in `vercel.json` (build `npm run build`, output `dist`); no environment variables are needed.
