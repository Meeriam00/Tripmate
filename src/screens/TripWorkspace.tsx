import { useCallback, useState, type ReactNode } from "react";
import { LuDownload, LuEllipsis, LuLayoutGrid, LuList, LuPlus, LuScale, LuSettings2, LuShare2, LuSparkles } from "react-icons/lu";
import { useToast } from "../components/Toast";
import { TopBar } from "../components/TopBar";
import { AvatarStack, Button, Dialog, IconButton, LinkButton, cx } from "../components/ui";
import { downloadText, slug, tripToCSV } from "../lib/csv";
import { formatRange } from "../lib/dates";
import { shareUrl } from "../lib/share";
import type { Expense, Trip } from "../lib/types";
import { href, type TripTab } from "../state/router";
import { useStore } from "../state/store";
import { ExpenseSheet } from "./ExpenseSheet";
import { ExpensesTab } from "./ExpensesTab";
import { OverviewTab } from "./OverviewTab";
import { SettleTab } from "./SettleTab";
import { SummaryTab } from "./SummaryTab";

export interface WorkspaceApi {
  trip: Trip;
  openExpense: (e?: Expense) => void;
  deleteExpense: (e: Expense) => void;
}

const TABS: { tab: TripTab; label: string; icon: typeof LuList }[] = [
  { tab: "overview", label: "Overview", icon: LuLayoutGrid },
  { tab: "expenses", label: "Expenses", icon: LuList },
  { tab: "settle", label: "Settle up", icon: LuScale },
  { tab: "summary", label: "Summary", icon: LuSparkles },
];

