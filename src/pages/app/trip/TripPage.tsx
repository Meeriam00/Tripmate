import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  LuArchive,
  LuArrowLeft,
  LuCalendar,
  LuChartPie,
  LuHandCoins,
  LuHouse,
  LuMapPin,
  LuPlus,
  LuReceipt,
  LuSettings,
  LuUserPlus,
  LuUsers,
} from "react-icons/lu";
import { formatRange, tripDays } from "../../../lib/dates";
import { computeBalances, settlementPlan, tripTotal } from "../../../lib/ledger";
import { formatMoney } from "../../../lib/money";
import type { Expense, ID } from "../../../lib/types";
import { useTrip } from "../../../state/data";
import { Link, navigate, useTitle } from "../../../state/router";
import { useSession } from "../../../state/session";
import { AvatarStack, Button, Empty, ErrorState, PageLoading, Sheet } from "../../../ui/kit";
import { TripCover } from "../../../ui/TripCover";
import { TripContext, type TripCtx } from "./context";
import { InviteCard } from "./InviteCard";
import { Overview } from "./Overview";

const Expenses = lazy(() => import("./Expenses").then((m) => ({ default: m.Expenses })));
const Settle = lazy(() => import("./Settle").then((m) => ({ default: m.Settle })));
const Members = lazy(() => import("./Members").then((m) => ({ default: m.Members })));
const Insights = lazy(() => import("./Insights").then((m) => ({ default: m.Insights })));
const ActivityPage = lazy(() => import("./ActivityPage").then((m) => ({ default: m.ActivityPage })));
const EditTrip = lazy(() => import("./EditTrip").then((m) => ({ default: m.EditTrip })));
const ExpenseForm = lazy(() => import("./ExpenseForm").then((m) => ({ default: m.ExpenseForm })));

const TABS = [
  { key: "", label: "Ümumi", icon: LuHouse },
  { key: "xercler", label: "Xərclər", icon: LuReceipt },
  { key: "hesablasma", label: "Hesablaşma", icon: LuHandCoins },
  { key: "istirakcilar", label: "İştirakçılar", icon: LuUsers },
  { key: "statistika", label: "Statistika", icon: LuChartPie },
] as const;

