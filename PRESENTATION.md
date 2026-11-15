# Tripmate: product presentation

*Good trips. Clear tabs.*

## 1. The problem
Five friends, one trip, dozens of payments. By the last night nobody knows who owes whom. Settling up becomes a spreadsheet, a long chat thread, or someone quietly losing money. The real cost is the awkwardness, more than the money.

## 2. The bet
Shared expenses feel stressful because they're **invisible until the end**. Tripmate makes them visible while the trip is happening, and reduces the end of the trip to a short list of payments that everyone trusts.

## 3. Who it's for
A group of friends on a trip. One person usually logs expenses on their phone at the table, and everyone glances at the balances. So the design priorities are speed of entry on mobile, at-a-glance balances, and zero setup (no accounts).

## 4. Key UX decisions
- **Travel companion, not accounting.** Plain words: "paid", "gets back", "owes", "settle up". Green means you get money back, brick red means you owe, and that holds everywhere.
- **One signature surface: the settle-up board.** Settlement looks like an airport departure board, with marigold amounts on dark forest green. The same board appears on the landing page, the overview and the settle screen, so the outcome of the app is instantly recognisable.
- **Expense entry is designed for the restaurant table.** Payer, category and people are tap targets rather than dropdowns. A live preview shows each person's share as you type. It opens as a bottom sheet on phones.
- **Splits that match reality.** Equal, exact amounts (with "€x still to assign" and a one-tap "Rest") and weighted shares (nights stayed, couples). Foreign currency uses your card's rate.
- **Forgiving by default.** Undo after deleting an expense or payment, a confirmation step only for irreversible actions (deleting a trip), and a recovery screen if saved data is damaged.
- **Settling is a separate record.** "Mark paid" adds a payment and never edits the expense history, so the story of the trip stays intact.
- **A trip has an ending.** When balances reach zero, the summary turns into a "settled" card and the trip can be closed, with a breakdown of where the money went.

## 5. Business logic, done properly
- **Integer money.** Every amount is stored in cents (or the currency's minor unit). Floating point never touches stored money.
- **Splits always add up.** Odd cents go to the payer first, then in order. Shares use largest-remainder allocation. Sum of shares = amount, always.
- **Balances** = paid − share + payments sent − payments received. They sum to zero by construction, so total owed = total receivable.
- **Provably minimal settlement.** Minimising payments means finding the most subgroups whose balances cancel out. Tripmate solves this exactly (dynamic programming over subsets), not with the usual greedy rule.
  - Brief's example: the brief suggests 3 payments; **Tripmate needs 2**.
  - A case where greedy needs 4: **Tripmate needs 3**.

## 6. Evidence it works
- 26 unit tests, including optimality checked against brute force on hundreds of random groups.
- 37 end-to-end browser checks covering the full flow with five people: every split type, edit, delete and undo, settle to zero, refresh, CSV and share link.
- Responsive from 390 px phones to desktop, keyboard accessible, no console errors.

## 7. What's next
- Real-time sync between friends (needs a backend; the reducer and actions are already shaped for it).
- Receipt photos and itemised bill splitting.
- Live FX rates and payment links (Revolut, bank transfer) from the settle-up board.
