import { lazy, Suspense } from "react";
import { Redirect, match, safeNext, useLocation } from "./state/router";
import { useSession } from "./state/session";
import { Mascot } from "./ui/Mascot";
import { AppShell } from "./pages/app/Shell";
import { Landing } from "./pages/landing/Landing";
import { CompleteProfile, ForgotPassword, Login, Register, ResetPassword, Welcome } from "./pages/auth/Auth";
import { NotFound } from "./pages/NotFound";

const JoinTrip = lazy(() => import("./pages/app/JoinTrip").then((m) => ({ default: m.JoinTrip })));

function Splash() {
  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }} aria-busy="true">
      <Mascot mood="happy" size={110} title="Yüklənir" />
    </div>
  );
}

/** Keep the place the person wanted to reach, e.g. an invite link, across sign-in. */
const withNext = (to: string, next: string) => `${to}?next=${encodeURIComponent(next)}`;

export function App() {
  const { path, query } = useLocation();
  const { ready, session, profile } = useSession();
  const full = path + (query.toString() ? `?${query}` : "");

  if (path === "/") return <Landing />;
  if (!ready) return <Splash />;

  const signedIn = !!session;
  const complete = !!profile?.completed;

  // Auth pages: a signed-in person goes straight on.
  if (["/xos-gelmisiniz", "/qeydiyyat", "/daxil-ol", "/sifreni-unutmusunuz"].includes(path)) {
    if (signedIn) return <Redirect to={complete ? safeNext(query) : withNext("/profil-tamamla", safeNext(query))} />;
    if (path === "/xos-gelmisiniz") return <Welcome />;
    if (path === "/qeydiyyat") return <Register />;
    if (path === "/daxil-ol") return <Login />;
    return <ForgotPassword />;
  }
  if (path === "/sifre-yenile") return <ResetPassword />;
  if (path === "/profil-tamamla") {
    if (!signedIn) return <Redirect to="/daxil-ol" />;
    if (!profile) return <Splash />;
    return <CompleteProfile />;
  }

  const join = match("/qosul/:code", path);
  if (join || path.startsWith("/app")) {
    if (!signedIn) return <Redirect to={withNext("/daxil-ol", full)} />;
    if (!profile) return <Splash />;
    if (!complete) return <Redirect to={withNext("/profil-tamamla", full)} />;
    if (join)
      return (
        <Suspense fallback={<Splash />}>
          <JoinTrip code={join.code} />
        </Suspense>
      );
    return <AppShell path={path} />;
  }

  return <NotFound />;
}
