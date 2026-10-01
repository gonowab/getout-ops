import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn, EditionTag } from "@/components/ui";
import { StockBoard, StockTotals } from "@/components/stock-board";
import { getDashboardCounts, getOrderLinesFor, getProducts, getStock, getTodayWork } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { num, relativeDays, shortDate } from "@/lib/format";
import { orderRef, sourceLabel } from "@/lib/labels";
import { ProductChips } from "@/components/order-table";
import type { OrderLine, OrderRow, Product } from "@/lib/types";

export const metadata = { title: "Översikt" };

export default async function OverviewPage() {
  const [user, counts, stock, work, products] = await Promise.all([
    getCurrentUser(),
    getDashboardCounts(),
    getStock(),
    getTodayWork(),
    getProducts(),
  ]);
  const allIds = [...work.toPack, ...work.newOrders].map((o) => o.id);
  const lines = await getOrderLinesFor(allIds);
  const low = stock.filter((s) => s.lagt_saldo);

  const today = new Date().toLocaleDateString("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Stockholm",
  });
  const hour = Number(new Date().toLocaleTimeString("sv-SE", { hour: "2-digit", timeZone: "Europe/Stockholm" }));
  const greeting = hour < 10 ? "God morgon" : hour < 18 ? "Hej" : "God kväll";
  const firstName = user?.name.split(" ")[0];

  const stats = [
    { label: "Nya ordrar", value: counts.nya, href: "/ordrar?vy=hantera" },
    { label: "Att packa", value: counts.attPacka, href: "/ordrar?vy=packa" },
    { label: "Skickade", value: counts.skickade, href: "/ordrar?vy=skickade" },
    { label: "Ska faktureras", value: counts.skaFaktureras, href: "/ordrar?vy=faktura" },
    { label: "Väntar betalning", value: counts.vantarBetalning, href: "/ordrar?vy=faktura" },
    { label: "Förfallna fakturor", value: counts.forfallna, href: "/ordrar?vy=faktura", alert: counts.forfallna > 0 },
  ];

  const nothingToDo =
    work.toPack.length + work.newOrders.length + work.toInvoice.length + work.overdue.length + low.length === 0;

  return (
    <>
      <div className="pb-8">
        <h1 className="text-[22px] font-semibold tracking-[-0.01em]">
          {greeting}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-1 text-[13px] text-muted first-letter:uppercase">{today}</p>
      </div>

      <div className="mb-10 grid grid-cols-2 overflow-hidden rounded-xl border border-line sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s, i) => (
          <Link
            key={s.label}
            href={s.href}
            className={cn(
              "group flex flex-col gap-1 border-line px-4 py-4 transition-colors hover:bg-canvas",
              i % 2 === 1 && "border-l",
              i >= 2 && "border-t sm:border-t-0",
              "sm:border-l sm:first:border-l-0 sm:[&:nth-child(4)]:border-l-0 sm:[&:nth-child(n+4)]:border-t lg:[&:nth-child(4)]:border-l lg:[&:nth-child(n+4)]:border-t-0",
            )}
          >
            <span className={cn("text-[26px] font-semibold leading-none tabular", s.alert ? "text-danger" : "text-ink")}>
              {s.value}
            </span>
            <span className="text-[12px] text-muted group-hover:text-ink">{s.label}</span>
          </Link>
        ))}
      </div>

      <section className="mb-12">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-semibold">Lager</h2>
          <div className="flex items-center gap-6">
            <StockTotals stock={stock} />
            <Link href="/lager" className="text-[13px] text-muted hover:text-ink">
              Historik
            </Link>
          </div>
        </div>
        <StockBoard stock={stock} />
      </section>

      <section>
        <h2 className="mb-4 text-[15px] font-semibold">Att göra idag</h2>
        {nothingToDo ? (
          <div className="flex items-center gap-2 rounded-xl border border-line px-5 py-6 text-[14px] text-ink">
            <CheckCircle2 className="size-5 text-brand" /> Allt är gjort. Inga ordrar att packa eller fakturor att jaga.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-2">
            <WorkList
              title="Packa och skicka"
              empty="Inget att packa."
              orders={work.toPack}
              lines={lines}
              products={products}
              meta={(o) => (o.status === "bekraftad" ? "Bekräftad" : "Ska packas")}
              more={counts.attPacka > work.toPack.length ? { href: "/ordrar?vy=packa", n: counts.attPacka } : undefined}
            />
            <WorkList
              title="Nya ordrar att bekräfta"
              empty="Inga nya ordrar."
              orders={work.newOrders}
              lines={lines}
              products={products}
              meta={(o) => sourceLabel[o.source]}
              more={counts.nya > work.newOrders.length ? { href: "/ordrar", n: counts.nya } : undefined}
            />
            <WorkList
              title="Skickat men inte fakturerat"
              empty="Allt skickat är fakturerat."
              orders={work.toInvoice}
              meta={(o) => `${num(o.total_qty)} st, skickad ${shortDate(o.shipped_at)}`}
            />
            <WorkList
              title="Förfallna fakturor"
              empty="Inga förfallna fakturor."
              tone="danger"
              orders={work.overdue}
              meta={(o) =>
                `Faktura ${o.invoice_number ?? "–"}, förföll ${relativeDays(o.invoice_due_date)}`
              }
            />
            {low.length > 0 ? (
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-warn">
                  <AlertTriangle className="size-4" /> Lågt lagersaldo
                </h3>
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {low.map((s) => (
                    <li key={s.product_id} className="flex items-center justify-between px-4 py-2.5 text-[13px]">
                      <span className="flex items-center gap-2">
                        {s.region} <EditionTag edition={s.edition} />
                      </span>
                      <span className="tabular">
                        <b className="font-medium text-warn">{num(s.tillgangligt)}</b>
                        <span className="text-muted"> kvar, gräns {num(s.low_stock_threshold)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </>
  );
}

function WorkList({
  title,
  empty,
  orders,
  lines,
  products,
  meta,
  more,
  tone,
}: {
  title: string;
  empty: string;
  orders: OrderRow[];
  lines?: Map<string, OrderLine[]>;
  products?: Product[];
  meta: (o: OrderRow) => string;
  more?: { href: string; n: number };
  tone?: "danger";
}) {
  return (
    <div>
      <h3 className={cn("mb-2 flex items-baseline justify-between text-[13px] font-semibold", tone === "danger" && orders.length > 0 && "text-danger")}>
        <span>
          {title} <span className="font-normal text-subtle tabular">{orders.length > 0 ? (more?.n ?? orders.length) : ""}</span>
        </span>
        {more ? (
          <Link href={more.href} className="text-[12px] font-normal text-muted hover:text-ink">
            Visa alla {more.n}
          </Link>
        ) : null}
      </h3>
      {orders.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-3 text-[13px] text-subtle">{empty}</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {orders.map((o) => (
            <li key={o.id} className="relative px-4 py-2.5 hover:bg-canvas">
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <Link href={`/ordrar/${o.order_number}`} prefetch={false} className="flex min-w-0 items-baseline gap-2 after:absolute after:inset-0">
                  <span className="shrink-0 font-medium tabular text-ink">{orderRef(o.order_number)}</span>
                  <span className="truncate text-ink">{o.customer_name}</span>
                </Link>
                <span className="shrink-0 text-[12px] text-muted tabular">{relativeDays(o.order_date)}</span>
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-3 text-[12px] text-muted">
                {lines && products ? (
                  <ProductChips lines={lines.get(o.id) ?? []} products={products} />
                ) : (
                  <span>{meta(o)}</span>
                )}
                {lines && products ? <span className="shrink-0">{meta(o)}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
