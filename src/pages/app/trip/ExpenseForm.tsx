import { useMemo, useState, type FormEvent } from "react";
import { LuCamera, LuX } from "react-icons/lu";
import { backend } from "../../../backend";
import { CATEGORY, CATEGORY_ORDER } from "../../../lib/categories";
import { todayISO } from "../../../lib/dates";
import { currencySymbol, parseAmount, toInputValue } from "../../../lib/money";
import { computeSplit, evenPercents, formatPercent, parsePercent } from "../../../lib/split";
import type { Category, Expense, ID, SplitMethod } from "../../../lib/types";
import { compressImage } from "../../../ui/image";
import { CategoryIcon } from "../../../ui/icons";
import { Avatar, Button, Field, Sheet, TextField, errorText, useToast } from "../../../ui/kit";
import { useTripCtx } from "./context";

function defaultDate(start: string, end: string) {
  const t = todayISO();
  if (t < start) return start;
  if (t > end) return end;
  return t;
}

export function ExpenseForm({ expense, onClose }: { expense?: Expense; onClose: () => void }) {
  const c = useTripCtx();
  const toast = useToast();
  const { trip, members } = c.bundle;
  const sym = currencySymbol(trip.currency);
  const order = members.map((m) => m.id);
  const people = members.filter((m) => m.status === "active" || (expense && (expense.shares[m.id] !== undefined || expense.paidBy === m.id)));

  const [amount, setAmount] = useState(expense ? toInputValue(expense.amount) : "");
  const [title, setTitle] = useState(expense?.title ?? "");
  const [category, setCategory] = useState<Category>(expense?.category ?? "food");
  const [paidBy, setPaidBy] = useState<ID>(expense?.paidBy ?? c.me.id);
  const [method, setMethod] = useState<SplitMethod>(expense?.method ?? "equal");
  const [selected, setSelected] = useState<ID[]>(expense ? Object.keys(expense.shares) : people.filter((m) => m.status === "active").map((m) => m.id));
  const [custom, setCustom] = useState<Record<ID, string>>(() =>
    expense ? Object.fromEntries(Object.entries(expense.shares).map(([k, v]) => [k, toInputValue(v)])) : {},
  );
  const [pct, setPct] = useState<Record<ID, string>>(() =>
    expense?.percents ? Object.fromEntries(Object.entries(expense.percents).map(([k, v]) => [k, formatPercent(v)])) : {},
  );
  const [date, setDate] = useState(expense?.date ?? defaultDate(trip.startDate, trip.endDate));
  const [note, setNote] = useState(expense?.note ?? "");
  const [receipt, setReceipt] = useState<string | null>(expense?.receipt ?? null);
  const [errors, setErrors] = useState<{ amount?: string; title?: string; split?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  const minor = parseAmount(amount);
  const ordered = people.map((m) => m.id).filter((id) => selected.includes(id));

  const customMinor = useMemo(() => Object.fromEntries(ordered.map((id) => [id, parseAmount(custom[id] ?? "") ?? 0])), [custom, ordered.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const pctBp = useMemo(() => Object.fromEntries(ordered.map((id) => [id, parsePercent(pct[id] ?? "") ?? 0])), [pct, ordered.join()]); // eslint-disable-line react-hooks/exhaustive-deps

  const preview = useMemo(() => {
    if (!minor || minor <= 0 || !ordered.length) return null;
    return computeSplit({ amount: minor, method, payerId: paidBy, participantIds: ordered, custom: customMinor, percents: pctBp, order });
  }, [minor, method, paidBy, ordered.join(), customMinor, pctBp]); // eslint-disable-line react-hooks/exhaustive-deps

  const customSum = ordered.reduce((s, id) => s + (customMinor[id] ?? 0), 0);
  const pctSum = ordered.reduce((s, id) => s + (pctBp[id] ?? 0), 0);

  function toggle(id: ID) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  function switchMethod(m: SplitMethod) {
    setMethod(m);
    if (m === "percent" && pctSum === 0) {
      const even = evenPercents(ordered);
      setPct(Object.fromEntries(Object.entries(even).map(([k, v]) => [k, formatPercent(v)])));
    }
    if (m === "custom" && customSum === 0 && minor && preview?.ok) {
      const eq = computeSplit({ amount: minor, method: "equal", payerId: paidBy, participantIds: ordered, order });
      if (eq.ok) setCustom(Object.fromEntries(Object.entries(eq.shares).map(([k, v]) => [k, toInputValue(v)])));
    }
  }

  async function pickReceipt(file: File | undefined) {
    if (!file) return;
    try {
      setReceipt(await compressImage(file, 1100, 0.7));
    } catch (e) {
      toast.err(errorText(e));
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (minor === null || minor <= 0) errs.amount = "Məbləği yazın (sıfırdan böyük).";
    if (!title.trim()) errs.title = "Xərcin adını yazın, məsələn «Şam yeməyi».";
    if (!ordered.length) errs.split = "Xərci bölüşən ən azı bir nəfər seçin.";
    else if (preview && !preview.ok) errs.split = preview.error;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const receiptUrl = receipt && receipt.startsWith("data:") ? await backend.uploadImage("receipt", receipt) : receipt;
      await backend.saveExpense(
        trip.id,
        { title, amount: minor!, category, paidBy, method, participantIds: ordered, custom: customMinor, percents: pctBp, date, note, receipt: receiptUrl },
        expense?.id,
      );
      toast.ok(expense ? "Xərc yeniləndi, balanslar yenidən hesablandı." : "Xərc əlavə olundu, balanslar yeniləndi.");
      onClose();
    } catch (err) {
      setErrors({ form: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  const remainder = (minor ?? 0) - customSum;

  return (
    <Sheet
      open
      wide
      onClose={onClose}
      title={expense ? "Xərci düzəlt" : "Xərc əlavə et"}
      footer={
        <>
          <Button variant="soft" onClick={onClose}>
            İmtina
          </Button>
          <Button type="submit" form="expense-form" loading={busy}>
            Yadda saxla
          </Button>
        </>
      }
    >
      <form id="expense-form" className="form-grid expense-form" onSubmit={submit} noValidate>
        {errors.form && <div className="alert">{errors.form}</div>}

        <div className="amount-hero">
          <label htmlFor="exp-amount" className="sr-only">
            Məbləğ
          </label>
          <input
            id="exp-amount"
            data-autofocus
            className="amount-input num"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={errors.amount ? true : undefined}
          />
          <span className="amount-cur">{sym}</span>
        </div>
        {errors.amount && <div className="field-error" style={{ textAlign: "center", marginTop: -8 }}>{errors.amount}</div>}

        <TextField label="Nə üçün?" placeholder="Şam yeməyi, otel, taksi..." value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} maxLength={80} />

        <Field label="Kateqoriya">
          <div className="chips wrap" role="radiogroup" aria-label="Kateqoriya">
            {CATEGORY_ORDER.map((k) => (
              <button
                type="button"
                key={k}
                role="radio"
                aria-checked={category === k}
                className={`chip cat ${category === k ? "on" : ""}`}
                style={{ ["--tone" as string]: CATEGORY[k].color }}
                onClick={() => setCategory(k)}
              >
                <CategoryIcon category={k} /> {CATEGORY[k].label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Kim ödədi?">
          <div className="payer-row" role="radiogroup" aria-label="Kim ödədi?">
            {people
              .filter((m) => m.status === "active" || m.id === paidBy)
              .map((m) => (
                <button type="button" key={m.id} role="radio" aria-checked={paidBy === m.id} className={`payer ${paidBy === m.id ? "on" : ""}`} onClick={() => setPaidBy(m.id)}>
                  <Avatar name={m.name} src={m.avatar} size={44} />
                  <span>{c.nameOf(m.id)}</span>
                </button>
              ))}
          </div>
        </Field>

        <Field label="Necə bölünsün?">
          <div className="seg" role="group" aria-label="Bölgü üsulu">
            {(
              [
                ["equal", "Bərabər"],
                ["custom", "Məbləğlə"],
                ["percent", "Faizlə"],
              ] as const
            ).map(([k, l]) => (
              <button type="button" key={k} aria-pressed={method === k} onClick={() => switchMethod(k)}>
                {l}
              </button>
            ))}
          </div>
        </Field>

        <div className="split-box">
          <div className="split-head">
            <span className="label">Kimlər bölüşür? ({ordered.length})</span>
            <span className="split-tools">
              <button type="button" className="link" onClick={() => setSelected(people.filter((m) => m.status === "active").map((m) => m.id))}>
                Hamısı
              </button>
              <button type="button" className="link" onClick={() => setSelected([])}>
                Heç kim
              </button>
            </span>
          </div>
          {people.map((m) => {
            const on = selected.includes(m.id);
            const share = preview?.ok ? preview.shares[m.id] : undefined;
            return (
              <div key={m.id} className={`split-row ${on ? "on" : ""}`}>
                <label className="split-person">
                  <input type="checkbox" checked={on} onChange={() => toggle(m.id)} />
                  <Avatar name={m.name} src={m.avatar} size={34} />
                  <span>
                    {m.name}
                    {m.status === "removed" && <span className="faint"> (çıxıb)</span>}
                  </span>
                </label>
                {on && method === "equal" && <span className="split-val num faint">{share !== undefined ? c.money(share) : "—"}</span>}
                {on && method === "custom" && (
                  <div className="input-wrap split-input">
                    <input className="input has-suffix num" inputMode="decimal" placeholder="0" aria-label={`${m.name} üçün məbləğ`} value={custom[m.id] ?? ""} onChange={(e) => setCustom({ ...custom, [m.id]: e.target.value })} />
                    <span className="suffix">{sym}</span>
                  </div>
                )}
                {on && method === "percent" && (
                  <div className="split-pct">
                    <div className="input-wrap split-input">
                      <input className="input has-suffix num" inputMode="decimal" placeholder="0" aria-label={`${m.name} üçün faiz`} value={pct[m.id] ?? ""} onChange={(e) => setPct({ ...pct, [m.id]: e.target.value })} />
                      <span className="suffix">%</span>
                    </div>
                    <span className="faint small num">{share !== undefined ? c.money(share) : ""}</span>
                  </div>
                )}
              </div>
            );
          })}
          {method === "custom" && minor ? (
            <div className={`split-sum ${remainder === 0 ? "ok" : "bad"}`}>
              {remainder === 0 ? "Məbləğlər tam bölüşdürülüb ✓" : remainder > 0 ? `Bölüşdürülməyib: ${c.money(remainder)}` : `Artıqdır: ${c.money(-remainder)}`}
            </div>
          ) : null}
          {method === "percent" && (
            <div className={`split-sum ${pctSum === 10000 ? "ok" : "bad"}`}>
              Cəmi: <span className="num">{formatPercent(pctSum)}%</span> {pctSum === 10000 ? "✓" : pctSum < 10000 ? `(${formatPercent(10000 - pctSum)}% qalıb)` : `(${formatPercent(pctSum - 10000)}% artıq)`}
            </div>
          )}
          {errors.split && <div className="field-error">{errors.split}</div>}
        </div>

        <div className="row-2">
          <TextField label="Tarix" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Field label="Çek (istəyə bağlı)">
            {receipt ? (
              <div className="receipt-thumb">
                <img src={receipt} alt="Çek" />
                <button type="button" className="icon-btn" aria-label="Çeki sil" onClick={() => setReceipt(null)}>
                  <LuX />
                </button>
              </div>
            ) : (
              <label className="receipt-pick">
                <LuCamera /> Şəkil əlavə et
                <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => pickReceipt(e.target.files?.[0])} />
              </label>
            )}
          </Field>
        </div>
        <Field label="Qeyd (istəyə bağlı)" htmlFor="exp-note">
          <textarea id="exp-note" className="input" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Məsələn: bron nömrəsi, kimin nə sifariş etdiyi" />
        </Field>
      </form>
    </Sheet>
  );
}
