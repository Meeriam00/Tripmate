import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { sampleTrip, SAMPLE_TRIP_ID } from "../lib/sample";
import { loadState, saveState, STORAGE_KEY, type PersistedState } from "../lib/storage";
import type { Expense, ID, Payment, Trip } from "../lib/types";

type Action =
  | { type: "trip/upsert"; trip: Trip }
  | { type: "trip/delete"; id: ID }
  | { type: "trip/restore"; trip: Trip; index: number }
  | { type: "expense/upsert"; tripId: ID; expense: Expense }
  | { type: "expense/delete"; tripId: ID; id: ID }
  | { type: "expense/restore"; tripId: ID; expense: Expense }
  | { type: "payment/add"; tripId: ID; payment: Payment }
  | { type: "payment/remove"; tripId: ID; id: ID }
  | { type: "trip/close"; tripId: ID; closed: boolean }
  | { type: "replace"; state: PersistedState };

function touch(t: Trip): Trip {
  return { ...t, updatedAt: Date.now() };
}

function mapTrip(state: PersistedState, id: ID, fn: (t: Trip) => Trip): PersistedState {
  return { ...state, trips: state.trips.map((t) => (t.id === id ? touch(fn(t)) : t)) };
}

/**
 * All mutations go through this reducer. Note how settling up only ever
 * appends/removes Payment records — expenses are never rewritten by it.
 */
export function reducer(state: PersistedState, a: Action): PersistedState {
  switch (a.type) {
    case "replace":
      return a.state;
    case "trip/upsert": {
      const exists = state.trips.some((t) => t.id === a.trip.id);
      return {
        ...state,
        trips: exists ? state.trips.map((t) => (t.id === a.trip.id ? touch(a.trip) : t)) : [touch(a.trip), ...state.trips],
      };
    }
    case "trip/delete":
      return { ...state, trips: state.trips.filter((t) => t.id !== a.id) };
    case "trip/restore": {
      const trips = state.trips.filter((t) => t.id !== a.trip.id);
      trips.splice(Math.min(a.index, trips.length), 0, a.trip);
      return { ...state, trips };
    }
    case "expense/upsert":
      return mapTrip(state, a.tripId, (t) => {
        const exists = t.expenses.some((e) => e.id === a.expense.id);
        return {
          ...t,
          expenses: exists ? t.expenses.map((e) => (e.id === a.expense.id ? a.expense : e)) : [...t.expenses, a.expense],
        };
      });
    case "expense/delete":
      return mapTrip(state, a.tripId, (t) => ({ ...t, expenses: t.expenses.filter((e) => e.id !== a.id) }));
    case "expense/restore":
      return mapTrip(state, a.tripId, (t) =>
        t.expenses.some((e) => e.id === a.expense.id) ? t : { ...t, expenses: [...t.expenses, a.expense] },
      );
    case "payment/add":
      return mapTrip(state, a.tripId, (t) =>
        t.payments.some((p) => p.id === a.payment.id) ? t : { ...t, payments: [...t.payments, a.payment] },
      );
    case "payment/remove":
      return mapTrip(state, a.tripId, (t) => ({ ...t, payments: t.payments.filter((p) => p.id !== a.id) }));
    case "trip/close":
      return mapTrip(state, a.tripId, (t) => ({ ...t, closedAt: a.closed ? Date.now() : undefined }));
  }
}

interface Store {
  trips: Trip[];
  getTrip: (id: ID) => Trip | undefined;
  dispatch: (a: Action) => void;
  resetSample: () => void;
  /** Set when localStorage held something unreadable. */
  loadError: string | null;
  discardCorrupt: () => void;
  saveFailed: boolean;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(loadState, []);
  const [loadError, setLoadError] = useState(initial.ok ? null : initial.error);
  const [state, dispatch] = useReducer(reducer, initial.ok ? initial.state : { version: 1, trips: [] });
  const [saveFailed, setSaveFailed] = useState(false);
  const skipSave = useRef(!initial.ok);

  useEffect(() => {
    // Never overwrite unreadable data until the user explicitly discards it.
    if (skipSave.current) return;
    setSaveFailed(!saveState(state));
  }, [state]);

  // Keep several open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const r = loadState();
      if (r.ok) dispatch({ type: "replace", state: r.state });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const getTrip = useCallback((id: ID) => state.trips.find((t) => t.id === id), [state.trips]);
  const resetSample = useCallback(() => {
    dispatch({ type: "trip/delete", id: SAMPLE_TRIP_ID });
    dispatch({ type: "trip/upsert", trip: sampleTrip() });
  }, []);
  const discardCorrupt = useCallback(() => {
    skipSave.current = false;
    setLoadError(null);
    dispatch({ type: "replace", state: { version: 1, trips: [sampleTrip()] } });
  }, []);

  const value = useMemo(
    () => ({ trips: state.trips, getTrip, dispatch, resetSample, loadError, discardCorrupt, saveFailed }),
    [state.trips, getTrip, resetSample, loadError, discardCorrupt, saveFailed],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}
