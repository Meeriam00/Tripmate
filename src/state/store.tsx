import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { sampleTrip } from "../lib/sample";
import { loadState, saveState, STORAGE_KEY, type Saved } from "../lib/storage";
import type { Expense, ID, Trip } from "../lib/types";

type Action =
  | { type: "trip/save"; trip: Trip }
  | { type: "trip/delete"; id: ID }
  | { type: "expense/save"; tripId: ID; expense: Expense }
  | { type: "expense/delete"; tripId: ID; id: ID }
  | { type: "replace"; state: Saved };

/** Every change goes through here; balances are always recomputed from the expenses. */
export function reducer(state: Saved, a: Action): Saved {
  const touch = (t: Trip): Trip => ({ ...t, updatedAt: Date.now() });
  const mapTrip = (id: ID, fn: (t: Trip) => Trip): Saved => ({
    trips: state.trips.map((t) => (t.id === id ? touch(fn(t)) : t)),
  });
  switch (a.type) {
    case "replace":
      return a.state;
    case "trip/save":
      return state.trips.some((t) => t.id === a.trip.id)
        ? { trips: state.trips.map((t) => (t.id === a.trip.id ? touch(a.trip) : t)) }
        : { trips: [touch(a.trip), ...state.trips] };
    case "trip/delete":
      return { trips: state.trips.filter((t) => t.id !== a.id) };
    case "expense/save":
      return mapTrip(a.tripId, (t) => ({
        ...t,
        expenses: t.expenses.some((e) => e.id === a.expense.id)
          ? t.expenses.map((e) => (e.id === a.expense.id ? a.expense : e))
          : [...t.expenses, a.expense],
      }));
    case "expense/delete":
      return mapTrip(a.tripId, (t) => ({ ...t, expenses: t.expenses.filter((e) => e.id !== a.id) }));
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

  const getTrip = useCallback((id: ID) => state.trips.find((t) => t.id === id), [state.trips]);
  const startFresh = useCallback(() => {
    canSave.current = true;
    setLoadFailed(false);
    dispatch({ type: "replace", state: { trips: [sampleTrip()] } });
  }, []);

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
