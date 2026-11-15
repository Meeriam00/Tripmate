import { LuCopy, LuShare2 } from "react-icons/lu";
import type { Trip } from "../../../lib/types";
import { Button, useToast } from "../../../ui/kit";

export function inviteLink(code: string) {
  return `${window.location.origin}/qosul/${code}`;
}

/** The trip's invitation: a short code and a link, ready to copy or share. */
export function InviteCard({ trip }: { trip: Pick<Trip, "inviteCode" | "name"> }) {
  const toast = useToast();
  const link = inviteLink(trip.inviteCode);
  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.ok(`${what} kopyalandı.`);
    } catch {
      toast.err("Kopyalamaq olmadı. Əl ilə seçib kopyalayın.");
    }
  }
  const canShare = typeof navigator !== "undefined" && "share" in navigator;
  return (
    <div className="invite">
      <div className="invite-code">
        <span className="faint small">Dəvət kodu</span>
        <button type="button" className="code num" onClick={() => copy(trip.inviteCode, "Kod")} aria-label={`Dəvət kodu ${trip.inviteCode}, kopyala`}>
          {trip.inviteCode.split("").map((c, i) => (
            <span key={i}>{c}</span>
          ))}
        </button>
      </div>
      <div className="invite-link">
        <input className="input" readOnly value={link} aria-label="Dəvət linki" onFocus={(e) => e.target.select()} />
      </div>
      <div className="invite-actions">
        <Button variant="soft" onClick={() => copy(link, "Link")}>
          <LuCopy /> Linki kopyala
        </Button>
        {canShare && (
          <Button
            variant="soft"
            onClick={() =>
              navigator.share({ title: "TRIPMATE", text: `«${trip.name}» səfərinə qoşul! Kod: ${trip.inviteCode}`, url: link }).catch(() => {})
            }
          >
            <LuShare2 /> Paylaş
          </Button>
        )}
      </div>
    </div>
  );
}
