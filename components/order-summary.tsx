import { num } from "@/lib/format";
import type { OrderSummary as Summary } from "@/lib/queries";

export function OrderSummary({ summary, view }: { summary: Summary; view: "packa" | "skickade" }) {
  const average = summary.order_count > 0
    ? (summary.total_qty / summary.order_count).toLocaleString("sv-SE", { minimumFractionDigits: 1, maximumFractionDigits: 2 })
    : "–";

  return (
    <aside data-order-summary className="rounded-xl border border-line bg-surface p-4 xl:sticky xl:top-6" aria-labelledby="order-summary-title">
      <h2 id="order-summary-title" className="text-[15px] font-semibold">
        {view === "packa" ? "Att packa – summering" : "Skickade – summering"}
      </h2>
      <p className="mt-1 text-[12px] text-muted">Alla {num(summary.order_count)} beställningar i vyn, oavsett filter.</p>
      <h3 className="mb-2 mt-5 text-[12px] font-medium text-muted">Kortlekar per produktversion</h3>
      <dl className="space-y-3 text-[13px]">
        {([
          ["Upptäck Skåne", summary.skane],
          ["Upptäck Göteborg", summary.goteborg],
          ["Upptäck Stockholm", summary.stockholm],
        ] as const).map(([label, quantity]) => (
          <div key={label} className="flex items-baseline justify-between gap-3">
            <dt>{label}</dt><dd className="tabular whitespace-nowrap font-medium">{num(quantity)} st</dd>
          </div>
        ))}
        <div className="flex justify-between gap-3 border-t border-line pt-3 font-semibold">
          <dt>Totalt kortlekar</dt><dd className="tabular">{num(summary.total_qty)} st</dd>
        </div>
      </dl>
      <div className="mt-5 border-t border-line pt-4">
        {view === "packa" ? (
          <>
            <h3 className="mb-3 text-[12px] font-medium text-muted">Beställningar efter antal kortlekar</h3>
            <dl className="space-y-3 text-[13px]">
              <div className="flex justify-between gap-3"><dt>1 kortlek</dt><dd className="tabular font-medium">{num(summary.single_count)} st</dd></div>
              <div className="flex justify-between gap-3"><dt>2 eller fler kortlekar</dt><dd className="tabular font-medium">{num(summary.multiple_count)} st</dd></div>
            </dl>
          </>
        ) : (
          <dl className="text-[13px]">
            <dt className="text-muted">Kortlekar per beställning i snitt</dt>
            <dd className="mt-1 text-[24px] font-semibold tabular">{average}</dd>
          </dl>
        )}
      </div>
    </aside>
  );
}
