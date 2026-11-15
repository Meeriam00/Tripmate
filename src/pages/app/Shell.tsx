import { lazy, Suspense } from "react";
import { LuBell } from "react-icons/lu";
import { isDemo } from "../../backend";
import { useNotifications } from "../../state/data";
import { Link, match } from "../../state/router";
import { useSession } from "../../state/session";
import { Avatar, Logo, PageLoading } from "../../ui/kit";
import { NotFound } from "../NotFound";
import { Trips } from "./Trips";

const TripPage = lazy(() => import("./trip/TripPage").then((m) => ({ default: m.TripPage })));
const TripFormPage = lazy(() => import("./TripForm").then((m) => ({ default: m.TripFormPage })));
const Notifications = lazy(() => import("./Notifications").then((m) => ({ default: m.Notifications })));
const Settings = lazy(() => import("./Settings").then((m) => ({ default: m.Settings })));

export function TopBar() {
  const { profile } = useSession();
  const { data } = useNotifications(!!profile);
  const unread = data?.filter((n) => !n.read).length ?? 0;
  const name = profile ? [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.email : "";
  return (
    <header className="topbar">
      <div className="topbar-in">
        <Link to="/app" aria-label="Səfərlərim">
          <Logo size={32} />
        </Link>
        <div className="topbar-right">
          {isDemo && (
            <span className="badge warm demo-badge" title="Məlumatlar yalnız bu brauzerdə saxlanılır">
              Demo rejimi
            </span>
          )}
          <Link to="/app/bildirisler" className="icon-btn" aria-label={unread ? `Bildirişlər, ${unread} oxunmamış` : "Bildirişlər"}>
            <LuBell />
            {unread > 0 && <span className="dot-badge">{unread > 9 ? "9+" : unread}</span>}
          </Link>
          <Link to="/app/profil" aria-label="Profil və ayarlar" className="topbar-avatar">
            <Avatar name={name || "?"} src={profile?.avatar} size={42} />
          </Link>
        </div>
      </div>
    </header>
  );
}

export function AppShell({ path }: { path: string }) {
  const trip = match("/app/sefer/:id/*", path) ?? match("/app/sefer/:id", path);
  let page;
  if (path === "/app") page = <Trips />;
  else if (path === "/app/yeni") page = <TripFormPage />;
  else if (path === "/app/bildirisler") page = <Notifications />;
  else if (path === "/app/profil") page = <Settings />;
  else if (trip) page = <TripPage id={trip.id} rest={trip["*"] ?? ""} />;
  else page = <NotFound inApp />;

  return (
    <div className={`app ${trip ? "has-bottom-nav" : ""}`}>
      <TopBar />
      <Suspense
        fallback={
          <main className="page">
            <PageLoading />
          </main>
        }
      >
        {page}
      </Suspense>
    </div>
  );
}
