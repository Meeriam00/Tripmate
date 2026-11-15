import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { LuMinus, LuPlus, LuTrash2 } from "react-icons/lu";
import { CategoryGlyph } from "../components/CategoryIcon";
import { Avatar, Button, Dialog, Field, Segmented, Select, TextInput, cx, inputBase } from "../components/ui";
import { CATEGORY_META } from "../lib/categories";
import { isValidISO, todayISO } from "../lib/dates";
import { COMMON_CURRENCIES, convert, currencyDecimals, formatMoney, parseAmount, toInputValue } from "../lib/money";
import { allocate, computeShares, validateSplit } from "../lib/split";
import { uid } from "../lib/storage";
import { CATEGORIES, type Category, type Expense, type ID, type Split, type Trip } from "../lib/types";

type Mode = Split["mode"];

interface Draft {
  title: string;
  amount: string;
  currency: string;
  rate: string;
  paidBy: ID;
  category: Category;
  date: string;
  note: string;
  mode: Mode;
  selected: ID[];
  exact: Record<ID, string>;
  shares: Record<ID, number>;
}

function defaultDate(trip: Trip): string {
  const t = todayISO();
  if (t >= trip.startDate && t <= trip.endDate) return t;
  const last = [...trip.expenses].sort((a, b) => b.createdAt - a.createdAt)[0];
  return last?.date ?? trip.startDate;
}

function initialDraft(trip: Trip, e?: Expense): Draft {
  const ids = trip.participants.map((p) => p.id);
  if (!e) {
    const lastPayer = [...trip.expenses].sort((a, b) => b.createdAt - a.createdAt)[0]?.paidBy;
    return {
      title: "",
      amount: "",
      currency: trip.currency,
      rate: "",
      paidBy: lastPayer && ids.includes(lastPayer) ? lastPayer : ids[0],
      category: "food",
      date: defaultDate(trip),
      note: "",
      mode: "equal",
      selected: ids,
      exact: {},
      shares: Object.fromEntries(ids.map((id) => [id, 1])),
    };
  }
  const cur = e.original?.currency ?? trip.currency;
  const amt = e.original?.amount ?? e.amount;
  const d: Draft = {
    title: e.title,
    amount: toInputValue(amt, cur),
    currency: cur,
    rate: e.original ? String(e.original.rate) : "",
    paidBy: e.paidBy,
    category: e.category,
    date: e.date,
    note: e.note ?? "",
    mode: e.split.mode,
    selected: ids,
    exact: {},
    shares: Object.fromEntries(ids.map((id) => [id, 1])),
  };
  if (e.split.mode === "equal") d.selected = e.split.participantIds;
  if (e.split.mode === "exact") {
    const src = e.original?.amounts ?? e.split.amounts;
    d.exact = Object.fromEntries(Object.entries(src).map(([id, v]) => [id, v ? toInputValue(v, cur) : ""]));
    d.selected = Object.keys(e.split.amounts).filter((id) => e.split.mode === "exact" && e.split.amounts[id] > 0);
  }
  if (e.split.mode === "shares") {
    d.shares = Object.fromEntries(ids.map((id) => [id, (e.split as { shares: Record<ID, number> }).shares[id] ?? 0]));
    d.selected = ids.filter((id) => d.shares[id] > 0);
  }
  return d;
}

