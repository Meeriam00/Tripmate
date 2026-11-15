import { useEffect, useState } from "react";

/**
 * A tiny hash router: works on any static host, and a refresh keeps you on
 * the same screen.
 *   #/                          Səfərlərim (all trips)
 *   #/yeni                      Yeni səfər
 *   #/sefer/:id                 Ümumi məlumat
 *   #/sefer/:id/xercler         Xərclər
 *   #/sefer/:id/hesablasma      Hesablaşma
 *   #/sefer/:id/duzelt          Səfəri düzəlt
 */
export type Tab = "overview" | "expenses" | "settle";
export type Route =
  | { name: "home" }
  | { name: "new" }
  | { name: "trip"; id: string; tab: Tab }
  | { name: "edit"; id: string }
  | { name: "notfound" };

const TAB_PATH: Record<Tab, string> = { overview: "", expenses: "/xercler", settle: "/hesablasma" };

export function parseHash(hash: string): Route {
  const seg = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  if (seg.length === 0) return { name: "home" };
  if (seg[0] === "yeni" && seg.length === 1) return { name: "new" };
  // "seyahet" links from the previous version of the app still work.
  if ((seg[0] === "sefer" || seg[0] === "seyahet") && seg[1] && seg.length <= 3) {
    if (!seg[2]) return { name: "trip", id: seg[1], tab: "overview" };
    if (seg[2] === "xercler") return { name: "trip", id: seg[1], tab: "expenses" };
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
      return `#/sefer/${r.id}${TAB_PATH[r.tab]}`;
    case "edit":
      return `#/sefer/${r.id}/duzelt`;
    default:
      return "#/";
  }
}

export const tripHref = (id: string, tab: Tab = "overview") => href({ name: "trip", id, tab });

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
