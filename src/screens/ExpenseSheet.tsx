import { useState, type FormEvent } from "react";
import { LuCheck, LuTrash2 } from "react-icons/lu";
import { Button, Chip, ConfirmDialog, Dialog, Field, TextInput } from "../components/ui";
import { currencySymbol, formatMoney, parseAmount, toInputValue } from "../lib/money";
import { equalShares } from "../lib/split";
import { uid } from "../lib/storage";
import type { Expense, ID, Trip } from "../lib/types";

interface Draft {
  title: string;
  amount: string;
  paidBy: ID;
  participantIds: ID[];
}

function initial(trip: Trip, e?: Expense): Draft {
  const ids = trip.participants.map((p) => p.id);
  if (e) return { title: e.title, amount: toInputValue(e.amount), paidBy: e.paidBy, participantIds: e.participantIds };
  const last = trip.expenses[trip.expenses.length - 1];
  return { title: "", amount: "", paidBy: last && ids.includes(last.paidBy) ? last.paidBy : ids[0], participantIds: ids };
}

/**
 * Add or edit an expense: name, amount, who paid, who took part. Always an
 * equal split. The parent mounts a fresh sheet (new `key`) each time it
 * opens, so the form always starts from the right values.
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

  const people = trip.participants;
  const order = people.map((p) => p.id);
  const amount = parseAmount(d.amount);
  const selected = order.filter((id) => d.participantIds.includes(id));
  const allSelected = selected.length === people.length;

  const errors = {
    title: !d.title.trim() ? "Xərcin adını yazın" : null,
    amount: d.amount.trim() === "" ? "Məbləği yazın" : amount === null ? "Məbləğ düzgün deyil. Məsələn: 25 və ya 25,50" : amount === 0 ? "Məbləğ sıfırdan böyük olmalıdır" : null,
    people: selected.length === 0 ? "Ən azı bir iştirakçı seçin" : null,
  };
  const valid = !errors.title && !errors.amount && !errors.people;

  const shares = amount && selected.length ? equalShares(amount, selected, d.paidBy, order) : null;
  const values = shares ? [...shares.values()] : [];
  const min = Math.min(...values);
  const max = Math.max(...values);

  function toggle(id: ID) {
    setD((x) => ({
      ...x,
      participantIds: x.participantIds.includes(id) ? x.participantIds.filter((p) => p !== id) : [...x.participantIds, id],
    }));
  }

  function submit(ev: FormEvent) {
    ev.preventDefault();
    setSubmitted(true);
    if (!valid || amount === null) return;
    onSave(
      {
        id: expense?.id ?? uid("x-"),
        createdAt: expense?.createdAt ?? Date.now(),
        title: d.title.trim(),
        amount,
        paidBy: d.paidBy,
        participantIds: selected,
      },
      !expense,
    );
  }

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
          <Field label="Xərcin adı" htmlFor="x-title" error={submitted ? errors.title : null}>
            <TextInput
              id="x-title"
              value={d.title}
              onChange={(e) => setD({ ...d, title: e.target.value })}
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
                onChange={(e) => setD({ ...d, amount: e.target.value })}
                placeholder="0,00"
                autoComplete="off"
                invalid={submitted && !!errors.amount}
                className="pr-12 text-[1.2rem] font-semibold tabular"
              />
              <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[1.1rem] font-semibold text-ink-3" aria-hidden>
                {currencySymbol(trip.currency)}
              </span>
            </div>
          </Field>

          <fieldset>
            <legend className="mb-2.5 text-[0.86rem] font-semibold">Kim ödədi?</legend>
            <div role="radiogroup" aria-label="Kim ödədi?" className="flex flex-wrap gap-2">
              {people.map((p) => (
                <Chip key={p.id} role="radio" selected={d.paidBy === p.id} onClick={() => setD({ ...d, paidBy: p.id })}>
                  {p.name}
                </Chip>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <div className="mb-2.5 flex items-baseline justify-between gap-3">
              <legend className="text-[0.86rem] font-semibold">Kimlər iştirak etdi?</legend>
              <button
                type="button"
                onClick={() => setD({ ...d, participantIds: allSelected ? [] : order })}
                className="rounded text-[0.82rem] font-semibold text-sun-2 hover:text-ink"
              >
                {allSelected ? "Heç kimi seçmə" : "Hamısını seç"}
              </button>
            </div>
            <div role="group" aria-label="Kimlər iştirak etdi?" className="flex flex-wrap gap-2">
              {people.map((p) => {
                const on = d.participantIds.includes(p.id);
                return (
                  <Chip key={p.id} role="checkbox" selected={on} onClick={() => toggle(p.id)}>
                    {on && <LuCheck className="-ml-1 size-4" aria-hidden />}
                    {p.name}
                  </Chip>
                );
              })}
            </div>
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
                    ? <>Hər nəfərə <b className="font-semibold text-ink tabular">{formatMoney(max, trip.currency)}</b> düşür</>
                    : <>Hər nəfərə <b className="font-semibold text-ink tabular">{formatMoney(min, trip.currency)} – {formatMoney(max, trip.currency)}</b> düşür. Bölünməyən qəpiklər əvvəlcə ödəyənə, o iştirak etmirsə, siyahıdakı ilk nəfərlərə yazılır.</>}
            </p>
          </fieldset>
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
