import { useState, type FormEvent } from "react";
import { LuCheck, LuChevronDown, LuTrash2 } from "react-icons/lu";
import { CATEGORY_ICON } from "../components/CategoryIcon";
import { Button, Chip, ConfirmDialog, Dialog, Field, TextInput, cx, inputClass } from "../components/ui";
import { CATEGORY, CATEGORY_ORDER } from "../lib/categories";
import { formatDay, isISO, todayISO } from "../lib/dates";
import { currencySymbol, formatMoney, parseAmount, toInputValue } from "../lib/money";
import { equalShares } from "../lib/split";
import { uid } from "../lib/storage";
import type { Category, Expense, ID, Trip } from "../lib/types";

interface Draft {
  title: string;
  amount: string;
  category: Category;
  paidBy: ID;
  participantIds: ID[];
  mode: "equal" | "custom";
  custom: Record<ID, string>;
  date: string;
  note: string;
}

function defaultDate(trip: Trip): string {
  const t = todayISO();
  if (t >= trip.startDate && t <= trip.endDate) return t;
  const last = [...trip.expenses].sort((a, b) => b.createdAt - a.createdAt)[0];
  return last?.date ?? trip.startDate;
}

function initial(trip: Trip, e?: Expense): Draft {
  const ids = trip.participants.map((p) => p.id);
  if (e)
    return {
      title: e.title,
      amount: toInputValue(e.amount),
      category: e.category,
      paidBy: e.paidBy,
      participantIds: e.participantIds,
      mode: e.custom ? "custom" : "equal",
      custom: e.custom ? Object.fromEntries(Object.entries(e.custom).map(([k, v]) => [k, toInputValue(v)])) : {},
      date: e.date,
      note: e.note ?? "",
    };
  const last = [...trip.expenses].sort((a, b) => b.createdAt - a.createdAt)[0];
  return {
    title: "",
    amount: "",
    category: "food",
    paidBy: last && ids.includes(last.paidBy) ? last.paidBy : ids[0],
    participantIds: ids,
    mode: "equal",
    custom: {},
    date: defaultDate(trip),
    note: "",
  };
}