export function ExpenseSheet({
  trip,
  expense,
  open,
  onClose,
  onSave,
  onDelete,
}: {
  trip: Trip;
  expense?: Expense;
  open: boolean;
  onClose: () => void;
  onSave: (e: Expense, isNew: boolean) => void;
  onDelete?: (e: Expense) => void;
}) {
  const [d, setD] = useState<Draft>(() => initialDraft(trip, expense));
  const [submitted, setSubmitted] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setD(initialDraft(trip, expense));
      setSubmitted(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expense?.id]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const people = trip.participants;
  const order = people.map((p) => p.id);
  const foreign = d.currency !== trip.currency;

  const amountMinor = parseAmount(d.amount, d.currency);
  const rate = foreign ? Number(d.rate.replace(",", ".")) : 1;
  const rateOk = !foreign || (Number.isFinite(rate) && rate > 0);
  const converted = amountMinor !== null && rateOk ? (foreign ? convert(amountMinor, d.currency, trip.currency, rate) : amountMinor) : null;

  // Exact amounts are typed in the expense's own currency.
  const exactMinor = useMemo(() => {
    const out: Record<ID, number> = {};
    for (const id of d.selected) {
      const raw = d.exact[id] ?? "";
      out[id] = raw.trim() === "" ? 0 : (parseAmount(raw, d.currency) ?? NaN);
    }
    return out;
  }, [d.exact, d.selected, d.currency]);
  const exactSum = Object.values(exactMinor).reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
  const exactBad = Object.values(exactMinor).some((v) => !Number.isFinite(v));

  /** Build the split in trip currency (what the maths uses). */
  const split: Split | null = useMemo(() => {
    if (converted === null) return null;
    if (d.mode === "equal") return { mode: "equal", participantIds: order.filter((id) => d.selected.includes(id)) };
    if (d.mode === "shares") {
      const shares: Record<ID, number> = {};
      for (const id of order) if (d.selected.includes(id) && d.shares[id] > 0) shares[id] = d.shares[id];
      return { mode: "shares", shares };
    }
    if (exactBad) return null;
    const amounts: Record<ID, number> = {};
    if (!foreign) {
      for (const id of order) if (exactMinor[id] > 0) amounts[id] = exactMinor[id];
      return { mode: "exact", amounts };
    }
    // Convert each person's exact amount by allocating the converted total in proportion,
    // so the converted parts still add up to the converted total exactly.
    if (exactSum !== amountMinor) return { mode: "exact", amounts: { _: -1 } };
    const weights = new Map(order.filter((id) => exactMinor[id] > 0).map((id) => [id, exactMinor[id]]));
    for (const [id, v] of allocate(converted, weights, d.paidBy)) amounts[id] = v;
    return { mode: "exact", amounts };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [converted, d.mode, d.selected, d.shares, exactMinor, exactBad, foreign, d.paidBy]);

  const splitErr = split && converted !== null ? validateSplit(converted, split) : null;
  const preview = split && !splitErr && converted ? computeShares(converted, split, d.paidBy, order) : null;

  const errors = {
    title: !d.title.trim() ? "Give it a short name, like \"Dinner at Ramiro\"" : null,
    amount:
      amountMinor === null
        ? d.amount.trim()
          ? `Enter an amount with up to ${currencyDecimals(d.currency)} decimals`
          : "How much was it?"
        : amountMinor === 0
          ? "Amount must be more than zero"
          : null,
    rate: foreign && !rateOk ? `Enter how many ${trip.currency} one ${d.currency} is worth` : null,
    date: !isValidISO(d.date) ? "Pick a date" : null,
    split:
      d.mode === "exact" && exactBad
        ? "One of the amounts isn't a valid number"
        : d.mode === "exact" && amountMinor !== null && exactSum !== amountMinor
          ? exactSum < amountMinor
            ? `${formatMoney(amountMinor - exactSum, d.currency)} still to assign`
            : `${formatMoney(exactSum - amountMinor, d.currency)} over the total`
          : d.selected.length === 0 || splitErr?.code === "no-participants"
            ? "Choose at least one person who shared this"
            : null,
  };
  const valid = Object.values(errors).every((x) => !x) && !!split && !splitErr;
  const show = (k: keyof typeof errors) => (submitted ? errors[k] : null);

  function toggle(id: ID) {
    setD((x) => {
      const on = x.selected.includes(id);
      const selected = on ? x.selected.filter((s) => s !== id) : order.filter((o) => o === id || x.selected.includes(o));
      const shares = { ...x.shares, [id]: on ? x.shares[id] : Math.max(1, x.shares[id] || 0) };
      return { ...x, selected, shares };
    });
  }

  function fillRemainder(id: ID) {
    if (amountMinor === null) return;
    const others = d.selected.filter((s) => s !== id).reduce((s, o) => s + (Number.isFinite(exactMinor[o]) ? exactMinor[o] : 0), 0);
    const left = Math.max(0, amountMinor - others);
    set("exact", { ...d.exact, [id]: toInputValue(left, d.currency) });
  }

  function splitExactEvenly() {
    if (amountMinor === null || d.selected.length === 0) return;
    const shares = allocate(amountMinor, new Map(d.selected.map((id) => [id, 1])), d.paidBy);
    set("exact", Object.fromEntries([...shares].map(([id, v]) => [id, toInputValue(v, d.currency)])));
  }

  function submit(ev: FormEvent) {
    ev.preventDefault();
    setSubmitted(true);
    if (!valid || converted === null || !split) {
      setTimeout(() => document.querySelector<HTMLElement>(".tm-drawer [aria-invalid=true], .tm-drawer [data-error]")?.focus(), 0);
      return;
    }
    const isNew = !expense;
    const out: Expense = {
      id: expense?.id ?? uid("e-"),
      createdAt: expense?.createdAt ?? Date.now(),
      title: d.title.trim(),
      amount: converted,
      paidBy: d.paidBy,
      category: d.category,
      date: d.date,
      note: d.note.trim() || undefined,
      split,
      original: foreign
        ? {
            currency: d.currency,
            amount: amountMinor!,
            rate,
            ...(d.mode === "exact" ? { amounts: Object.fromEntries(Object.entries(exactMinor).filter(([, v]) => v > 0)) } : {}),
          }
        : undefined,
    };
    onSave(out, isNew);
  }

  const totalShares = d.selected.reduce((s, id) => s + (d.shares[id] || 0), 0);
  const curOptions = [...new Set([trip.currency, ...COMMON_CURRENCIES])];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      variant="drawer"
      title={expense ? "Edit expense" : "Add an expense"}
      footer={
        <>
          {expense && onDelete && (
            <Button variant="quiet" className="mr-auto text-owe hover:text-owe" icon={<LuTrash2 aria-hidden />} onClick={() => onDelete(expense)}>
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="expense-form">
            {expense ? "Save changes" : "Add expense"}
          </Button>
        </>
      }
    >
      <form id="expense-form" onSubmit={submit} noValidate className="space-y-6 pt-1">
        <Field label="What was it?" htmlFor="x-title" error={show("title")}>
          <TextInput
            id="x-title"
            ref={titleRef}
            value={d.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Dinner at Time Out Market"
            autoFocus
            maxLength={80}
            invalid={!!show("title")}
            autoComplete="off"
          />
        </Field>

        <div className="grid grid-cols-[1fr_6.5rem] gap-3">
          <Field label="Amount" htmlFor="x-amount" error={show("amount")}>
            <TextInput
              id="x-amount"
              inputMode="decimal"
              value={d.amount}
              onChange={(e) => set("amount", e.target.value)}
              placeholder={currencyDecimals(d.currency) ? "0.00" : "0"}
              className="font-display text-[1.35rem] font-medium tabular"
              invalid={!!show("amount")}
              autoComplete="off"
            />
          </Field>
          <Field label="Currency" htmlFor="x-cur">
            <Select id="x-cur" value={d.currency} onChange={(e) => set("currency", e.target.value)}>
              {curOptions.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
        </div>

        {foreign && (
          <div className="rounded-xl bg-paper-2/70 p-4">
            <Field
              label={`Exchange rate`}
              htmlFor="x-rate"
              error={show("rate")}
              hint={
                converted !== null
                  ? `Split as ${formatMoney(converted, trip.currency)} in the trip currency`
                  : "Use the rate from your card statement for accuracy"
              }
            >
              <div className="flex items-center gap-2 text-[0.92rem] text-ink-2">
                <span className="shrink-0">1 {d.currency} =</span>
                <TextInput
                  id="x-rate"
                  inputMode="decimal"
                  value={d.rate}
                  onChange={(e) => set("rate", e.target.value)}
                  placeholder="0.92"
                  className="max-w-[8rem] tabular"
                  invalid={!!show("rate")}
                />
                <span className="shrink-0">{trip.currency}</span>
              </div>
            </Field>
          </div>
        )}

        <fieldset>
          <legend className="mb-2 text-[0.84rem] font-semibold">Paid by</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Paid by">
            {people.map((p) => {
              const on = d.paidBy === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set("paidBy", p.id)}
                  className={cx(
                    "flex items-center gap-2 rounded-full py-1 pr-3.5 pl-1 text-[0.88rem] font-medium ring-1 ring-inset transition-all",
                    on ? "bg-forest text-paper ring-forest" : "bg-card text-ink ring-line hover:ring-ink/30",
                  )}
                >
                  <Avatar person={p} size={26} />
                  {p.name}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="space-y-5">
          <fieldset>
            <legend className="mb-2 text-[0.84rem] font-semibold">Category</legend>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3" role="radiogroup" aria-label="Category">
              {CATEGORIES.map((c) => {
                const on = d.category === c;
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set("category", c)}
                    className={cx(
                      "flex items-center gap-1.5 rounded-lg px-2 py-2 text-left text-[0.8rem] leading-tight font-medium ring-1 ring-inset transition-all",
                      on ? "bg-forest/[0.07] text-forest ring-forest" : "bg-card text-ink-2 ring-line hover:text-ink hover:ring-ink/30",
                    )}
                  >
                    <CategoryGlyph category={c} className="size-4 shrink-0" />
                    <span className="truncate">{CATEGORY_META[c].label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          <Field label="Date" htmlFor="x-date" error={show("date")} className="sm:max-w-[13rem]">
            <TextInput id="x-date" type="date" value={d.date} onChange={(e) => set("date", e.target.value)} invalid={!!show("date")} />
          </Field>
        </div>

        <section aria-labelledby="split-h" className="rounded-xl ring-1 ring-line">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h3 id="split-h" className="text-[0.92rem] font-semibold">
              Split between
            </h3>
            <Segmented<Mode>
              label="Split method"
              size="sm"
              value={d.mode}
              onChange={(m) => {
                set("mode", m);
              }}
              options={[
                { value: "equal", label: "Equally" },
                { value: "exact", label: "Exact amounts" },
                { value: "shares", label: "By shares" },
              ]}
            />
          </div>
          <p className="px-4 pt-3 text-[0.8rem] text-ink-3">
            {d.mode === "equal" && "Everyone ticked pays the same. Odd cents go to the payer first."}
            {d.mode === "exact" && `Type what each person owes, in ${d.currency}. It has to add up to the total.`}
            {d.mode === "shares" && "Weight the split, e.g. by nights stayed or by people in a couple."}
          </p>
          <ul className="px-2 py-2">
            {people.map((p) => {
              const on = d.selected.includes(p.id);
              const share = preview?.get(p.id) ?? 0;
              return (
                <li key={p.id} className={cx("flex min-h-12 items-center gap-3 rounded-lg px-2 py-1.5", !on && "opacity-55")}>
                  <label className="flex min-w-0 flex-1 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(p.id)}
                      className="size-[1.1rem] shrink-0 accent-[var(--color-forest)]"
                    />
                    <Avatar person={p} size={28} />
                    <span className="truncate text-[0.92rem] font-medium">{p.name}</span>
                    {p.id === d.paidBy && <span className="rounded-full bg-signal/30 px-2 py-0.5 text-[0.72rem] font-semibold text-forest-2">paid</span>}
                  </label>
                  {d.mode === "exact" && on && (
                    <div className="flex items-center gap-1">
                      <input
                        inputMode="decimal"
                        aria-label={`${p.name}'s amount`}
                        value={d.exact[p.id] ?? ""}
                        onChange={(e) => set("exact", { ...d.exact, [p.id]: e.target.value })}
                        placeholder="0.00"
                        className={cx(inputBase, "!h-9 w-24 px-2.5 text-right tabular", !Number.isFinite(exactMinor[p.id]) && "ring-owe")}
                      />
                      <button
                        type="button"
                        onClick={() => fillRemainder(p.id)}
                        className="rounded-md px-1.5 py-1 text-[0.74rem] font-semibold text-ink-3 hover:bg-ink/5 hover:text-ink"
                        title="Give this person whatever is left"
                      >
                        Rest
                      </button>
                    </div>
                  )}
                  {d.mode === "shares" && on && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Fewer shares for ${p.name}`}
                        onClick={() => set("shares", { ...d.shares, [p.id]: Math.max(0, (d.shares[p.id] || 0) - 1) })}
                        className="inline-flex size-8 items-center justify-center rounded-md ring-1 ring-line hover:bg-paper-2"
                      >
                        <LuMinus aria-hidden className="size-3.5" />
                      </button>
                      <span className="w-7 text-center text-[0.92rem] font-semibold tabular" aria-live="polite">
                        {d.shares[p.id] || 0}
                      </span>
                      <button
                        type="button"
                        aria-label={`More shares for ${p.name}`}
                        onClick={() => set("shares", { ...d.shares, [p.id]: (d.shares[p.id] || 0) + 1 })}
                        className="inline-flex size-8 items-center justify-center rounded-md ring-1 ring-line hover:bg-paper-2"
                      >
                        <LuPlus aria-hidden className="size-3.5" />
                      </button>
                    </div>
                  )}
                  <span className="w-[5.5rem] shrink-0 text-right text-[0.88rem] font-semibold text-ink tabular">
                    {on && preview ? formatMoney(share, trip.currency) : on ? "–" : ""}
                  </span>
                </li>
              );
            })}
          </ul>
          <div
            className={cx(
              "flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-[0.84rem]",
              show("split") ? "bg-owe-bg/60" : "",
            )}
            data-error={show("split") ? true : undefined}
            tabIndex={show("split") ? -1 : undefined}
          >
            {d.mode === "exact" ? (
              <>
                <span className={cx("font-medium", errors.split && amountMinor ? "text-owe" : "text-gain")} role="status">
                  {amountMinor === null
                    ? "Enter the total first"
                    : errors.split
                      ? errors.split
                      : `Adds up to ${formatMoney(amountMinor, d.currency)}`}
                </span>
                <button type="button" onClick={splitExactEvenly} className="font-semibold text-forest hover:underline">
                  Start from an even split
                </button>
              </>
            ) : (
              <span className={cx(show("split") ? "font-medium text-owe" : "text-ink-2")} role="status">
                {show("split") ??
                  (d.selected.length === 0
                    ? "Nobody selected"
                    : d.mode === "shares"
                      ? `${d.selected.length} people, ${totalShares} shares`
                      : d.selected.length === people.length
                        ? `Everyone, ${d.selected.length} people`
                        : `${d.selected.length} of ${people.length} people`)}
              </span>
            )}
          </div>
        </section>

        <Field label="Note" htmlFor="x-note" optional>
          <textarea
            id="x-note"
            value={d.note}
            onChange={(e) => set("note", e.target.value)}
            rows={2}
            maxLength={280}
            placeholder="Anything the group should know"
            className={cx(inputBase, "!h-auto w-full py-2.5 leading-relaxed")}
          />
        </Field>
      </form>
    </Dialog>
  );
}
