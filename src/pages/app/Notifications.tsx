import { LuBell, LuCircleCheck, LuCircleX, LuReceipt, LuScale, LuSend, LuTicket, LuUserPlus } from "react-icons/lu";
import { backend } from "../../backend";
import { timeAgo } from "../../lib/dates";
import type { AppNotification, NotificationKind } from "../../lib/types";
import { useNotifications } from "../../state/data";
import { Link, navigate, useTitle } from "../../state/router";
import { Button, Empty, ErrorState, PageLoading, errorText, useToast } from "../../ui/kit";

const ICON: Record<NotificationKind, [typeof LuBell, string]> = {
  expense_added: [LuReceipt, "lav"],
  trip_invite: [LuTicket, "lav"],
  member_joined: [LuUserPlus, "mint"],
  balance_updated: [LuScale, ""],
  payment_sent: [LuSend, "warm"],
  payment_confirmed: [LuCircleCheck, "mint"],
  payment_rejected: [LuCircleX, "rose"],
};

export function Notifications() {
  useTitle("Bildirişlər");
  const toast = useToast();
  const { data, error, loading, reload } = useNotifications(true);
  const unread = data?.filter((n) => !n.read).length ?? 0;

  async function open(n: AppNotification) {
    if (!n.read) await backend.markNotificationsRead([n.id]).catch(() => {});
    navigate(n.link);
  }

  return (
    <main className="page narrow">
      <div className="page-head">
        <div>
          <Link to="/app" className="back-link">
            ← Səfərlərim
          </Link>
          <h1 className="page-title">Bildirişlər</h1>
          <p className="muted">{unread ? `${unread} oxunmamış` : "Hamısı oxunub"}</p>
        </div>
        {unread > 0 && (
          <Button
            variant="soft"
            size="sm"
            onClick={() =>
              backend
                .markNotificationsRead()
                .then(() => toast.ok("Hamısı oxundu kimi qeyd edildi."))
                .catch((e) => toast.err(errorText(e)))
            }
          >
            Hamısını oxu
          </Button>
        )}
      </div>
      {loading && !data ? (
        <PageLoading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data?.length ? (
        <Empty mood="sleepy" title="Sakitlikdir" text="Yeni xərclər, ödənişlər və dəvətlər burada görünəcək." />
      ) : (
        <div className="card list notif-list">
          {data.map((n) => {
            const [I, tone] = ICON[n.kind];
            return (
              <button key={n.id} className={`list-row notif ${n.read ? "" : "unread"}`} onClick={() => open(n)}>
                <span className={`act-icon ${tone}`}>
                  <I />
                </span>
                <div className="grow">
                  <div className="title wrap">{n.text}</div>
                  <div className="sub">{timeAgo(n.at)}</div>
                </div>
                {!n.read && <span className="unread-dot" aria-label="Oxunmayıb" />}
              </button>
            );
          })}
        </div>
      )}
    </main>
  );
}