/**
 * Add or edit an expense in a few steps: what, how much, who paid, who
 * shares it. Custom amounts, date and note are there when needed but stay
 * out of the way. The parent mounts a fresh sheet each time it opens.
 */
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
  onDelete: (e: Expense) => void;
}) {
  const [d, setD] = useState<Draft>(() => initial(trip, expense));
  const [submitted, setSubmitted] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [more, setMore] = useState(() => !!expense?.note);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const people = trip.participants;
  const order = people.map((p) => p.id);
  const cur = trip.currency;
  const amount = parseAmount(d.amount);
  const selected = order.filter((id) => d.participantIds.includes(id));
  const allSelected = selected.length === people.length;

  // Custom split figures (typed in the trip currency)
  const customMinor = Object.fromEntries(selected.map((id) => [id, d.custom[id]?.trim() ? parseAmount(d.custom[id]) : 0]));
  const customBad = selected.some((id) => customMinor[id] === null);
  const customSum = selected.reduce((s, id) => s + (customMinor[id] ?? 0), 0);
  const diff = amount !== null ? amount - customSum : 0;

  const errors = {
    title: !d.title.trim() ? "Xərcin adını yazın" : null,
    amount: d.amount.trim() === "" ? "Məbləği yazın" : amount === null ? "Məbləğ düzgün deyil. Məsələn: 25 və ya 25,50" : amount === 0 ? "Məbləğ sıfırdan böyük olmalıdır" : null,
    people: selected.length === 0 ? "Ən azı bir iştirakçı seçin" : null,
    custom:
      d.mode !== "custom" || amount === null || selected.length === 0
        ? null
        : customBad
          ? "Məbləğlərdən biri düzgün deyil"
          : diff > 0
            ? `Hələ ${formatMoney(diff, cur)} bölünməyib`
            : diff < 0
              ? `Paylar ümumi məbləğdən ${formatMoney(-diff, cur)} çoxdur`
              : null,
    date: !isISO(d.date) ? "Tarixi seçin" : null,
  };
  const valid = Object.values(errors).every((x) => !x);
  const shares = amount && selected.length && d.mode === "equal" ? equalShares(amount, selected, d.paidBy, order) : null;

  function toggle(id: ID) {
    setD((x) => ({
      ...x,
      participantIds: x.participantIds.includes(id) ? x.participantIds.filter((p) => p !== id) : [...x.participantIds, id],
    }));
  }

  /** Fill the custom amounts with an exact equal split as a starting point. */
  function fillEqual() {
    if (amount === null || !selected.length) return;
    const eq = equalShares(amount, selected, d.paidBy, order);
    set("custom", Object.fromEntries([...eq].map(([id, v]) => [id, toInputValue(v)])));
  }

  function switchMode(mode: Draft["mode"]) {
    setD((x) => ({ ...x, mode }));
    if (mode === "custom" && !selected.some((id) => d.custom[id]?.trim())) fillEqual();
  }

  function submit(ev: FormEvent) {
    ev.preventDefault();
    setSubmitted(true);
    if (!valid || amount === null) {
      if (errors.date) setMore(true);
      return;
    }
    onSave(
      {
        id: expense?.id ?? uid("x-"),
        createdAt: expense?.createdAt ?? Date.now(),
        title: d.title.trim(),
        amount,
        category: d.category,
        paidBy: d.paidBy,
        participantIds: selected,
        custom: d.mode === "custom" ? Object.fromEntries(selected.map((id) => [id, customMinor[id] ?? 0])) : undefined,
        date: d.date,
        note: d.note.trim() || undefined,
      },
      !expense,
    );
  }

  const values = shares ? [...shares.values()] : [];
  const min = Math.min(...values);
  const max = Math.max(...values);

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={expense ? "Xərci düzəlt" : "Yeni xərc"}
        footer={
          <>
            {expense && (
              <Button variant="ghost" icon={<LuTrash2 aria-hidden />} onClick={() => setConfirm(true)} className="mr-auto px-3 text-owe hover:bg-owe/10 hover:text-owe">
                Sil
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              Ləğv et
            </Button>
            <Button type="submit" form="expense-form" variant="sun">
              {expense ? "Yadda saxla" : "Əlavə et"}
            </Button>
          </>
        }
      >
        <form id="expense-form" onSubmit={submit} noValidate className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
            <Field label="Xərcin adı" htmlFor="x-title" error={submitted ? errors.title : null}>
              <TextInput
                id="x-title"
                value={d.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Məsələn, şam yeməyi"
                maxLength={60}
                autoComplete="off"
                autoFocus
                invalid={submitted && !!errors.title}
              />
            </Field>
            <Field label="Məbləğ" htmlFor="x-amount" error={submitted ? errors.amount : null}>
              <div className="relative">
                <TextInput
                  id="x-amount"
                  inputMode="decimal"
                  value={d.amount}
                  onChange={(e) => set("amount", e.target.value)}
                  placeholder="0,00"
                  autoComplete="off"
                  invalid={submitted && !!errors.amount}
                  className="pr-10 text-[1.1rem] font-semibold tabular"
                />
                <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 font-semibold text-ink-3" aria-hidden>
                  {currencySymbol(cur)}
                </span>
              </div>
            </Field>
          </div>

          <fieldset>
            <legend className="mb-2.5 text-[0.86rem] font-semibold">Kateqoriya</legend>
            <div role="radiogroup" aria-label="Kateqoriya" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {CATEGORY_ORDER.map((c) => {
                const Icon = CATEGORY_ICON[c];
                const on = d.category === c;
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set("category", c)}
                    className={cx(
                      "flex flex-col items-center gap-1.5 rounded-2xl border-2 px-1 py-2.5 text-[0.76rem] font-medium transition-colors",
                      on ? "border-sun bg-cream-2 text-ink" : "border-line text-ink-2 hover:border-sun-soft hover:text-ink",
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                    {CATEGORY[c].label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2.5 text-[0.86rem] font-semibold">Kim ödədi?</legend>
            <div role="radiogroup" aria-label="Kim ödədi?" className="flex flex-wrap gap-2">
              {people.map((p) => (
                <Chip key={p.id} role="radio" selected={d.paidBy === p.id} onClick={() => set("paidBy", p.id)}>
                  {p.name}
                </Chip>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
              <legend className="text-[0.86rem] font-semibold">Kimlər arasında bölünsün?</legend>
              <div role="radiogroup" aria-label="Bölgü üsulu" className="inline-flex rounded-full bg-mist p-1">
                {(["equal", "custom"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={d.mode === m}
                    onClick={() => switchMode(m)}
                    className={cx("rounded-full px-3.5 py-1.5 text-[0.8rem] font-semibold transition-colors", d.mode === m ? "bg-white text-ink shadow-sm" : "text-ink-2 hover:text-ink")}
                  >
                    {m === "equal" ? "Bərabər" : "Fərdi"}
                  </button>
                ))}
              </div>
            </div>
            <div role="group" aria-label="Kimlər arasında bölünsün?" className="flex flex-wrap gap-2">
              {people.map((p) => {
                const on = d.participantIds.includes(p.id);
                return (
                  <Chip key={p.id} role="checkbox" selected={on} onClick={() => toggle(p.id)}>
                    {on && <LuCheck className="-ml-1 size-4" aria-hidden />}
                    {p.name}
                  </Chip>
                );
              })}
              <button type="button" onClick={() => set("participantIds", allSelected ? [] : order)} className="h-11 rounded-full px-3 text-[0.82rem] font-semibold text-sun-2 hover:text-ink">
                {allSelected ? "Heç kimi seçmə" : "Hamısını seç"}
              </button>
            </div>

            {d.mode === "custom" && selected.length > 0 && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-line">
                <ul className="divide-y divide-line">
                  {selected.map((id) => (
                    <li key={id} className="flex items-center gap-3 px-4 py-2">
                      <span className="flex-1 text-[0.9rem] font-medium">{people.find((p) => p.id === id)?.name}</span>
                      <div className="relative w-36">
                        <input
                          inputMode="decimal"
                          aria-label={`${people.find((p) => p.id === id)?.name} payı`}
                          value={d.custom[id] ?? ""}
                          onChange={(e) => set("custom", { ...d.custom, [id]: e.target.value })}
                          placeholder="0,00"
                          className={cx(inputClass, "h-10 pr-8 text-right tabular", customMinor[id] === null && "border-owe")}
                        />
                        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[0.85rem] text-ink-3" aria-hidden>
                          {currencySymbol(cur)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className={cx("flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[0.82rem]", errors.custom ? "bg-owe/5" : "bg-gain/5")}>
                  <span role="status" className={cx("font-medium", errors.custom ? "text-owe" : "text-gain")}>
                    {amount === null ? "Əvvəlcə ümumi məbləği yazın" : (errors.custom ?? `Hamısı bölündü: ${formatMoney(amount, cur)}`)}
                  </span>
                  <button type="button" onClick={fillEqual} className="rounded font-semibold text-ink hover:text-sun-2">
                    Bərabər doldur
                  </button>
                </div>
              </div>
            )}

            {d.mode === "equal" && (
              <p
                role={submitted && errors.people ? "alert" : "status"}
                className={submitted && errors.people ? "mt-3 text-[0.82rem] font-medium text-owe" : "mt-3 rounded-2xl bg-cream-2 px-4 py-3 text-[0.88rem] text-ink-2"}
              >
                {submitted && errors.people
                  ? errors.people
                  : !shares
                    ? selected.length === 0
                      ? "Heç kim seçilməyib"
                      : `${selected.length} nəfər arasında bərabər bölünəcək`
                    : min === max
                      ? <>Hər nəfərə <b className="font-semibold text-ink tabular">{formatMoney(max, cur)}</b> düşür</>
                      : <>Hər nəfərə <b className="font-semibold text-ink tabular">{formatMoney(min, cur)} – {formatMoney(max, cur)}</b> düşür. Bölünməyən qəpiklər əvvəlcə ödəyənə yazılır.</>}
              </p>
            )}
            {d.mode === "custom" && submitted && errors.people && (
              <p role="alert" className="mt-3 text-[0.82rem] font-medium text-owe">
                {errors.people}
              </p>
            )}
          </fieldset>

          <div className="rounded-2xl border border-line">
            <button
              type="button"
              aria-expanded={more}
              onClick={() => setMore((m) => !m)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[0.88rem]"
            >
              <span className="font-semibold">Tarix və qeyd</span>
              <span className="flex items-center gap-2 text-ink-2">
                {formatDay(d.date)}
                {d.note.trim() && ", qeyd var"}
                <LuChevronDown className={cx("size-4 transition-transform", more && "rotate-180")} aria-hidden />
              </span>
            </button>
            {more && (
              <div className="grid gap-4 border-t border-line px-4 pt-4 pb-4 sm:grid-cols-[11rem_1fr]">
                <Field label="Tarix" htmlFor="x-date" error={submitted ? errors.date : null}>
                  <TextInput id="x-date" type="date" value={d.date} onChange={(e) => set("date", e.target.value)} invalid={submitted && !!errors.date} />
                </Field>
                <Field label="Qeyd" htmlFor="x-note" optional>
                  <TextInput id="x-note" value={d.note} onChange={(e) => set("note", e.target.value)} placeholder="Məsələn, kart ilə ödənilib" maxLength={140} autoComplete="off" />
                </Field>
              </div>
            )}
          </div>
        </form>
      </Dialog>

      {expense && (
        <ConfirmDialog
          open={confirm}
          onClose={() => setConfirm(false)}
          title="Xərc silinsin?"
          body={`«${expense.title}» silinəcək və bütün hesablar yenidən aparılacaq.`}
          confirmLabel="Sil"
          onConfirm={() => onDelete(expense)}
        />
      )}
    </>
  );
}
