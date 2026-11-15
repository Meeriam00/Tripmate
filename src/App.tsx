import { useEffect } from "react";
import { LuArrowLeft, LuTriangleAlert } from "react-icons/lu";
import { Page, SiteHeader, TripLayout } from "./components/Layout";
import { Button, Panel } from "./components/ui";
import { ExpensesPage } from "./screens/ExpensesPage";
import { HomePage } from "./screens/HomePage";
import { NotFound } from "./screens/NotFound";
import { OverviewTab } from "./screens/OverviewTab";
import { PrintReport } from "./screens/PrintReport";
import { SettlePage } from "./screens/SettlePage";
import { TripForm } from "./screens/TripForm";
import { href, tripHref, useRoute } from "./state/router";
import { useStore } from "./state/store";

export function App() {
  const route = useRoute();
  const { getTrip, loadFailed, startFresh, saveFailed } = useStore();
  const key = route.name === "trip" ? `${route.id}/${route.tab}` : route.name === "edit" ? `e/${route.id}` : route.name;

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
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[80] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 print:hidden">
        Məzmuna keç
      </a>
      {saveFailed && (
        <div role="alert" className="bg-owe px-4 py-2 text-center text-[0.85rem] text-white print:hidden">
          Dəyişikliklər yadda saxlanıla bilmir: brauzerin yaddaşı doludur və ya bloklanıb.
        </div>
      )}
      <Screen route={route} getTrip={getTrip} />
    </>
  );
}

function Screen({ route, getTrip }: { route: ReturnType<typeof useRoute>; getTrip: ReturnType<typeof useStore>["getTrip"] }) {
  if (route.name === "home") return <HomePage />;

  if (route.name === "new")
    return (
      <>
        <SiteHeader cta={false} />
        <Page narrow>
          <FormHeader back={href({ name: "home" })} backLabel="Səfərlərim" title="Yeni səfər" sub="Ad, tarixlər və dostlar. Büdcəni indi və ya sonra təyin edə bilərsiniz." />
          <Panel>
            <TripForm cancelHref={href({ name: "home" })} />
          </Panel>
        </Page>
      </>
    );

  const trip = route.name === "trip" || route.name === "edit" ? getTrip(route.id) : undefined;
  if (route.name === "notfound" || !trip)
    return (
      <>
        <SiteHeader />
        <Page narrow>
          <NotFound what={route.name === "notfound" ? "page" : "trip"} />
        </Page>
      </>
    );

  if (route.name === "edit")
    return (
      <>
        <SiteHeader />
        <Page narrow>
          <FormHeader back={tripHref(trip.id)} backLabel={trip.name} title="Səfəri düzəlt" sub="Məlumatlar, tarixlər, büdcə və iştirakçılar" />
          <Panel>
            <TripForm key={trip.id} existing={trip} cancelHref={tripHref(trip.id)} />
          </Panel>
        </Page>
      </>
    );

  return (
    <>
      <TripLayout trip={trip} tab={route.tab}>
        {route.tab === "overview" && <OverviewTab trip={trip} />}
        {route.tab === "expenses" && <ExpensesPage trip={trip} />}
        {route.tab === "settle" && <SettlePage trip={trip} />}
      </TripLayout>
      <PrintReport trip={trip} />
    </>
  );
}

function FormHeader({ back, backLabel, title, sub }: { back: string; backLabel: string; title: string; sub: string }) {
  return (
    <div className="mb-7">
      <a href={back} className="inline-flex items-center gap-1.5 rounded text-[0.88rem] font-medium text-ink-2 hover:text-ink">
        <LuArrowLeft className="size-4" aria-hidden /> {backLabel}
      </a>
      <h1 className="mt-4 text-[clamp(1.8rem,3.5vw,2.6rem)] font-bold tracking-[-0.025em]">{title}</h1>
      <p className="mt-1.5 text-ink-2">{sub}</p>
    </div>
  );
}
