import { navigate, useTitle } from "../state/router";
import { Button, Empty } from "../ui/kit";

export function NotFound({ inApp }: { inApp?: boolean }) {
  useTitle("Səhifə tapılmadı");
  return (
    <main className="page narrow" style={{ minHeight: inApp ? undefined : "100dvh", display: "grid", placeItems: "center" }}>
      <Empty
        mood="shocked"
        color="peach"
        size={150}
        title="Bu səhifə yolda itib"
        text="Ünvan səhv yazılıb və ya səhifə artıq yoxdur. Gəlin, tanış yerə qayıdaq."
        action={<Button onClick={() => navigate(inApp ? "/app" : "/")}>{inApp ? "Səfərlərim" : "Ana səhifə"}</Button>}
      />
    </main>
  );
}
