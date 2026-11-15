import { categoryTotals, computeBalances, settlement, tripTotal } from "../lib/balances";
import { CATEGORY } from "../lib/categories";
import { formatDay, formatRange, tripDays } from "../lib/dates";
import { formatMoney } from "../lib/money";
import { insights } from "../lib/report";
import type { Trip } from "../lib/types";

/**
 * The trip's final financial summary, laid out for paper. Hidden on screen;
 * "PDF hesabat" opens the browser's print dialog, where it can be saved as PDF.
 */
export function PrintReport({ trip }: { trip: Trip }) {
  const cur = trip.currency;
  const total = tripTotal(trip);
  const balances = computeBalances(trip);
  const pending = settlement(trip);
  const name = (id: string) => trip.participants.find((p) => p.id === id)?.name ?? "Silinmiş şəxs";
  const th = "border-b-2 border-ink py-1.5 text-left font-semibold";
  const td = "border-b border-[#ddd] py-1.5";
  return (
    <div className="hidden text-[10.5pt] leading-snug text-ink print:block">
      <div className="flex items-end justify-between border-b-4 border-sun pb-3">
        <div>
          <p className="text-[22pt] font-extrabold tracking-tight text-sun-2">TRIPMATE</p>
          <h1 className="text-[16pt] font-bold">{trip.name}</h1>
          <p>{[trip.destination, formatRange(trip.startDate, trip.endDate), `${tripDays(trip.startDate, trip.endDate)} gün`, `${trip.participants.length} nəfər`].filter(Boolean).join(", ")}</p>
        </div>
        <div className="text-right">
          <p>Ümumi xərc</p>
          <p className="text-[16pt] font-bold">{formatMoney(total, cur)}</p>
          {trip.budget && <p>Büdcə: {formatMoney(trip.budget, cur)}</p>}
        </div>
      </div>

      <h2 className="mt-5 mb-1.5 text-[12pt] font-bold">Kim kimə ödəyir</h2>
      {pending.length + trip.payments.length === 0 ? (
        <p>Hamı hesablaşıb.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={th}>Ödəyən</th>
              <th className={th}>Alan</th>
              <th className={`${th} text-right`}>Məbləğ</th>
              <th className={`${th} pl-6`}>Vəziyyət</th>
            </tr>
          </thead>
          <tbody>
            {pending.map((t) => (
              <tr key={`p${t.from}${t.to}`}>
                <td className={td}>{name(t.from)}</td>
                <td className={td}>{name(t.to)}</td>
                <td className={`${td} text-right font-semibold`}>{formatMoney(t.amount, cur)}</td>
                <td className={`${td} pl-6`}>Ödənilməyib</td>
              </tr>
            ))}
            {trip.payments.map((p) => (
              <tr key={p.id}>
                <td className={td}>{name(p.from)}</td>
                <td className={td}>{name(p.to)}</td>
                <td className={`${td} text-right`}>{formatMoney(p.amount, cur)}</td>
                <td className={`${td} pl-6`}>Ödənilib</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="mt-5 mb-1.5 text-[12pt] font-bold">Balanslar</h2>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={th}>Ad</th>
            <th className={`${th} text-right`}>Ödədi</th>
            <th className={`${th} text-right`}>Payı</th>
            <th className={`${th} text-right`}>Balans</th>
          </tr>
        </thead>
        <tbody>
          {trip.participants.map((p) => {
            const b = balances.get(p.id)!;
            return (
              <tr key={p.id}>
                <td className={td}>{p.name}</td>
                <td className={`${td} text-right`}>{formatMoney(b.paid, cur)}</td>
                <td className={`${td} text-right`}>{formatMoney(b.share, cur)}</td>
                <td className={`${td} text-right font-semibold`}>{formatMoney(b.net, cur, { signed: true })}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-5 grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-1.5 text-[12pt] font-bold">Kateqoriyalar üzrə</h2>
          <table className="w-full border-collapse">
            <tbody>
              {categoryTotals(trip).map((c) => (
                <tr key={c.category}>
                  <td className={td}>{CATEGORY[c.category].label}</td>
                  <td className={`${td} text-right`}>{Math.round((c.amount / total) * 100)}%</td>
                  <td className={`${td} text-right`}>{formatMoney(c.amount, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h2 className="mb-1.5 text-[12pt] font-bold">Xülasə</h2>
          <ul className="list-disc space-y-1 pl-4">
            {insights(trip).map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      </div>

      <h2 className="mt-5 mb-1.5 text-[12pt] font-bold">Bütün xərclər</h2>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={th}>Tarix</th>
            <th className={th}>Xərc</th>
            <th className={th}>Kateqoriya</th>
            <th className={th}>Ödəyən</th>
            <th className={th}>Bölgü</th>
            <th className={`${th} text-right`}>Məbləğ</th>
          </tr>
        </thead>
        <tbody>
          {[...trip.expenses]
            .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
            .map((e) => (
              <tr key={e.id}>
                <td className={td}>{formatDay(e.date)}</td>
                <td className={td}>{e.title}</td>
                <td className={td}>{CATEGORY[e.category].label}</td>
                <td className={td}>{name(e.paidBy)}</td>
                <td className={td}>
                  {e.participantIds.length === trip.participants.length ? "Hamı" : `${e.participantIds.length} nəfər`}
                  {e.custom ? ", fərdi" : ""}
                </td>
                <td className={`${td} text-right`}>{formatMoney(e.amount, cur)}</td>
              </tr>
            ))}
        </tbody>
      </table>
      <p className="mt-6 text-[8.5pt] text-ink-2">TRIPMATE ilə hazırlanıb. Məbləğlər qəpiyə qədər dəqiq hesablanıb.</p>
    </div>
  );
}
