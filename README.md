# TRIPMATE

**Xərcləri asan bölüşün.** (*Split expenses easily.*)

Five friends travel together and different people pay for different things. TRIPMATE records who paid what and works out who should pay whom, and how much, in as few payments as possible.

The interface is entirely in **Azerbaijani**; only the product name TRIPMATE stays in English.

## What it does (and deliberately doesn't)

The product does four things:

1. **Create a trip.** Name, optional destination and currency (₼ by default).
2. **Add friends.** Five rows to start with; add, rename or remove people.
3. **Record shared expenses.** Expense name, amount, who paid, and who took part. Expenses are split equally among the people selected.
4. **See who pays whom.** A table showing who pays, who receives and how much, plus each person's balance.

Everything else was removed on purpose: no categories, dates, custom or weighted splits, currency conversion, CSV export, share links or mark-as-paid. The brief asked for a small, beautiful, genuinely useful tool, and each removed feature added a decision for the user without solving the core problem better.

## Design

The visual direction follows the Pinterest reference (a warm budget-tracker app):

- **Colour:** a cream page (`#FDF0DC`), sunny orange (`#FBB54C`) as the single accent, near-black text and soft greys. Green and red appear only on balances (gets back / owes).
- **Type:** Poppins throughout, with a big bold "TRIPMATE / XƏRCLƏRİ ASAN BÖLÜŞÜN" headline on the home screen in the reference's poster style.
- **Components from the reference:** the orange summary pill (*Ümumi xərc | Xərclər | Nəfər*), list rows with orange-rimmed icon tiles, a section header with an orange rule, and a bottom bar with a raised orange **+** button.
- **Layout:** the app is a white sheet on the cream page. On a phone it fills the screen; on desktop it becomes a centred column over a cream and orange split backdrop with a few line icons, like the reference poster.
- Forms open as a **bottom sheet** on phones and a centred card on larger screens.

## How the maths works

All logic is in `src/lib/` as small, pure, tested functions. Components contain no business logic.

- **Money is stored in qəpik (integer minor units),** never as floats. Input accepts `25`, `25,5`, `25.50`, `1.234,50` and `1 234,50`. Output uses the Azerbaijani format `1.234,50 ₼` (formatted by hand, because not every browser ships Azerbaijani locale data).
- **Equal split** (`split.ts`): `amount ÷ number of people`. Any leftover qəpik go one at a time to the payer first (if they took part), then in the order friends were added. Shares always add up to exactly the expense amount. Example: 10,00 ₼ among three, paid by Əli → Əli 3,34 ₼, the others 3,33 ₼.
- **Balances** (`balances.ts`): **net balance = total paid − total share.** Positive means the person receives money, negative means they owe, zero means they're square. Balances always sum to zero, so the total owed equals the total receivable. Editing or deleting an expense simply recomputes everything from the expense list.
- **Fewest payments** (`settle.ts`): a group of *n* people with non-zero balances can always settle in *n − 1* payments, and every subgroup whose balances cancel out saves one more. TRIPMATE finds the largest number of such subgroups **exactly** (dynamic programming over subsets, for up to 18 people with non-zero balances; above that it uses a greedy fallback), then settles each subgroup. People who are square never appear in the table.
  - The brief's example (Məryəm +100, Əli −50, Leyla −100, Murad +50, Aysel 0) settles in **2** payments, where the brief suggested 3.
  - For balances −20, +40, −20, −30, +30, the common "largest debtor pays largest creditor" rule needs 4 payments; TRIPMATE needs 3.

## Testing

- `npm test` runs **19 unit tests** (Node's built-in test runner) covering parsing and Azerbaijani formatting, equal splits and leftover qəpik, selected participants, a payer who doesn't share, edit and delete recalculation, owed = receivable, the brief's example, and settlement **optimality checked against a brute-force solver** on hundreds of random groups (plus groups of 2, 10 and 25 people).
- The full journey was tested in a real browser (Playwright/Chromium) at **1280 × 860 and 390 × 844**, with 33 checks:
  - Create a trip and add five friends, with validation.
  - Equal split, selected participants, odd qəpik, and expenses paid by different people.
  - Balances against hand-calculated values, and the settlement table.
  - Editing and deleting with confirmation, refresh persistence, trip settings and deletion.
  - Not-found and corrupt-data screens.
  - No horizontal overflow and no console errors.
  - An automated scan of every visible string, `aria-label`, `title` and `placeholder` (190 strings) confirming there is no English.

## Technical notes

- React 19, TypeScript, Vite 7, Tailwind CSS v4, Lucide icons (`react-icons/lu`). No other runtime dependencies.
- A ~50-line hash router (`#/`, `#/yeni`, `#/seyahet/:id`, `#/seyahet/:id/hesablasma`, `#/seyahet/:id/duzelt`), so it works on any static host and a refresh keeps you on the same screen.
- **Persistence:** `localStorage` (`tripmate:v2`), since there is no backend. Damaged data shows a recovery screen instead of crashing, and a warning appears if the browser can't save.
- Accessible: native `<dialog>` (focus trap, Esc to close), labelled controls, a skip link, visible focus, and `prefers-reduced-motion` respected.

```
src/
  lib/          money, split, balances, settle, storage, sample + tests
  state/        store (reducer + localStorage) and hash router
  components/   Shell (page frame, app bar), ui primitives, toasts
  screens/      Home, TripForm, TripScreen (expenses + settlement), ExpenseSheet, NotFound
```

## Assumptions and limitations

- Data lives in one browser. There's no account, sync or sharing; clearing site data removes trips.
- One currency per trip, with no conversion.
- Splits are equal among the selected people. Unequal splits were removed to keep the product simple.
- Poppins loads from Google Fonts. Offline first visits fall back to the system font. Poppins has no ₼ glyph, so the manat sign is drawn by the system font.

## Run locally

Requires Node 20.19+.

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # unit tests
npm run build     # production build in dist/
npm run preview   # serve the production build
```

Vercel: import the repository. The Vite preset is detected (also set in `vercel.json`): build command `npm run build`, output directory `dist`. No environment variables are needed.
