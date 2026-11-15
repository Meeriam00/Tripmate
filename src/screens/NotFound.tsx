import { LuCompass } from "react-icons/lu";
import { LinkButton, Panel, Tile } from "../components/ui";
import { href } from "../state/router";

export function NotFound({ what = "page" }: { what?: "page" | "trip" }) {
  return (
    <Panel>
      <div className="flex flex-col items-center px-8 py-20 text-center">
        <Tile size={64}>
          <LuCompass className="size-7" />
        </Tile>
        <h1 className="mt-5 text-[1.25rem] font-semibold">{what === "trip" ? "Səfər tapılmadı" : "Səhifə tapılmadı"}</h1>
        <p className="mt-1.5 max-w-xs text-[0.92rem] text-ink-2">{what === "trip" ? "Bu səfər bu brauzerdə yoxdur. Ola bilsin ki, silinib və ya başqa cihazda yaradılıb." : "Keçid köhnədir və ya səhv yazılıb."}</p>
        <LinkButton href={href({ name: "home" })} className="mt-6">
          Səfərlərimə qayıt
        </LinkButton>
      </div>
    </Panel>
  );
}
