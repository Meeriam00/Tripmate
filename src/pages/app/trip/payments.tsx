import { useState, type FormEvent } from "react";
import { LuCheck, LuX } from "react-icons/lu";
import { backend } from "../../../backend";
import { currencySymbol, parseAmount, toInputValue } from "../../../lib/money";
import type { Payment } from "../../../lib/types";
import { Avatar, Button, Sheet, TextField, errorText, useToast } from "../../../ui/kit";
import { useTripCtx } from "./context";

/** "Ödəniş etdim": the debtor reports a (full or partial) transfer. */
export function PaySheet({ from, to, max, onClose }: { from: string; to: string; max: number; onClose: () => void }) {
  const c = useTripCtx();
  const toast = useToast();
  const [value, setValue] = useState(toInputValue(max));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const receiver = c.member(to)!;
  const debtor = c.member(from)!;
  const forSomeoneElse = from !== c.me.id;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const amount = parseAmount(value);
    if (amount === null || amount <= 0) return setError("Məbləği düzgün yazın.");
    if (amount > max) return setError(`Ən çox ${c.money(max)} qeyd edə bilərsiniz.`);
    setBusy(true);
    try {
      await backend.markPaymentSent(c.bundle.trip.id, from, to, amount);
      toast.ok(`Qeyd edildi. ${receiver.name.split(" ")[0]} təsdiqləyəndən sonra borc azalacaq.`);
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Ödəniş etdim"
      footer={
        <>
          <Button variant="soft" onClick={onClose}>
            İmtina
          </Button>
          <Button type="submit" form="pay-form" loading={busy}>
            Göndərildi kimi qeyd et
          </Button>
        </>
      }
    >
      <form id="pay-form" className="form-grid" onSubmit={submit} noValidate>
        <div className="pay-route">
          <div>
            <Avatar name={debtor.name} src={debtor.avatar} size={52} />
            <span>{c.nameOf(from)}</span>
          </div>
          <div className="pay-arrow" aria-hidden>
            <span />
          </div>
          <div>
            <Avatar name={receiver.name} src={receiver.avatar} size={52} />
            <span>{c.nameOf(to)}</span>
          </div>
        </div>
        <TextField
          label="Göndərilən məbləğ"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          error={error}
          suffix={currencySymbol(c.bundle.trip.currency)}
          hint={`Açıq borc: ${c.money(max)}. Hissə-hissə də ödəyə bilərsiniz.`}
        />
        <div className="alert info">
          <span>
            Pul TRIPMATE-dən keçmir — nağd və ya bank köçürməsi ilə ödəyin. Borc yalnız <b>{receiver.name.split(" ")[0]}</b> pulu aldığını təsdiqləyəndən sonra bağlanır.
            {forSomeoneElse && " Admin olaraq bu ödənişi hesabı olmayan iştirakçı adından qeyd edirsiniz."}
          </span>
        </div>
      </form>
    </Sheet>
  );
}

/** The receiver's buttons for a pending payment. */
export function ConfirmButtons({ p, compact }: { p: Payment; compact?: boolean }) {
  const c = useTripCtx();
  const toast = useToast();
  const [busy, setBusy] = useState<"confirm" | "reject" | null>(null);
  async function act(action: "confirm" | "reject") {
    setBusy(action);
    try {
      await backend.resolvePayment(c.bundle.trip.id, p.id, action);
      toast.ok(action === "confirm" ? "Təsdiqləndi. Borc yeniləndi." : "Rədd edildi. Borc dəyişmədi.");
    } catch (e) {
      toast.err(errorText(e));
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="confirm-btns">
      <Button size="sm" variant="success" loading={busy === "confirm"} disabled={!!busy} onClick={() => act("confirm")}>
        <LuCheck /> {compact ? "Aldım" : "Pulu aldım"}
      </Button>
      <Button size="sm" variant="danger" loading={busy === "reject"} disabled={!!busy} onClick={() => act("reject")}>
        <LuX /> {compact ? "Çatmayıb" : "Pul çatmayıb"}
      </Button>
    </div>
  );
}

/** Can the current user confirm/reject this pending payment? (receiver, or admin for a name-only receiver) */
export function canResolve(p: Payment, c: ReturnType<typeof useTripCtx>) {
  if (p.status !== "pending" || c.readOnly) return false;
  if (p.to === c.me.id) return true;
  const r = c.member(p.to);
  return !!r && !r.userId && c.isAdmin;
}

/** Can the current user report payments for this debtor? (themself, or admin for a name-only seat) */
export function canPayFor(from: string, c: ReturnType<typeof useTripCtx>) {
  if (c.readOnly) return false;
  if (from === c.me.id) return true;
  const d = c.member(from);
  return !!d && !d.userId && c.isAdmin;
}