export function TripWorkspace({ id, tab }: { id: string; tab: TripTab }) {
  const { getTrip, dispatch } = useStore();
  const toast = useToast();
  const trip = getTrip(id);
  const [sheet, setSheet] = useState<{ open: boolean; expense?: Expense }>({ open: false });
  const [menu, setMenu] = useState(false);
  const [share, setShare] = useState<{ open: boolean; url?: string; error?: string }>({ open: false });

  const openExpense = useCallback((e?: Expense) => setSheet({ open: true, expense: e }), []);
  const deleteExpense = useCallback(
    (e: Expense) => {
      if (!trip) return;
      dispatch({ type: "expense/delete", tripId: trip.id, id: e.id });
      setSheet({ open: false });
      toast.show(`Deleted "${e.title}". Balances updated.`, {
        tone: "info",
        action: { label: "Undo", run: () => dispatch({ type: "expense/restore", tripId: trip.id, expense: e }) },
      });
    },
    [trip, dispatch, toast],
  );

  if (!trip) {
    return (
      <>
        <TopBar />
        <main id="main" className="mx-auto max-w-xl px-6 py-24 text-center">
          <h1 className="font-display text-3xl font-medium">This trip isn't in this browser</h1>
          <p className="mt-2 text-ink-2">It may have been deleted, or it lives on another device. Ask a friend for a share link.</p>
          <LinkButton href="#/" variant="primary" className="mt-6">
            Back to your trips
          </LinkButton>
        </main>
      </>
    );
  }

  const api: WorkspaceApi = { trip, openExpense, deleteExpense };

  function exportCsv() {
    downloadText(`${slug(trip!.name)}-expenses.csv`, tripToCSV(trip!));
    toast.show("Exported expenses as CSV");
    setMenu(false);
  }

  async function openShare() {
    setMenu(false);
    setShare({ open: true });
    try {
      setShare({ open: true, url: await shareUrl(trip!) });
    } catch {
      setShare({ open: true, error: "This browser couldn't create a link. Export as CSV instead." });
    }
  }

  return (
    <>
      <TopBar />
      <header className="border-b border-line/70">
        <div className="mx-auto max-w-6xl px-4 pt-7 sm:px-6 sm:pt-10">
          <div className="flex items-start justify-between gap-x-6 gap-y-4 md:flex-wrap md:items-end">
            <div className="min-w-0">
              <p className="text-[0.9rem] text-ink-2">
                {[trip.destination, formatRange(trip.startDate, trip.endDate)].filter(Boolean).join(", ")}
              </p>
              <h1 className="mt-1 font-display text-[clamp(2.2rem,5.5vw,3.6rem)] leading-[0.98] font-medium tracking-[-0.025em] text-ink">
                {trip.name}
              </h1>
              <div className="mt-3 flex items-center gap-3">
                <AvatarStack people={trip.participants} size={30} max={8} />
                <span className="text-[0.88rem] text-ink-2">
                  {trip.participants.map((p) => p.name).join(", ")}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 md:flex">
              <Button variant="secondary" size="md" icon={<LuShare2 aria-hidden />} onClick={openShare} >
                Share
              </Button>
              <Button variant="secondary" size="md" icon={<LuDownload aria-hidden />} onClick={exportCsv}>
                Export CSV
              </Button>
              <LinkButton href={href({ name: "edit", id: trip.id })} variant="secondary" icon={<LuSettings2 aria-hidden />}>
                Settings
              </LinkButton>
              </div>
              <div className="relative md:hidden">
                <IconButton label="More actions" aria-expanded={menu} aria-haspopup="menu" onClick={() => setMenu((m) => !m)} className="ring-1 ring-line ring-inset">
                  <LuEllipsis className="size-5" aria-hidden />
                </IconButton>
                {menu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} aria-hidden />
                    <div role="menu" className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl bg-card py-1 shadow-lift ring-1 ring-line">
                      <MenuItem icon={<LuShare2 />} onClick={openShare}>Share trip link</MenuItem>
                      <MenuItem icon={<LuDownload />} onClick={exportCsv}>Export CSV</MenuItem>
                      <a role="menuitem" href={href({ name: "edit", id: trip.id })} className="flex items-center gap-3 px-4 py-2.5 text-[0.92rem] hover:bg-paper-2">
                        <LuSettings2 aria-hidden className="text-ink-3" /> Trip settings
                      </a>
                    </div>
                  </>
                )}
              </div>
              <span className="hidden md:block">
                <Button variant="primary" icon={<LuPlus aria-hidden />} onClick={() => openExpense()}>
                  Add expense
                </Button>
              </span>
            </div>
          </div>

          <nav aria-label="Trip sections" className="mt-7 -mb-px hidden gap-1 md:flex">
            {TABS.map((t) => {
              const on = t.tab === tab;
              return (
                <a
                  key={t.tab}
                  href={href({ name: "trip", id: trip.id, tab: t.tab })}
                  aria-current={on ? "page" : undefined}
                  className={cx(
                    "rounded-t-md border-b-2 px-4 pt-2 pb-3 text-[0.93rem] font-semibold transition-colors",
                    on ? "border-forest text-forest" : "border-transparent text-ink-2 hover:border-line hover:text-ink",
                  )}
                >
                  {t.label}
                </a>
              );
            })}
          </nav>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 pt-7 pb-32 sm:px-6 sm:pt-9 md:pb-20">
        {tab === "overview" && <OverviewTab {...api} />}
        {tab === "expenses" && <ExpensesTab {...api} />}
        {tab === "settle" && <SettleTab {...api} />}
        {tab === "summary" && <SummaryTab {...api} />}
      </main>

      {/* Mobile: bottom tab bar with a raised add button in the middle */}
      <nav
        aria-label="Trip sections"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <div className="grid grid-cols-5 items-end">
          {TABS.slice(0, 2).map((t) => (
            <TabLink key={t.tab} trip={trip} t={t} on={t.tab === tab} />
          ))}
          <div className="flex justify-center">
            <button
              onClick={() => openExpense()}
              aria-label="Add expense"
              className="-mt-5 mb-2 inline-flex size-14 items-center justify-center rounded-2xl bg-signal text-forest-2 shadow-lift transition-transform active:scale-95"
            >
              <LuPlus className="size-6" aria-hidden />
            </button>
          </div>
          {TABS.slice(2).map((t) => (
            <TabLink key={t.tab} trip={trip} t={t} on={t.tab === tab} />
          ))}
        </div>
      </nav>

      <ExpenseSheet
        trip={trip}
        open={sheet.open}
        expense={sheet.expense}
        onClose={() => setSheet((s) => ({ ...s, open: false }))}
        onDelete={deleteExpense}
        onSave={(e, isNew) => {
          dispatch({ type: "expense/upsert", tripId: trip.id, expense: e });
          setSheet((s) => ({ ...s, open: false }));
          toast.show(isNew ? `Added "${e.title}"` : `Saved "${e.title}". Balances updated.`);
        }}
      />

      <Dialog
        open={share.open}
        onClose={() => setShare({ open: false })}
        title="Share this trip"
        description="Anyone with the link can add a copy of the trip, with all expenses and payments, to their own browser."
        footer={
          <>
            <Button variant="ghost" onClick={() => setShare({ open: false })}>
              Done
            </Button>
            <Button
              variant="primary"
              disabled={!share.url}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(share.url!);
                  toast.show("Link copied");
                } catch {
                  toast.show("Couldn't copy. Select the link and copy it manually.", { tone: "error" });
                }
              }}
            >
              Copy link
            </Button>
          </>
        }
      >
        {share.error ? (
          <p className="text-owe">{share.error}</p>
        ) : (
          <>
            <textarea
              readOnly
              value={share.url ?? "Creating link…"}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Share link"
              rows={3}
              className="w-full resize-none rounded-lg bg-paper-2/70 p-3 font-[inherit] text-[0.8rem] break-all text-ink-2 ring-1 ring-line"
            />
            <p className="mt-3 text-[0.82rem] text-ink-3">
              The trip travels inside the link itself, so nothing is uploaded. Copies don't sync: changes made by others
              won't appear here.
            </p>
          </>
        )}
      </Dialog>
    </>
  );
}

function TabLink({ trip, t, on }: { trip: Trip; t: (typeof TABS)[number]; on: boolean }) {
  const Icon = t.icon;
  return (
    <a
      href={href({ name: "trip", id: trip.id, tab: t.tab })}
      aria-current={on ? "page" : undefined}
      className={cx("flex flex-col items-center gap-1 pt-2.5 pb-2 text-[0.7rem] font-semibold", on ? "text-forest" : "text-ink-3")}
    >
      <Icon className="size-5" aria-hidden />
      {t.label}
    </a>
  );
}

function MenuItem({ icon, onClick, children }: { icon: ReactNode; onClick: () => void; children: ReactNode }) {
  return (
    <button role="menuitem" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[0.92rem] hover:bg-paper-2">
      <span className="text-ink-3" aria-hidden>
        {icon}
      </span>
      {children}
    </button>
  );
}
