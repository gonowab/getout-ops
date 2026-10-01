import "server-only";
import { sql } from "@/lib/db";
import type { OrderSource } from "@/lib/types";

/*
 * Ekonomi: allt räknas på orderradernas à-pris × antal (kronor exkl. moms),
 * för ordrar vars orderdatum ligger i perioden. Makulerade ordrar räknas aldrig.
 * Ordrar utan à-pris räknas i antal men inte i värde – de redovisas separat.
 */

export type FinancePeriod = "7d" | "30d" | "manad" | "ar" | "allt";

export const FINANCE_PERIODS: { value: FinancePeriod; label: string }[] = [
  { value: "7d", label: "7 dagar" },
  { value: "30d", label: "30 dagar" },
  { value: "manad", label: "Denna månad" },
  { value: "ar", label: "I år" },
  { value: "allt", label: "Allt" },
];

export type FinanceTotals = {
  orders: number;
  qty: number;
  pricedQty: number;
  value: number;
  paid: number;
  invoicedOpen: number;
  overdue: number;
  notInvoiced: number;
  missingPrice: number;
};

export type FinanceBucket = { start: string; value: number; orders: number };

export type ChannelRow = { source: OrderSource; orders: number; qty: number; value: number };
export type ProductRow = { product_id: number; region: string; edition: "gammal" | "ny"; qty: number; value: number };
export type OpenInvoice = {
  order_number: number;
  customer_name: string | null;
  invoice_number: string | null;
  invoice_due_date: string | null;
  is_overdue: boolean;
  value: number | null;
};

/** Periodens första och sista dag (Stockholmstid) samt diagrammets indelning */
export function resolvePeriod(period: FinancePeriod, today: string, firstOrderDate: string | null) {
  const d = (iso: string, days: number) => {
    const x = new Date(`${iso}T12:00:00Z`);
    x.setUTCDate(x.getUTCDate() + days);
    return x.toISOString().slice(0, 10);
  };
  switch (period) {
    case "7d":
      return { from: d(today, -6), to: today, bucket: "day" as const };
    case "30d":
      return { from: d(today, -29), to: today, bucket: "day" as const };
    case "manad":
      return { from: `${today.slice(0, 7)}-01`, to: today, bucket: "day" as const };
    case "ar":
      return { from: `${today.slice(0, 4)}-01-01`, to: today, bucket: "month" as const };
    case "allt": {
      const from = firstOrderDate && firstOrderDate < today ? firstOrderDate : today;
      return { from, to: today, bucket: "month" as const };
    }
  }
}

export async function getFirstOrderDate() {
  const [row] = await sql<{ first: string | null }[]>`
    select min(order_date) as first from orders where status <> 'makulerad'`;
  return row?.first ?? null;
}

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

export async function getFinance(from: string, to: string, bucket: "day" | "month") {
  // Ett värde per order, återanvänds av alla delfrågor
  const perOrder = sql`
    select o.id, o.source, o.order_date, o.invoice_status, o.is_overdue,
           sum(l.quantity) as qty,
           sum(l.quantity * l.unit_price) as value,
           bool_or(l.unit_price is null) as missing_price
    from orders_overview o
    join order_lines l on l.order_id = o.id
    where o.status <> 'makulerad'
      and o.order_date between ${from}::date and ${to}::date
    group by o.id, o.source, o.order_date, o.invoice_status, o.is_overdue`;

  const step = bucket === "day" ? sql`'1 day'::interval` : sql`'1 month'::interval`;
  const trunc = bucket === "day" ? sql`'day'` : sql`'month'`;

  const [[t], series, channels, products, open] = await Promise.all([
    sql<Record<string, unknown>[]>`
      with p as (${perOrder})
      select count(*) as orders,
             coalesce(sum(qty), 0) as qty,
             coalesce(sum(qty) filter (where not missing_price), 0) as priced_qty,
             coalesce(sum(value), 0) as value,
             coalesce(sum(value) filter (where invoice_status = 'betald'), 0) as paid,
             coalesce(sum(value) filter (where invoice_status = 'fakturerad' and not is_overdue), 0) as invoiced_open,
             coalesce(sum(value) filter (where invoice_status = 'fakturerad' and is_overdue), 0) as overdue,
             coalesce(sum(value) filter (where invoice_status = 'ej_fakturerad'), 0) as not_invoiced,
             count(*) filter (where missing_price) as missing_price
      from p`,
    sql<{ start: string; value: string; orders: string }[]>`
      with p as (${perOrder}),
      b as (
        select gs::date as start
        from generate_series(date_trunc(${trunc}, ${from}::date), ${to}::date, ${step}) gs
      )
      select b.start::text as start,
             coalesce(sum(p.value), 0) as value,
             count(p.id) as orders
      from b
      left join p on date_trunc(${trunc}, p.order_date)::date = b.start
      group by b.start order by b.start`,
    sql<{ source: OrderSource; orders: string; qty: string; value: string }[]>`
      with p as (${perOrder})
      select source, count(*) as orders, coalesce(sum(qty), 0) as qty, coalesce(sum(value), 0) as value
      from p group by source order by coalesce(sum(value), 0) desc, count(*) desc`,
    sql<{ product_id: number; region: string; edition: "gammal" | "ny"; qty: string; value: string }[]>`
      select pr.id as product_id, pr.region, pr.edition,
             coalesce(sum(l.quantity), 0) as qty,
             coalesce(sum(l.quantity * l.unit_price), 0) as value
      from products pr
      left join order_lines l on l.product_id = pr.id
        and l.order_id in (
          select id from orders
          where status <> 'makulerad' and order_date between ${from}::date and ${to}::date)
      where pr.active
      group by pr.id, pr.region, pr.edition, pr.sort_order
      order by pr.sort_order`,
    // Obetalda fakturor just nu – oavsett period, eftersom de ska följas upp
    sql<{ order_number: number; customer_name: string | null; invoice_number: string | null;
          invoice_due_date: string | null; is_overdue: boolean; value: string | null }[]>`
      select o.order_number, o.customer_name, o.invoice_number, o.invoice_due_date, o.is_overdue,
             (select sum(quantity * unit_price) from order_lines where order_id = o.id) as value
      from orders_overview o
      where o.invoice_status = 'fakturerad' and o.status <> 'makulerad'
      order by o.invoice_due_date nulls last, o.order_number`,
  ]);

  const totals: FinanceTotals = {
    orders: num(t.orders),
    qty: num(t.qty),
    pricedQty: num(t.priced_qty),
    value: num(t.value),
    paid: num(t.paid),
    invoicedOpen: num(t.invoiced_open),
    overdue: num(t.overdue),
    notInvoiced: num(t.not_invoiced),
    missingPrice: num(t.missing_price),
  };

  return {
    totals,
    series: series.map((r) => ({ start: r.start, value: num(r.value), orders: num(r.orders) })) as FinanceBucket[],
    channels: channels.map((r) => ({ source: r.source, orders: num(r.orders), qty: num(r.qty), value: num(r.value) })) as ChannelRow[],
    products: products.map((r) => ({ ...r, qty: num(r.qty), value: num(r.value) })) as ProductRow[],
    openInvoices: open.map((r) => ({ ...r, value: r.value === null ? null : num(r.value) })) as OpenInvoice[],
  };
}
