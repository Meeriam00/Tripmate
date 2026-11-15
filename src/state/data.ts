import { useCallback, useEffect, useRef, useState } from "react";
import { backend } from "../backend";
import type { AppNotification, ID, TripBundle, TripSummary } from "../lib/types";
import { errorText } from "../ui/kit";

/**
 * Load data from the backend and keep it fresh: re-fetches whenever the
 * backend reports a change (this tab, another tab, or Supabase realtime).
 */
export function useLive<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fn = useCallback(load, deps);

  const run = useCallback(
    async (quiet = false) => {
      const n = ++seq.current;
      if (!quiet) setLoading(true);
      try {
        const v = await fn();
        if (n === seq.current) {
          setData(v);
          setError(null);
        }
      } catch (e) {
        if (n === seq.current) setError(errorText(e));
      } finally {
        if (n === seq.current) setLoading(false);
      }
    },
    [fn],
  );

  useEffect(() => {
    setData(null);
    void run();
    return backend.subscribe(() => void run(true));
  }, [run]);

  return { data, error, loading, reload: () => run() };
}

export const useTrips = () => useLive<TripSummary[]>(() => backend.listTrips(), []);
export const useTrip = (id: ID) => useLive<TripBundle>(() => backend.getTrip(id), [id]);
export const useNotifications = (enabled: boolean) =>
  useLive<AppNotification[]>(() => (enabled ? backend.listNotifications() : Promise.resolve([])), [enabled]);
