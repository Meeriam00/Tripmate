import { useEffect } from "react";
import { LuTriangleAlert } from "react-icons/lu";
import { Button } from "./components/ui";
import { Home } from "./screens/Home";
import { NotFound } from "./screens/NotFound";
import { TripForm } from "./screens/TripForm";
import { TripScreen } from "./screens/TripScreen";
import { useRoute } from "./state/router";
import { useStore } from "./state/store";

export function App() {
  const route = useRoute();
  const { loadFailed, startFresh, saveFailed } = useStore();
  const key = route.name === "trip" || route.name === "edit" ? `${route.name}:${route.id}` : route.name;

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [key]);

  if (loadFailed) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <LuTriangleAlert className="size-9 text-sun-2" aria-hidden />
        <h1 className="mt-4 text-[1.4rem] font-bold">Yadda saxlanmış məlumat oxuna bilmədi</h1>
        <p className="mt-2 text-ink-2">Bu brauzerdəki məlumat zədələnib. Yenidən başlasanız, köhnə məlumat silinəcək.</p>
        <Button className="mt-6" variant="dark" onClick={startFresh}>
          Yenidən başla
        </Button>
      </div>
    );
  }

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[80] focus:rounded-full focus:bg-white focus:px-4 focus:py-2">
        Məzmuna keç
      </a>
      {saveFailed && (
        <div role="alert" className="bg-owe px-4 py-2 text-center text-[0.85rem] text-white">
          Dəyişikliklər yadda saxlanıla bilmir: brauzerin yaddaşı doludur və ya bloklanıb.
        </div>
      )}
      {route.name === "home" && <Home />}
      {route.name === "new" && <TripForm />}
      {route.name === "edit" && <TripForm key={route.id} tripId={route.id} />}
      {route.name === "trip" && <TripScreen id={route.id} tab={route.tab} />}
      {route.name === "notfound" && <NotFound />}
    </>
  );
}
