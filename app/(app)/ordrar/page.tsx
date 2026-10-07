import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { EmptyState, Input, PageHeader, cn } from "@/components/ui";
import { OrderTable } from "@/components/order-table";
import { NewOrderButton } from "./new-order-button";
import { PostnordBatch } from "@/components/postnord-batch";
import { postnordBookingStatus } from "@/lib/postnord";
import { getOrderLinesFor, getOrders, getProducts, type OrderFilter } from "@/lib/queries";
import { sql } from "@/lib/db";

export const metadata = { title: "Ordrar" };

const VIEWS: { value: NonNullable<OrderFilter["view"]>; label: string; hint: string }[] = [
  { value: "hantera", label: "Att hantera", hint: "Nya, bekräftade och ordrar som ska packas" },
  { value: "packa", label: "Att packa", hint: "Äldst först. Markera som skickad när paketet har lämnats." },
  { value: "skickade", label: "Skickade", hint: "Skickade och levererade ordrar" },
  { value: "faktura", label: "Fakturering", hint: "Ska faktureras, väntar betalning eller har förfallit" },
  { value: "alla", label: "Alla", hint: "Alla ordrar, nyast först" },
];

const SOURCES = [
  { value: "", label: "Alla kanaler" },
  { value: "foretag", label: "Företag" },
  { value: "aterforsaljare", label: "Återförsäljare" },
  { value: "shopify", label: "Shopify" },
  { value: "annat", label: "Annat" },
];

export default async function OrdrarPage(props: PageProps<"/ordrar">) {
  const sp = await props.searchParams;
  const viewParam = typeof sp.vy === "string" ? sp.vy : "hantera";
  const view = (VIEWS.find((v) => v.value === viewParam)?.value ?? "hantera") as OrderFilter["view"];
  const source = typeof sp.kanal === "string" ? sp.kanal : "";
  const q = typeof sp.q === "string" ? sp.q : "";

  const [orders, products, [counts]] = await Promise.all([
    getOrders({ view, source: source || undefined, q: q || undefined }),
    getProducts(),
    sql<{ hantera: number; packa: number; skickade: number; faktura: number; alla: number }[]>`
      select
        count(*) filter (where status in ('ny','bekraftad','ska_packas'))::int as hantera,
        count(*) filter (where status in ('bekraftad','ska_packas'))::int as packa,
        count(*) filter (where status in ('skickad','levererad'))::int as skickade,
        count(*) filter (where status <> 'makulerad' and source <> 'shopify' and (is_overdue or invoice_status = 'fakturerad'
          or (invoice_status = 'ej_fakturerad' and status in ('skickad','levererad','avslutad'))))::int as faktura,
        count(*)::int as alla
      from orders_overview`,
  ]);
  const lines = await getOrderLinesFor(orders.map((o) => o.id));

  // Att packa: ordrar som kan bokas hos PostNord, och dagens bokningar (för utskrift av etiketter)
  const toBook =
    view === "packa"
      ? orders
          // Webbshoppens ordrar – företags- och återförsäljarordrar är för stora för Home Small
          .filter((o) => o.source === "shopify" && !o.postnord_booked_at && !o.tracking_number)
          .map((o) => ({
            id: o.id,
            orderNumber: o.order_number,
            name: o.ship_name ?? o.contact_name ?? o.customer_name ?? "–",
            city: o.ship_city,
            qty: o.total_qty,
            ready: Boolean(o.ship_address && o.ship_postal_code && o.ship_city && (o.ship_name || o.contact_name)),
          }))
      : [];
  const bookedToday =
    view === "packa"
      ? (
          await sql<{ order_number: number }[]>`
            select order_number from orders
            where postnord_booked_at >= (date_trunc('day', now() at time zone 'Europe/Stockholm') at time zone 'Europe/Stockholm')
            order by order_number`
        ).map((r) => r.order_number)
      : [];
  const current = VIEWS.find((v) => v.value === view)!;

  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    const next = { vy: view ?? "hantera", kanal: source, q, ...patch };
    for (const [k, v] of Object.entries(next)) if (v && !(k === "vy" && v === "hantera")) p.set(k, v);
    const s = p.toString();
    return s ? `/ordrar?${s}` : "/ordrar";
  };

  return (
    <>
      <PageHeader title="Ordrar" description={current.hint} actions={<NewOrderButton />} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line">
        <nav className="-mb-px flex gap-4 overflow-x-auto text-[13px]">
          {VIEWS.map((v) => (
            <Link
              key={v.value}
              href={href({ vy: v.value })}
              className={cn(
                "whitespace-nowrap border-b-2 pb-2.5 pt-1",
                view === v.value ? "border-ink font-medium text-ink" : "border-transparent text-muted hover:text-ink",
              )}
            >
              {v.label} <span className="text-subtle tabular">{counts[v.value]}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 text-[13px]">
          {SOURCES.map((s) => (
            <Link
              key={s.value}
              href={href({ kanal: s.value })}
              className={cn(
                "rounded-md px-2.5 py-1",
                source === s.value ? "bg-hover font-medium text-ink" : "text-muted hover:text-ink",
              )}
            >
              {s.label}
            </Link>
          ))}
        </div>
        <form className="relative w-full sm:w-72">
          {view !== "hantera" ? <input type="hidden" name="vy" value={view} /> : null}
          {source ? <input type="hidden" name="kanal" value={source} /> : null}
          <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-subtle" />
          <Input name="q" defaultValue={q} placeholder="Sök kund, ordernummer, faktura" className="pl-8" />
        </form>
      </div>

      {view === "packa" ? (
        <PostnordBatch rows={toBook} bookedToday={bookedToday} bookingBlocked={postnordBookingStatus()} />
      ) : null}

      {orders.length === 0 ? (
        <EmptyState title={q ? `Inga ordrar matchar ”${q}”` : "Inget här just nu"}>
          {q ? (
            "Prova ett annat sökord eller vyn Alla."
          ) : (
            <span className="inline-flex items-center gap-1">
              Tryck <Plus className="size-3.5" /> Ny order eller N för att lägga in en order.
            </span>
          )}
        </EmptyState>
      ) : (
        <OrderTable
          orders={orders}
          lines={lines}
          products={products}
          quickAction={view === "hantera" || view === "packa" || view === "skickade"}
        />
      )}
    </>
  );
}
