import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { EditionTag, PageHeader, cn } from "@/components/ui";
import { ColumnChart, type ColumnDatum } from "@/components/column-chart";
import {
  FINANCE_PERIODS,
  getFinance,
  getFirstOrderDate,
  resolvePeriod,
  type FinancePeriod,
} from "@/lib/finance";
import { num, shortDate, relativeDays, todayISO } from "@/lib/format";
import { orderRef, sourceLabel } from "@/lib/labels";

export const metadata = { title: "Ekonomi" };

const kr = (n: number) => `${num(Math.round(n))} kr`;
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

const MONTHS = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

function bucketLabels(start: string, bucket: "day" | "month") {
  const [y, m, d] = start.split("-").map(Number);
  if (bucket === "month") {
    return { label: `${MONTHS[m - 1]} ${y}`, tick: MONTHS[m - 1] };
  }
  return { label: `${d} ${MONTHS[m - 1]}`, tick: `${d}/${m}` };
}

export default async function EkonomiPage(props: PageProps<"/ekonomi">) {
  const sp = await props.searchParams;
  const raw = typeof sp.period === "string" ? sp.period : "30d";
  const period = (FINANCE_PERIODS.some((p) => p.value === raw) ? raw : "30d") as FinancePeriod;

  const today = todayISO();
  const first = period === "allt" ? await getFirstOrderDate() : null;
  const { from, to, bucket } = resolvePeriod(period, today, first);
  const { totals: t, series, channels, products, openInvoices } = await getFinance(from, to, bucket);

  const chart: ColumnDatum[] = series.map((b) => {
    const { label, tick } = bucketLabels(b.start, bucket);
    return {
      key: b.start,
      label,
      tickLabel: tick,
      value: b.value,
      detail: b.orders === 1 ? "1 order" : `${b.orders} ordrar`,
    };
  });

  const openTotal = openInvoices.reduce((s, i) => s + (i.value ?? 0), 0);
  const overdueTotal = openInvoices.filter((i) => i.is_overdue).reduce((s, i) => s + (i.value ?? 0), 0);

  const parts = [
    { key: "paid", label: "Betalt", value: t.paid, tone: "bg-brand" },
    { key: "open", label: "Fakturerat, väntar betalning", value: t.invoicedOpen, tone: "bg-sky-500" },
    { key: "overdue", label: "Förfallet", value: t.overdue, tone: "bg-danger" },
    { key: "not", label: "Ej fakturerat", value: t.notInvoiced, tone: "bg-line-strong" },
  ];

  return (
    <>
      <PageHeader
        title="Ekonomi"
        description={`Ordrar med orderdatum ${shortDate(from)} – ${shortDate(to)}. Belopp i kronor exkl. moms.`}
      />

      {/* Periodval */}
      <nav aria-label="Period" className="mb-6 flex flex-wrap gap-1 text-[13px]">
        {FINANCE_PERIODS.map((p) => (
          <Link
            key={p.value}
            href={p.value === "30d" ? "/ekonomi" : `/ekonomi?period=${p.value}`}
            className={cn(
              "rounded-md px-2.5 py-1",
              period === p.value ? "bg-hover font-medium text-ink" : "text-muted hover:text-ink",
            )}
          >
            {p.label}
          </Link>
        ))}
      </nav>

      {/* Huvudsiffra + uppdelning */}
      <section className="mb-10 rounded-xl border border-line p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <div>
            <div className="text-[13px] text-muted">Ordervärde</div>
            <div className="mt-1 text-[44px] font-semibold leading-none tracking-[-0.02em] text-ink sm:text-[52px]">
              {kr(t.value)}
            </div>
            <div className="mt-2 text-[13px] text-muted">
              {num(t.orders)} ordrar, {num(t.qty)} kortlekar
              {t.pricedQty > 0 && t.value > 0 ? `, snitt ${kr(t.value / t.pricedQty)} per kortlek` : ""}
            </div>
          </div>
        </div>

        {t.value > 0 ? (
          <div
            className="mt-6 flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full"
            role="img"
            aria-label={parts.map((p) => `${p.label} ${kr(p.value)}`).join(", ")}
          >
            {parts
              .filter((p) => p.value > 0)
              .map((p) => (
                <div key={p.key} className={p.tone} style={{ width: `${(p.value / t.value) * 100}%` }} />
              ))}
          </div>
        ) : null}

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          {parts.map((p) => (
            <div key={p.key}>
              <dt className="flex items-center gap-1.5 text-[12px] text-muted">
                <span className={cn("size-2 shrink-0 rounded-full", p.tone)} aria-hidden />
                {p.key === "overdue" && p.value > 0 ? <AlertTriangle className="size-3.5 text-danger" aria-hidden /> : null}
                {p.label}
              </dt>
              <dd className={cn("mt-1 text-[18px] font-semibold", p.key === "overdue" && p.value > 0 ? "text-danger" : "text-ink")}>
                {kr(p.value)}
              </dd>
              <dd className="text-[12px] text-subtle">{pct(p.value, t.value)} %</dd>
            </div>
          ))}
        </dl>

        {t.missingPrice > 0 ? (
          <p className="mt-5 rounded-md bg-warn-soft px-3 py-2 text-[12px] text-warn">
            {t.missingPrice === 1 ? "1 order saknar" : `${t.missingPrice} ordrar saknar`} à-pris och räknas inte i
            värdet. Lägg in priset under Redigera på ordern.
          </p>
        ) : null}
      </section>

      {/* Diagram */}
      <section className="mb-12">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="text-[15px] font-semibold">Ordervärde per {bucket === "day" ? "dag" : "månad"}</h2>
        </div>
        <ColumnChart data={chart} />
        <details className="mt-4 text-[13px]">
          <summary className="cursor-pointer text-muted hover:text-ink">Visa som tabell</summary>
          <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-line">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-canvas text-left text-[12px] text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">{bucket === "day" ? "Dag" : "Månad"}</th>
                  <th className="px-4 py-2 text-right font-medium">Ordrar</th>
                  <th className="px-4 py-2 text-right font-medium">Ordervärde</th>
                </tr>
              </thead>
              <tbody>
                {chart.map((c, i) => (
                  <tr key={c.key} className="border-t border-line">
                    <td className="px-4 py-1.5">{c.label}</td>
                    <td className="px-4 py-1.5 text-right tabular">{series[i].orders}</td>
                    <td className="px-4 py-1.5 text-right tabular">{kr(c.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <div className="mb-12 grid grid-cols-1 gap-10 lg:grid-cols-2">
        {/* Per kanal */}
        <section>
          <h2 className="mb-3 text-[15px] font-semibold">Per kanal</h2>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full whitespace-nowrap text-[13px]">
              <thead className="bg-canvas text-left text-[12px] text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Kanal</th>
                  <th className="px-4 py-2 text-right font-medium">Ordrar</th>
                  <th className="px-4 py-2 text-right font-medium">Kortlekar</th>
                  <th className="px-4 py-2 text-right font-medium">Värde</th>
                  <th className="px-4 py-2 text-right font-medium">Andel</th>
                </tr>
              </thead>
              <tbody>
                {channels.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-4 text-center text-muted">
                      Inga ordrar i perioden
                    </td>
                  </tr>
                ) : (
                  channels.map((c) => (
                    <tr key={c.source} className="border-t border-line">
                      <td className="px-4 py-2.5">{sourceLabel[c.source]}</td>
                      <td className="px-4 py-2.5 text-right tabular">{c.orders}</td>
                      <td className="px-4 py-2.5 text-right tabular">{num(c.qty)}</td>
                      <td className="px-4 py-2.5 text-right font-medium tabular">{kr(c.value)}</td>
                      <td className="px-4 py-2.5 text-right tabular text-muted">{pct(c.value, t.value)} %</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Per kortlek */}
        <section>
          <h2 className="mb-3 text-[15px] font-semibold">Per kortlek</h2>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full whitespace-nowrap text-[13px]">
              <thead className="bg-canvas text-left text-[12px] text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Kortlek</th>
                  <th className="px-4 py-2 text-right font-medium">Sålda</th>
                  <th className="px-4 py-2 text-right font-medium">Värde</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.product_id} className="border-t border-line">
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2">
                        {p.region} <EditionTag edition={p.edition} />
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular">{num(p.qty)}</td>
                    <td className="px-4 py-2.5 text-right tabular">{kr(p.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Obetalda fakturor */}
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-semibold">Obetalda fakturor</h2>
          <span className="text-[13px] text-muted">
            Alla just nu, oavsett period: <b className="font-medium text-ink">{kr(openTotal)}</b>
            {overdueTotal > 0 ? (
              <>
                , varav <b className="font-medium text-danger">{kr(overdueTotal)} förfallet</b>
              </>
            ) : null}
          </span>
        </div>
        {openInvoices.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-4 text-[13px] text-muted">
            Inga obetalda fakturor.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[560px] whitespace-nowrap text-[13px]">
              <thead className="bg-canvas text-left text-[12px] text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Order</th>
                  <th className="px-4 py-2 font-medium">Kund</th>
                  <th className="px-4 py-2 font-medium">Faktura</th>
                  <th className="px-4 py-2 font-medium">Förfaller</th>
                  <th className="px-4 py-2 text-right font-medium">Belopp</th>
                </tr>
              </thead>
              <tbody>
                {openInvoices.map((inv) => (
                  <tr key={inv.order_number} className="relative border-t border-line hover:bg-canvas">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/ordrar/${inv.order_number}`}
                        prefetch={false}
                        className="font-medium text-ink after:absolute after:inset-0"
                      >
                        {orderRef(inv.order_number)}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">{inv.customer_name ?? "–"}</td>
                    <td className="px-4 py-2.5 text-muted">{inv.invoice_number ?? "–"}</td>
                    <td className={cn("px-4 py-2.5", inv.is_overdue ? "font-medium text-danger" : "text-muted")}>
                      {inv.invoice_due_date ? (
                        <>
                          {shortDate(inv.invoice_due_date)}
                          <span className="ml-1.5 text-[12px] font-normal">
                            ({inv.is_overdue ? `förföll ${relativeDays(inv.invoice_due_date)}` : relativeDays(inv.invoice_due_date)})
                          </span>
                        </>
                      ) : (
                        "–"
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular">
                      {inv.value === null ? <span className="text-subtle">Saknar pris</span> : kr(inv.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
