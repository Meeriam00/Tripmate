import { useEffect } from "react";
import { LuTriangleAlert } from "react-icons/lu";
import { Button, LinkButton } from "./components/ui";
import { ImportScreen } from "./screens/ImportScreen";
import { Landing } from "./screens/Landing";
import { TripForm } from "./screens/TripForm";
import { TripWorkspace } from "./screens/TripWorkspace";
import { downloadText } from "./lib/csv";
import { useRoute } from "./state/router";
import { useStore } from "./state/store";
import { TopBar } from "./components/TopBar";

export function App() {
  const route = useRoute();
  const { loadError, discardCorrupt, saveFailed } = useStore();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route.name, route.name === "trip" ? route.id : ""]);

  if (loadError) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
        <LuTriangleAlert className="size-8 text-owe" aria-hidden />
        <h1 className="mt-4 font-display text-3xl font-medium">Your saved trips couldn't be read</h1>
        <p className="mt-3 text-ink-2">
          The data stored in this browser is damaged or from an incompatible version ({loadError}). Nothing has been changed
          yet. Download a copy first if you want to keep it, then start fresh.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            onClick={() => downloadText("tripmate-backup.json", localStorage.getItem("tripmate:v1") ?? "", "application/json")}
          >
            Download raw data
          </Button>
          <Button variant="primary" onClick={discardCorrupt}>
            Start fresh
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[80] focus:rounded-md focus:bg-card focus:px-3 focus:py-2">
        Skip to content
      </a>
      {saveFailed && (
        <div role="alert" className="bg-owe px-4 py-2 text-center text-[0.85rem] text-white">
          Changes can't be saved: this browser's storage is full or blocked. Export your trip as CSV to keep a copy.
        </div>
      )}
      {route.name === "home" && <Landing />}
      {route.name === "new" && <TripForm />}
      {route.name === "edit" && <TripForm tripId={route.id} />}
      {route.name === "trip" && <TripWorkspace id={route.id} tab={route.tab} />}
      {route.name === "import" && <ImportScreen payload={route.payload} />}
      {route.name === "notfound" && <NotFound />}
    </>
  );
}

function NotFound() {
  return (
    <>
      <TopBar />
      <main id="main" className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-4xl font-medium">This page took a wrong turn</h1>
        <p className="mt-3 text-ink-2">The link may be old or mistyped.</p>
        <LinkButton href="#/" variant="primary" className="mt-8">
          Back to your trips
        </LinkButton>
      </main>
    </>
  );
}
