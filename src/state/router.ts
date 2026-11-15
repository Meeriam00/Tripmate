import { useEffect, useState } from "react";

/**
 * Tiny hash router. Hash routing means the app works from any static host
 * (Vercel, a file server, GitHub Pages) with no rewrite rules, and deep
 * links survive a refresh.
 */
export type Route =
  | { name: "home" }
  | { name: "new" }
  | { name: "trip"; id: string; tab: TripTab }
  | { name: "edit"; id: string }
  | { name: "import"; payload: string }
  | { name: "notfound" };

export type TripTab = "overview" | "expenses" | "settle" | "summary";
const TABS: TripTab[] = ["overview", "expenses", "settle", "summary"];

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, "").split("?")[0];
  const seg = path.split("/").filter(Boolean).map(decodeURIComponent);
  if (seg.length === 0) return { name: "home" };
  if (seg[0] === "new" && seg.length === 1) return { name: "new" };
  if (seg[0] === "import" && seg[1]) return { name: "import", payload: path.slice("import/".length) };
  if (seg[0] === "trip" && seg[1]) {
    if (seg[2] === "edit") return { name: "edit", id: seg[1] };
    const tab = (seg[2] ?? "overview") as TripTab;
    if (TABS.includes(tab)) return { name: "trip", id: seg[1], tab };
  }
  return { name: "notfound" };
}

export function href(r: Route): string {
  switch (r.name) {
    case "home":
      return "#/";
    case "new":
      return "#/new";
    case "trip":
      return r.tab === "overview" ? `#/trip/${r.id}` : `#/trip/${r.id}/${r.tab}`;
    case "edit":
      return `#/trip/${r.id}/edit`;
    case "import":
      return `#/import/${r.payload}`;
    default:
      return "#/";
  }
}

export function navigate(r: Route, opts: { replace?: boolean } = {}) {
  const h = href(r);
  if (opts.replace) history.replaceState(null, "", h);
  else history.pushState(null, "", h);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash));
    window.addEventListener("hashchange", on);
    window.addEventListener("popstate", on);
    return () => {
      window.removeEventListener("hashchange", on);
      window.removeEventListener("popstate", on);
    };
  }, []);
  return route;
}
