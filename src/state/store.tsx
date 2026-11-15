import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { sampleTrip } from "../lib/sample";
import { loadState, saveState, STORAGE_KEY, uid, type Saved } from "../lib/storage";
import type { Activity, Expense, ID, Payment, Trip } from "../lib/types";

type Action =
  | { type: "trip/save"; trip: Trip }
  | { type: "trip/delete"; id: ID }
  | { type: "expense/save"; tripId: ID; expense: Expense }
  | { type: "expense/delete"; tripId: ID; id: ID }
  | { type: "payment/add"; tripId: ID; payment: Payment }
  | { type: "payment/remove"; tripId: ID; id: ID }
  | { type: "replace"; state: Saved };

const MAX_ACTIVITY = 60;

/**
 * Every change goes through here. Balances and settlements are never stored:
 * they are recomputed from expenses and payments, so edits can't drift.
 * Each change also leaves a line in the trip's activity history.
 */
export function reducer(state: Saved, a: Action): Saved {
  const log = (t: Trip, entry: Omit<Activity, "id" | "at">): Trip => ({
    ...t,
    updatedAt: Date.now(),
    activity: [{ id: uid("a-"), at: Date.now(), ...entry }, ...(t.activity ?? [])].slice(0, MAX_ACTIVITY),
  });
  const mapTrip = (id: ID, fn: (t: Trip) => Trip): Saved => ({ trips: state.trips.map((t) => (t.id === id ? fn(t) : t)) });
  const pair = (t: Trip, from: ID, to: ID) => {
    const n = (id: ID) => t.participants.find((p) => p.id === id)?.name ?? "?";
    return `${n(from)} → ${n(to)}`;
  };

  switch (a.type) {
    case "replace":
      return a.state;
    case "trip/save": {
      const exists = state.trips.some((t) => t.id === a.trip.id);
      return exists
        ? mapTrip(a.trip.id, () => log(a.trip, { kind: "trip", title: a.trip.name }))
        : { trips: [{ ...a.trip, updatedAt: Date.now() }, ...state.trips] };
    }
    case "trip/delete":
      return { trips: state.trips.filter((t) => t.id !== a.id) };
    case "expense/save":
      return mapTrip(a.tripId, (t) => {
        const exists = t.expenses.some((e) => e.id === a.expense.id);
        const next = {
          ...t,
          expenses: exists ? t.expenses.map((e) => (e.id === a.expense.id ? a.expense : e)) : [...t.expenses, a.expense],
        };
        return log(next, { kind: exists ? "edit" : "add", title: a.expense.title, amount: a.expense.amount });
      });
    case "expense/delete":
      return mapTrip(a.tripId, (t) => {
        const gone = t.expenses.find((e) => e.id === a.id);
        const next = { ...t, expenses: t.expenses.filter((e) => e.id !== a.id) };
        return gone ? log(next, { kind: "delete", title: gone.title, amount: gone.amount }) : next;
      });
    case "payment/add":
      return mapTrip(a.tripId, (t) =>
        t.payments.some((p) => p.id === a.payment.id)
          ? t
          : log({ ...t, payments: [...t.payments, a.payment] }, { kind: "paid", title: pair(t, a.payment.from, a.payment.to), amount: a.payment.amount }),
      );
    case "payment/remove":
      return mapTrip(a.tripId, (t) => {
        const p = t.payments.find((x) => x.id === a.id);
        const next = { ...t, payments: t.payments.filter((x) => x.id !== a.id) };
        return p ? log(next, { kind: "undo", title: pair(t, p.from, p.to), amount: p.amount }) : next;
      });
  }
}

interface Store {
  trips: Trip[];
  getTrip: (id: ID) => Trip | undefined;
  dispatch: (a: Action) => void;
  loadFailed: boolean;
  startFresh: () => void;
  saveFailed: boolean;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(loadState, []);
  const [loadFailed, setLoadFailed] = useState(!initial.ok);
  const [state, dispatch] = useReducer(reducer, initial.ok ? initial.state : { trips: [] });
  const [saveFailed, setSaveFailed] = useState(false);
  // Never overwrite unreadable saved data until the person chooses to start fresh.
  const canSave = useRef(initial.ok);

  useEffect(() => {
    if (canSave.current) setSaveFailed(!saveState(state));
  }, [state]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const r = loadState();
      if (r.ok) dispatch({ type: "replace", state: r.state });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const startFresh = useCallback(() => {
    canSave.current = true;
    setLoadFailed(false);
    dispatch({ type: "replace", state: { trips: [sampleTrip()] } });
  }, []);

  const getTrip = useCallback((id: ID) => state.trips.find((t) => t.id === id), [state.trips]);
  const value = useMemo(
    () => ({ trips: state.trips, getTrip, dispatch, loadFailed, startFresh, saveFailed }),
    [state.trips, getTrip, loadFailed, startFresh, saveFailed],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}
