import { LuArrowLeft, LuCompass } from "react-icons/lu";
import { AppBar, Shell } from "../components/Shell";
import { LinkButton, Tile } from "../components/ui";
import { href } from "../state/router";

export function NotFound({ what = "page" }: { what?: "page" | "trip" }) {
  return (
    <Shell
      top={
        <AppBar
          left={
            <a href={href({ name: "home" })} aria-label="Ana səhifəyə qayıt" className="inline-flex size-10 items-center justify-center rounded-full hover:bg-ink/[0.06]">
              <LuArrowLeft className="size-5" aria-hidden />
            </a>
          }
          title="TRIPMATE"
        />
      }
    >
      <div className="flex flex-col items-center px-8 py-16 text-center">
        <Tile size={64}>
          <LuCompass className="size-7" />
        </Tile>
        <h2 className="mt-5 text-[1.2rem] font-semibold">{what === "trip" ? "Səyahət tapılmadı" : "Səhifə tapılmadı"}</h2>
        <p className="mt-1.5 max-w-xs text-[0.92rem] text-ink-2">
          {what === "trip" ? "Bu səyahət bu brauzerdə yoxdur. Ola bilsin ki, silinib və ya başqa cihazda yaradılıb." : "Keçid köhnədir və ya səhv yazılıb."}
        </p>
        <LinkButton href={href({ name: "home" })} className="mt-6">
          Ana səhifəyə qayıt
        </LinkButton>
      </div>
    </Shell>
  );
}
