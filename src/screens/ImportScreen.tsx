import { useEffect, useState } from "react";
import { TopBar } from "../components/TopBar";
import { AvatarStack, Button, LinkButton, Panel } from "../components/ui";
import { tripTotal } from "../lib/balances";
import { formatRange } from "../lib/dates";
import { formatMoney } from "../lib/money";
import { sampleTrip, SAMPLE_TRIP_ID } from "../lib/sample";
import { decodeTrip } from "../lib/share";
import { uid } from "../lib/storage";
import type { Trip } from "../lib/types";
import { navigate } from "../state/router";
import { useStore } from "../state/store";
import { useToast } from "../components/Toast";

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; trip: Trip };

export function ImportScreen({ payload }: { payload: string }) {
  const { getTrip, dispatch } = useStore();
  const toast = useToast();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (payload === "sample") {
      dispatch({ type: "trip/upsert", trip: sampleTrip() });
      navigate({ name: "trip", id: SAMPLE_TRIP_ID, tab: "overview" }, { replace: true });
      return;
    }
    let alive = true;
    decodeTrip(payload)
      .then((trip) => alive && setState({ status: "ready", trip }))
      .catch(() => alive && setState({ status: "error", message: "This link is incomplete or damaged. Ask for a fresh link." }));
    return () => {
      alive = false;
    };
  }, [payload, dispatch]);

  const existing = state.status === "ready" ? getTrip(state.trip.id) : undefined;

  function add(asCopy: boolean) {
    if (state.status !== "ready") return;
    const trip = asCopy ? { ...state.trip, id: uid("t-"), name: existing ? `${state.trip.name} (copy)` : state.trip.name } : state.trip;
    dispatch({ type: "trip/upsert", trip });
    toast.show(existing && !asCopy ? "Your copy is updated" : `Added ${trip.name} to your trips`);
    navigate({ name: "trip", id: trip.id, tab: "overview" }, { replace: true });
  }

  return (
    <>
      <TopBar />
      <main id="main" className="mx-auto max-w-lg px-4 py-16 sm:py-24">
        {state.status === "loading" && (
          <div className="flex flex-col items-center gap-4 py-16 text-ink-2" role="status">
            <span className="size-8 animate-spin rounded-full border-2 border-line border-t-forest" aria-hidden />
            Opening shared trip…
          </div>
        )}
        {state.status === "error" && (
          <Panel className="p-8 text-center">
            <h1 className="font-display text-3xl font-medium">This link didn't open</h1>
            <p className="mt-2 text-ink-2">{state.message}</p>
            <LinkButton href="#/" variant="primary" className="mt-6">
              Go to your trips
            </LinkButton>
          </Panel>
        )}
        {state.status === "ready" && (
          <Panel className="p-7 sm:p-9">
            <p className="text-[0.9rem] text-ink-2">Someone shared a trip with you</p>
            <h1 className="mt-1 font-display text-[2.4rem] leading-tight font-medium tracking-[-0.02em]">{state.trip.name}</h1>
            <p className="mt-1 text-ink-2">
              {[state.trip.destination, formatRange(state.trip.startDate, state.trip.endDate)].filter(Boolean).join(", ")}
            </p>
            <div className="mt-6 flex items-center gap-3">
              <AvatarStack people={state.trip.participants} size={32} />
              <span className="text-[0.9rem] text-ink-2">
                {state.trip.expenses.length} expenses, {formatMoney(tripTotal(state.trip), state.trip.currency)}
              </span>
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              {existing ? (
                <>
                  <Button variant="primary" onClick={() => add(false)}>
                    Replace my copy
                  </Button>
                  <Button onClick={() => add(true)}>Keep both</Button>
                </>
              ) : (
                <Button variant="primary" size="lg" onClick={() => add(false)}>
                  Add to my trips
                </Button>
              )}
            </div>
            {existing && <p className="mt-3 text-[0.84rem] text-ink-3">You already have this trip. Replacing it swaps in the shared version.</p>}
          </Panel>
        )}
      </main>
    </>
  );
}
