import { useMemo, useState } from "react";
import { LuArrowRight, LuCheck, LuCircleCheck, LuHandCoins, LuRotateCcw } from "react-icons/lu";
import { useToast } from "../components/Toast";
import { Avatar, Button, Dialog, EmptyState, Field, IconButton, LinkButton, Money, Panel, Select, TextInput, cx } from "../components/ui";
import { formatShort, todayISO } from "../lib/dates";
import { currencyDecimals, formatMoney, parseAmount, toInputValue } from "../lib/money";
import { uid } from "../lib/storage";
import { settlementView } from "../lib/trip";
import type { Payment } from "../lib/types";
import { href } from "../state/router";
import { useStore } from "../state/store";
import type { WorkspaceApi } from "./TripWorkspace";

export function SettleTab({ trip, openExpense }: WorkspaceApi) {
  const { dispatch } = useStore();
  const toast = useToast();
  const view = useMemo(() => settlementView(trip), [trip]);
  const [justPaid, setJustPaid] = useState<string | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);
  const cur = trip.currency;
  const byId = new Map(trip.participants.map((p) => [p.id, p]));
  const name = (id: string) => byId.get(id)?.name ?? "Removed";

  const creditors = trip.participants.filter((p) => view.ledgers.get(p.id)!.outstanding > 0);
  const debtors = trip.participants.filter((p) => view.ledgers.get(p.id)!.outstanding < 0);
  const square = trip.participants.filter((p) => view.ledgers.get(p.id)!.outstanding === 0);
  const progress = view.original > 0 ? Math.min(1, (view.original - view.outstanding) / view.original) : 1;

  function record(p: Omit<Payment, "id" | "createdAt" | "date">, message?: string) {
    const payment: Payment = { ...p, id: uid("pay-"), date: todayISO(), createdAt: Date.now() };
    dispatch({ type: "payment/add", tripId: trip.id, payment });
    setJustPaid(`${p.from}-${p.to}`);
    toast.show(message ?? `${name(p.from)} paid ${name(p.to)} ${formatMoney(p.amount, cur)}`, {
      action: { label: "Undo", run: () => dispatch({ type: "payment/remove", tripId: trip.id, id: payment.id }) },
    });
  }

  if (trip.expenses.length === 0) {
    return (
      <Panel>
        <EmptyState
          title="Nothing to settle yet"
          body="Once expenses are logged, this is where you'll see exactly who pays whom."
          action={<Button variant="primary" onClick={() => openExpense()}>Add an expense</Button>}
        />
      </Panel>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <section className="board overflow-hidden rounded-[1.25rem] shadow-lift" aria-labelledby="board-h">
          <div className="px-5 pt-6 pb-5 sm:px-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="board-h" className="font-display text-[clamp(1.7rem,3.6vw,2.3rem)] leading-tight font-medium">
                  {view.settled ? "All settled" : "Settle up"}
                </h2>
                <p className="mt-1 text-[0.92rem] text-paper/70">
                  {view.settled
                    ? "Every balance is zero. Nobody owes anything."
                    : `${view.transfers.length} payment${view.transfers.length === 1 ? "" : "s"} will clear ${formatMoney(view.outstanding, cur)}. That's the fewest possible.`}
                </p>
              </div>
              {trip.payments.length > 0 && (
                <p className="text-[0.84rem] text-paper/70 tabular">
                  {formatMoney(view.original - view.outstanding, cur)} of {formatMoney(view.original, cur)} paid
                </p>
              )}
            </div>
            {trip.payments.length > 0 && (
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Settled so far">
                <div className="h-full rounded-full bg-signal transition-[width] duration-500" style={{ width: `${progress * 100}%` }} />
              </div>
            )}
          </div>

          {view.settled ? (
            <div className="flex flex-col items-center gap-4 border-t border-paper/10 px-6 py-10 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-signal text-forest-2">
                <LuCheck className="size-7" aria-hidden />
              </span>
              <p className="max-w-xs text-paper/80">
                {trip.payments.length} payment{trip.payments.length === 1 ? "" : "s"} recorded. The expense history is unchanged.
              </p>
              <LinkButton href={href({ name: "trip", id: trip.id, tab: "summary" })} variant="signal">
                See the trip summary
              </LinkButton>
            </div>
          ) : (
            <ol className="border-t border-paper/10">
              {view.transfers.map((t) => {
                const from = byId.get(t.from)!;
                const to = byId.get(t.to)!;
                const key = `${t.from}-${t.to}`;
                return (
                  <li key={key} className={cx("board-row flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-7", justPaid === key && "row-settle")}>
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar person={from} size={36} />
                      <div className="min-w-0">
                        <p className="truncate text-[1rem] font-semibold">
                          {from.name} <span className="font-normal text-paper/55">pays</span> {to.name}
                        </p>
                        <p className="text-[0.8rem] text-paper/50">
                          {from.name} owes {formatMoney(-view.ledgers.get(t.from)!.outstanding, cur)} in total
                        </p>
                      </div>
                      <LuArrowRight className="ml-auto hidden size-4 shrink-0 text-paper/40 sm:block" aria-hidden />
                      <span className="hidden sm:block"><Avatar person={to} size={36} /></span>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <span className="flap text-right sm:min-w-[7.5rem] text-[1.15rem] font-semibold tabular">{formatMoney(t.amount, cur)}</span>
                      <Button
                        size="sm"
                        variant="signal"
                        icon={<LuCheck aria-hidden />}
                        onClick={() => record({ from: t.from, to: t.to, amount: t.amount })}
                        aria-label={`Mark ${from.name} paid ${to.name} ${formatMoney(t.amount, cur)}`}
                      >
                        Mark paid
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-paper/10 px-5 py-3 sm:px-7">
            <p className="text-[0.8rem] text-paper/50">Paid a different amount? Record it and the plan adjusts.</p>
            <Button size="sm" variant="ghost" className="text-paper hover:bg-white/10" icon={<LuHandCoins aria-hidden />} onClick={() => setRecordOpen(true)}>
              Record a payment
            </Button>
          </div>
        </section>

        <details className="group mt-5 rounded-xl px-1 text-[0.9rem] text-ink-2">
          <summary className="inline-flex items-center gap-2 rounded font-semibold text-ink marker:content-none">
            <span className="transition-transform group-open:rotate-90" aria-hidden>
              ›
            </span>
            How is this worked out?
          </summary>
          <div className="mt-3 max-w-prose space-y-2 pl-5 leading-relaxed">
            <p>
              Each person's balance is what they paid minus their share of every expense they were part of. Recorded payments
              then move money between balances. Balances always add up to zero.
            </p>
            <p>
              To keep payments few, Tripmate looks for groups of people whose balances cancel each other out and settles each
              group on its own. A group of <em>n</em> people needs at most <em>n − 1</em> payments, so finding the most
              groups gives the fewest payments overall. People who are square are left out.
            </p>
            <p>All amounts are whole cents, so nothing is lost to rounding.</p>
          </div>
        </details>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-6 lg:col-span-5">
        <Panel className="p-5 sm:p-6">
          <h3 className="font-display text-[1.35rem] font-medium">Where everyone stands</h3>
          <BalanceGroup title="Gets back" people={creditors} tone="gain" view={view} cur={cur} />
          <BalanceGroup title="Owes" people={debtors} tone="owe" view={view} cur={cur} />
          {square.length > 0 && (
            <div className="mt-5">
              <p className="text-[0.8rem] font-semibold text-ink-3">Square</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {square.map((p) => (
                  <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full bg-paper-2 py-1 pr-3 pl-1 text-[0.85rem]">
                    <Avatar person={p} size={22} /> {p.name}
                    <LuCircleCheck className="size-3.5 text-gain" aria-label="square" />
                  </span>
                ))}
              </div>
            </div>
          )}
        </Panel>

        <Panel className="p-5 sm:p-6">
          <h3 className="font-display text-[1.35rem] font-medium">Payments made</h3>
          {trip.payments.length === 0 ? (
            <p className="mt-2 text-[0.9rem] text-ink-3">When someone pays back, mark it on the board. It shows up here.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line/60">
              {[...trip.payments].reverse().map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex -space-x-1.5">
                    {byId.get(p.from) && <Avatar person={byId.get(p.from)!} size={26} ring />}
                    {byId.get(p.to) && <Avatar person={byId.get(p.to)!} size={26} ring />}
                  </span>
                  <span className="min-w-0 flex-1 text-[0.88rem]">
                    <span className="font-medium">{name(p.from)}</span> paid <span className="font-medium">{name(p.to)}</span>
                    <span className="block text-[0.78rem] text-ink-3">{formatShort(p.date)}</span>
                  </span>
                  <Money value={p.amount} currency={cur} className="text-[0.9rem] font-semibold" />
                  <IconButton
                    label="Undo this payment"
                    onClick={() => {
                      dispatch({ type: "payment/remove", tripId: trip.id, id: p.id });
                      toast.show("Payment removed. Balances restored.", {
                        tone: "info",
                        action: { label: "Undo", run: () => dispatch({ type: "payment/add", tripId: trip.id, payment: p }) },
                      });
                    }}
                  >
                    <LuRotateCcw className="size-4" aria-hidden />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <RecordPaymentDialog
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        trip={trip}
        suggestion={view.transfers[0]}
        onRecord={(p) => {
          record(p);
          setRecordOpen(false);
        }}
      />
    </div>
  );
}

function BalanceGroup({
  title,
  people,
  tone,
  view,
  cur,
}: {
  title: string;
  people: WorkspaceApi["trip"]["participants"];
  tone: "gain" | "owe";
  view: ReturnType<typeof settlementView>;
  cur: string;
}) {
  if (!people.length) return null;
  const sorted = [...people].sort((a, b) => Math.abs(view.ledgers.get(b.id)!.outstanding) - Math.abs(view.ledgers.get(a.id)!.outstanding));
  return (
    <div className="mt-5">
      <p className={cx("text-[0.8rem] font-semibold", tone === "gain" ? "text-gain" : "text-owe")}>{title}</p>
      <ul className="mt-2 space-y-2">
        {sorted.map((p) => {
          const v = view.ledgers.get(p.id)!.outstanding;
          return (
            <li key={p.id} className={cx("flex items-center gap-3 rounded-xl px-3 py-2.5", tone === "gain" ? "bg-gain-bg" : "bg-owe-bg")}>
              <Avatar person={p} size={30} />
              <span className="flex-1 text-[0.92rem] font-medium">{p.name}</span>
              <Money value={v} currency={cur} signed tone="auto" className="font-semibold" />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RecordPaymentDialog({
  open,
  onClose,
  trip,
  suggestion,
  onRecord,
}: {
  open: boolean;
  onClose: () => void;
  trip: WorkspaceApi["trip"];
  suggestion?: { from: string; to: string; amount: number };
  onRecord: (p: { from: string; to: string; amount: number }) => void;
}) {
  const ids = trip.participants.map((p) => p.id);
  const [from, setFrom] = useState(suggestion?.from ?? ids[0]);
  const [to, setTo] = useState(suggestion?.to ?? ids[1]);
  const [amount, setAmount] = useState(suggestion ? toInputValue(suggestion.amount, trip.currency) : "");
  const [submitted, setSubmitted] = useState(false);
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setFrom(suggestion?.from ?? ids[0]);
      setTo(suggestion?.to ?? ids[1]);
      setAmount(suggestion ? toInputValue(suggestion.amount, trip.currency) : "");
      setSubmitted(false);
    }
  }
  const minor = parseAmount(amount, trip.currency);
  const err = !minor ? `Enter an amount with up to ${currencyDecimals(trip.currency)} decimals` : from === to ? "Pick two different people" : null;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Record a payment"
      description="For partial payments, or money that changed hands outside the plan."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setSubmitted(true);
              if (!err && minor) onRecord({ from, to, amount: minor });
            }}
          >
            Record payment
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="From" htmlFor="rp-from">
          <Select id="rp-from" value={from} onChange={(e) => setFrom(e.target.value)}>
            {trip.participants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="To" htmlFor="rp-to">
          <Select id="rp-to" value={to} onChange={(e) => setTo(e.target.value)}>
            {trip.participants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={`Amount (${trip.currency})`} htmlFor="rp-amt" error={submitted ? err : null} className="sm:col-span-2">
          <TextInput id="rp-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} invalid={submitted && !!err} />
        </Field>
      </div>
    </Dialog>
  );
}