export function TripPage({ id, rest }: { id: ID; rest: string }) {
  const { session } = useSession();
  const { data: bundle, error, loading, reload } = useTrip(id);
  const [form, setForm] = useState<{ open: boolean; expense?: Expense }>({ open: false });
  const [inviteOpen, setInviteOpen] = useState(false);
  const section = rest.split("/")[0] ?? "";
  useTitle(bundle?.trip.name ?? "Səfər");

  useEffect(() => {
    document.body.classList.add("has-bottom-nav");
    return () => document.body.classList.remove("has-bottom-nav");
  }, []);

  const openExpense = useCallback((e?: Expense) => setForm({ open: true, expense: e }), []);

  const ctx = useMemo<TripCtx | null>(() => {
    if (!bundle || !session) return null;
    const me = bundle.members.find((m) => m.userId === session.userId && m.status === "active");
    if (!me) return null;
    const balances = computeBalances(bundle.members, bundle.expenses, bundle.payments);
    const byId = new Map(bundle.members.map((m) => [m.id, m]));
    const isAdmin = me.role === "admin";
    return {
      bundle,
      me,
      isAdmin,
      readOnly: bundle.trip.archived,
      balances,
      plan: settlementPlan(bundle),
      total: tripTotal(bundle.expenses),
      member: (mid) => byId.get(mid),
      nameOf: (mid) => (mid === me.id ? "Sən" : (byId.get(mid)?.name.split(" ")[0] ?? "—")),
      money: (minor, opts) => formatMoney(minor, bundle.trip.currency, opts),
      openExpense,
      canEdit: (e) => !bundle.trip.archived && (isAdmin || e.createdBy === me.id),
      base: `/app/sefer/${bundle.trip.id}`,
    };
  }, [bundle, session, openExpense]);

  if (loading && !bundle)
    return (
      <main className="page">
        <PageLoading />
      </main>
    );
  if (error || !bundle)
    return (
      <main className="page">
        <ErrorState message={error ?? "Səfər tapılmadı."} onRetry={reload} />
        <div style={{ textAlign: "center" }}>
          <Link className="link" to="/app">
            Səfərlərimə qayıt
          </Link>
        </div>
      </main>
    );
  if (!ctx)
    return (
      <main className="page">
        <Empty mood="worried" color="peach" title="Bu səfərdə deyilsən" text="Səfərə qoşulmaq üçün dostundan dəvət linki istə." action={<Button onClick={() => navigate("/app")}>Səfərlərim</Button>} />
      </main>
    );

  const { trip } = bundle;
  const active = bundle.members.filter((m) => m.status === "active");

  let page;
  switch (section) {
    case "":
      page = <Overview />;
      break;
    case "xercler":
      page = <Expenses detailId={rest.split("/")[1]} />;
      break;
    case "hesablasma":
      page = <Settle />;
      break;
    case "istirakcilar":
      page = <Members onInvite={() => setInviteOpen(true)} />;
      break;
    case "statistika":
      page = <Insights />;
      break;
    case "tarixce":
      page = <ActivityPage />;
      break;
    case "duzelt":
      page = <EditTrip />;
      break;
    default:
      page = <Empty mood="shocked" title="Səhifə tapılmadı" action={<Button onClick={() => navigate(ctx.base)}>Səfərə qayıt</Button>} />;
  }

  return (
    <TripContext.Provider value={ctx}>
      <div className="trip-head">
        <div className="trip-head-bg" aria-hidden>
          <TripCover src={trip.cover} destination={trip.destination} />
        </div>
        <div className="trip-head-in">
          <Link to="/app" className="back-link light">
            <LuArrowLeft /> Səfərlərim
          </Link>
          <div className="trip-head-row">
            <div className="trip-head-text">
              <h1>{trip.name}</h1>
              <div className="meta">
                <span>
                  <LuMapPin /> {trip.destination}
                </span>
                <span>
                  <LuCalendar /> {formatRange(trip.startDate, trip.endDate)} · {tripDays(trip.startDate, trip.endDate)} gün
                </span>
              </div>
            </div>
            <div className="trip-head-people">
              <Link to={`${ctx.base}/istirakcilar`} aria-label="İştirakçılar">
                <AvatarStack people={active} size={36} max={5} />
              </Link>
              {!ctx.readOnly && (
                <Button variant="soft" size="sm" onClick={() => setInviteOpen(true)}>
                  <LuUserPlus /> Dəvət et
                </Button>
              )}
              {ctx.isAdmin && (
                <Link to={`${ctx.base}/duzelt`} className="icon-btn" aria-label="Səfəri düzəlt və ya arxivlə">
                  <LuSettings />
                </Link>
              )}
            </div>
          </div>
          {trip.archived && (
            <div className="alert warm" style={{ marginTop: 12 }}>
              <LuArchive /> Bu səfər arxivdədir — yalnız baxmaq mümkündür.
            </div>
          )}
        </div>
        <nav className="trip-tabs" aria-label="Səfər bölmələri">
          {TABS.map((t) => (
            <Link key={t.key} to={t.key ? `${ctx.base}/${t.key}` : ctx.base} className={section === t.key ? "on" : ""} aria-current={section === t.key ? "page" : undefined}>
              {t.label}
            </Link>
          ))}
          {!ctx.readOnly && (
            <Button size="sm" className="tabs-add" onClick={() => openExpense()}>
              <LuPlus /> Xərc əlavə et
            </Button>
          )}
        </nav>
      </div>

      <main className="page trip-page">
        <Suspense fallback={<PageLoading />}>{page}</Suspense>
      </main>

      <nav className="bottom-nav" aria-label="Səfər bölmələri">
        {TABS.slice(0, 2).map((t) => (
          <Link key={t.key} to={t.key ? `${ctx.base}/${t.key}` : ctx.base} className={section === t.key ? "on" : ""} aria-current={section === t.key ? "page" : undefined}>
            <t.icon />
            <span>{t.label}</span>
          </Link>
        ))}
        <button className="fab" onClick={() => openExpense()} aria-label="Xərc əlavə et" disabled={ctx.readOnly}>
          <LuPlus />
        </button>
        {[TABS[2], TABS[4]].map((t) => (
          <Link key={t.key} to={`${ctx.base}/${t.key}`} className={section === t.key ? "on" : ""} aria-current={section === t.key ? "page" : undefined}>
            <t.icon />
            <span>{t.key === "hesablasma" ? "Borclar" : t.label}</span>
          </Link>
        ))}
      </nav>

      {form.open && (
        <Suspense fallback={null}>
          <ExpenseForm expense={form.expense} onClose={() => setForm({ open: false })} />
        </Suspense>
      )}
      <Sheet open={inviteOpen} onClose={() => setInviteOpen(false)} title="Dostlarını dəvət et">
        <p className="muted" style={{ marginBottom: 16 }}>
          Linki göndər. Dostun qoşulanda siyahıdakı yerini seçə və ya yeni iştirakçı kimi qoşula bilər.
        </p>
        <InviteCard trip={trip} />
      </Sheet>
    </TripContext.Provider>
  );
}
