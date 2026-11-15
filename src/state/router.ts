import { useEffect, useState } from "react";

/**
 * A tiny hash router. Hash URLs work on any static host with no rewrite
 * rules, and a refresh keeps you on the same screen.
 *   #/                         home
 *   #/yeni                     new trip
 *   #/seyahet/:id              expenses
 *   #/seyahet/:id/hesablasma   settlement
 *   #/seyahet/:id/duzelt       trip settings
 */
export type Route =
  | { name: "home" }
  | { name: "new" }
  | { name: "trip"; id: string; tab: "expenses" | "settle" }
  | { name: "edit"; id: string }
  | { name: "notfound" };

export function parseHash(hash: string): Route {
  const seg = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  if (seg.length === 0) return { name: "home" };
  if (seg[0] === "yeni" && seg.length === 1) return { name: "new" };
  if (seg[0] === "seyahet" && seg[1] && seg.length <= 3) {
    if (!seg[2]) return { name: "trip", id: seg[1], tab: "expenses" };
    if (seg[2] === "hesablasma") return { name: "trip", id: seg[1], tab: "settle" };
    if (seg[2] === "duzelt") return { name: "edit", id: seg[1] };
  }
  return { name: "notfound" };
}

export function href(r: Route): string {
  switch (r.name) {
    case "new":
      return "#/yeni";
    case "trip":
      return `#/seyahet/${r.id}${r.tab === "settle" ? "/hesablasma" : ""}`;
    case "edit":
      return `#/seyahet/${r.id}/duzelt`;
    default:
      return "#/";
  }
}

export function navigate(r: Route, opts: { replace?: boolean } = {}) {
  if (opts.replace) history.replaceState(null, "", href(r));
  else history.pushState(null, "", href(r));
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
