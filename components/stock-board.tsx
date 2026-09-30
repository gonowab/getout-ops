import { AlertTriangle } from "lucide-react";
import { cn, EditionTag } from "@/components/ui";
import { num } from "@/lib/format";
import type { StockLevel } from "@/lib/types";

function groupByRegion(stock: StockLevel[]) {
  const regions: string[] = [];
  for (const s of stock) if (!regions.includes(s.region)) regions.push(s.region);
  return regions.map((region) => {
    const items = stock.filter((s) => s.region === region).sort((a, b) => (a.edition === "gammal" ? -1 : 1) - (b.edition === "gammal" ? -1 : 1));
    return {
      region,
      items,
      totalt: items.reduce((a, b) => a + b.totalt, 0),
      reserverat: items.reduce((a, b) => a + b.reserverat, 0),
      tillgangligt: items.reduce((a, b) => a + b.tillgangligt, 0),
      low: items.some((i) => i.lagt_saldo),
    };
  });
}

/** Lagret i en blick: en kolumn per region, gammal och ny ask under */
export function StockBoard({ stock, detailed = false }: { stock: StockLevel[]; detailed?: boolean }) {
  const groups = groupByRegion(stock);
  const max = Math.max(1, ...stock.map((s) => s.totalt));

  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-line sm:grid-cols-3">
      {groups.map((g, i) => (
        <div
          key={g.region}
          className={cn("flex flex-col p-5", i > 0 && "border-t border-line sm:border-l sm:border-t-0")}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-medium text-ink">{g.region}</h3>
            {g.low ? (
              <span className="inline-flex items-center gap-1 text-[12px] font-medium text-warn">
                <AlertTriangle className="size-3.5" /> Lågt saldo
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-[34px] font-semibold leading-none tracking-[-0.02em] tabular text-ink">
              {num(g.tillgangligt)}
            </span>
            <span className="text-[13px] text-muted">tillgängliga</span>
          </div>
          <p className="mt-1.5 text-[12px] text-muted tabular">
            {num(g.totalt)} i lager
            {g.reserverat > 0 ? `, ${num(g.reserverat)} reserverade` : ""}
          </p>

          <div className="mt-5 flex flex-col gap-3.5">
            {g.items.map((s) => (
              <div key={s.product_id}>
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <EditionTag edition={s.edition} />
                  <span className="tabular text-ink">
                    <span className={cn("font-medium", s.lagt_saldo && "text-warn")}>{num(s.tillgangligt)}</span>
                    {detailed ? <span className="text-subtle"> / {num(s.totalt)}</span> : null}
                  </span>
                </div>
                <StockBar totalt={s.totalt} reserverat={s.reserverat} max={max} edition={s.edition} />
                {detailed ? (
                  <div className="mt-1 flex justify-between text-[11px] text-subtle tabular">
                    <span>Reserverat {num(s.reserverat)}</span>
                    <span>{s.low_stock_threshold > 0 ? `Varning under ${num(s.low_stock_threshold)}` : "Säljs slut"}</span>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StockBar({
  totalt,
  reserverat,
  max,
  edition,
}: {
  totalt: number;
  reserverat: number;
  max: number;
  edition: "gammal" | "ny";
}) {
  const avail = Math.max(0, totalt - reserverat);
  const wAvail = (avail / max) * 100;
  const wRes = (Math.min(reserverat, Math.max(totalt, 0)) / max) * 100;
  return (
    <div
      className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-canvas"
      role="img"
      aria-label={`${avail} tillgängliga, ${reserverat} reserverade`}
    >
      <div className={cn("h-full", edition === "gammal" ? "bg-old" : "bg-brand")} style={{ width: `${wAvail}%` }} />
      <div className="h-full bg-line-strong" style={{ width: `${wRes}%` }} />
    </div>
  );
}

export function StockTotals({ stock }: { stock: StockLevel[] }) {
  const t = stock.reduce(
    (a, s) => ({ totalt: a.totalt + s.totalt, reserverat: a.reserverat + s.reserverat, tillg: a.tillg + s.tillgangligt }),
    { totalt: 0, reserverat: 0, tillg: 0 },
  );
  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-2 text-[13px]">
      <div className="flex items-baseline gap-2">
        <dt className="text-muted">Totalt lager</dt>
        <dd className="font-medium tabular text-ink">{num(t.totalt)}</dd>
      </div>
      <div className="flex items-baseline gap-2">
        <dt className="text-muted">Reserverat</dt>
        <dd className="font-medium tabular text-ink">{num(t.reserverat)}</dd>
      </div>
      <div className="flex items-baseline gap-2">
        <dt className="text-muted">Tillgängligt</dt>
        <dd className="font-medium tabular text-brand-strong">{num(t.tillg)}</dd>
      </div>
    </dl>
  );
}
