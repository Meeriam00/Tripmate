import { useState } from "react";
import { LuArchive, LuArchiveRestore } from "react-icons/lu";
import { backend } from "../../../backend";
import { navigate } from "../../../state/router";
import { Button, ConfirmDialog, Empty, errorText, useToast } from "../../../ui/kit";
import { TripForm } from "../TripForm";
import { useTripCtx } from "./context";

export function EditTrip() {
  const c = useTripCtx();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const { trip } = c.bundle;
  if (!c.isAdmin)
    return <Empty mood="worried" color="peach" title="Yalnız admin" text="Səfər məlumatlarını yalnız səfərin admini dəyişə bilər." action={<Button onClick={() => navigate(c.base)}>Səfərə qayıt</Button>} />;

  async function toggleArchive() {
    try {
      await backend.setArchived(trip.id, !trip.archived);
      toast.ok(trip.archived ? "Səfər arxivdən çıxarıldı." : "Səfər arxivləndi.");
      navigate(c.base);
    } catch (e) {
      toast.err(errorText(e));
    }
  }

  return (
    <div className="narrow-in">
      <h2 className="page-title">Səfəri düzəlt</h2>
      {trip.archived ? (
        <div className="alert warm" style={{ marginBottom: 16 }}>
          Arxivdəki səfəri dəyişmək üçün əvvəlcə arxivdən çıxarın.
        </div>
      ) : (
        <TripForm trip={trip} onDone={() => navigate(c.base)} />
      )}
      <section className="card flat danger-zone">
        <h3>{trip.archived ? "Arxivdən çıxar" : "Səfəri arxivlə"}</h3>
        <p className="muted small">
          {trip.archived
            ? "Səfər yenidən aktiv olacaq, xərc və ödəniş əlavə etmək mümkün olacaq."
            : "Arxivlənmiş səfər «Keçmiş səfərlər» bölməsinə keçir və yalnız baxmaq üçün açıq qalır. Bütün məlumatlar saxlanılır."}
        </p>
        <Button variant={trip.archived ? "soft" : "danger"} onClick={() => (trip.archived ? toggleArchive() : setConfirm(true))}>
          {trip.archived ? <LuArchiveRestore /> : <LuArchive />} {trip.archived ? "Arxivdən çıxar" : "Arxivlə"}
        </Button>
      </section>
      <ConfirmDialog
        open={confirm}
        title="Səfər arxivlənsin?"
        text="Arxivdən sonra yeni xərc və ödəniş əlavə etmək olmayacaq. İstədiyiniz vaxt geri qaytara bilərsiniz."
        confirmLabel="Arxivlə"
        mood="sleepy"
        onClose={() => setConfirm(false)}
        onConfirm={toggleArchive}
      />
    </div>
  );
}
