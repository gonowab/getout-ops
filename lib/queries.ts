import "server-only";
import { sql } from "@/lib/db";
import type {
  Customer,
  Movement,
  OrderEvent,
  OrderLine,
  OrderRow,
  OrderStatus,
  Product,
  StockLevel,
} from "@/lib/types";

export async function getProducts() {
  return sql<Product[]>`
    select id, sku, name, region, edition, sort_order, low_stock_threshold
    from products where active order by sort_order`;
}

export async function getStock() {
  return sql<StockLevel[]>`
    select product_id, product_id as id, sku, name, region, edition, sort_order, low_stock_threshold,
           totalt, reserverat, tillgangligt, lagt_saldo
    from stock_levels order by sort_order`;
}

export async function getDashboardCounts() {
  const [row] = await sql`select * from dashboard_counts`;
  return {
    nya: Number(row.nya),
    attPacka: Number(row.att_packa),
    skickade: Number(row.skickade),
    vantarBetalning: Number(row.vantar_betalning),
    forfallna: Number(row.forfallna),
    skaFaktureras: Number(row.ska_faktureras),
  };
}

export type OrderFilter = {
  view?: "hantera" | "packa" | "skickade" | "faktura" | "alla";
  source?: string;
  q?: string;
  customerId?: string;
};

export async function getOrders(f: OrderFilter = {}) {
  const view = f.view ?? "hantera";
  const q = f.q?.trim();
  const viewWhere = {
    hantera: sql`status in ('ny', 'bekraftad', 'ska_packas')`,
    packa: sql`status in ('bekraftad', 'ska_packas')`,
    skickade: sql`status in ('skickad', 'levererad')`,
    faktura: sql`status <> 'makulerad' and source <> 'shopify'
                 and (is_overdue or invoice_status = 'fakturerad'
                      or (invoice_status = 'ej_fakturerad' and status in ('skickad','levererad','avslutad')))`,
    alla: sql`true`,
  }[view];

  return sql<OrderRow[]>`
    select * from orders_overview
    where ${viewWhere}
      ${f.source ? sql`and source = ${f.source}` : sql``}
      ${f.customerId ? sql`and customer_id = ${f.customerId}` : sql``}
      ${
        q
          ? sql`and (
              customer_name ilike ${"%" + q + "%"}
              or contact_name ilike ${"%" + q + "%"}
              or contact_email ilike ${"%" + q + "%"}
              or ('GO-' || order_number) ilike ${"%" + q + "%"}
              or order_number::text = ${q.replace(/\D/g, "") || "-1"}
              or shopify_order_name ilike ${"%" + q + "%"}
              or invoice_number ilike ${"%" + q + "%"}
            )`
          : sql``
      }
    order by
      ${view === "packa" ? sql`order_date asc, order_number asc` : sql`order_date desc, order_number desc`}
    limit 500`;
}

export async function getOrderLinesFor(orderIds: string[]) {
  if (orderIds.length === 0) return new Map<string, OrderLine[]>();
  const rows = await sql<(OrderLine & { order_id: string })[]>`
    select order_id, product_id, quantity, unit_price from order_lines where order_id in ${sql(orderIds)}`;
  const map = new Map<string, OrderLine[]>();
  for (const r of rows) {
    const list = map.get(r.order_id) ?? [];
    list.push({ product_id: r.product_id, quantity: r.quantity, unit_price: r.unit_price });
    map.set(r.order_id, list);
  }
  return map;
}

export async function getOrderByNumber(n: number) {
  const [order] = await sql<OrderRow[]>`select * from orders_overview where order_number = ${n}`;
  if (!order) return null;
  const [lines, events] = await Promise.all([
    sql<OrderLine[]>`select product_id, quantity, unit_price from order_lines where order_id = ${order.id}`,
    sql<OrderEvent[]>`
      select e.id, e.kind, e.from_value, e.to_value, e.note, e.created_at, p.full_name as user_name
      from order_events e left join profiles p on p.id = e.created_by
      where e.order_id = ${order.id} order by e.created_at, e.id`,
  ]);
  return { order, lines, events };
}

export async function getCustomers(q?: string) {
  const term = q?.trim();
  return sql<(Customer & { order_count: number; last_order: string | null; total_qty: number })[]>`
    select c.*,
      coalesce(o.order_count, 0)::int as order_count,
      o.last_order,
      coalesce(o.total_qty, 0)::int as total_qty
    from customers c
    left join (
      select customer_id, count(*) as order_count, max(order_date) as last_order, sum(total_qty) as total_qty
      from orders_overview where status <> 'makulerad' group by customer_id
    ) o on o.customer_id = c.id
    ${
      term
        ? sql`where c.name ilike ${"%" + term + "%"} or c.contact_name ilike ${"%" + term + "%"}
               or c.email ilike ${"%" + term + "%"} or c.city ilike ${"%" + term + "%"}`
        : sql``
    }
    order by lower(c.name)`;
}

/** Lätt lista för kundväljaren i orderformuläret */
export async function getCustomerOptions() {
  return sql<Customer[]>`select * from customers order by lower(name)`;
}

export async function getCustomer(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [c] = await sql<Customer[]>`select * from customers where id = ${id}`;
  return c ?? null;
}

export async function getMovements(opts: { productId?: number; type?: string; limit?: number } = {}) {
  return sql<Movement[]>`
    select m.id, m.product_id, m.quantity, m.type, m.note, m.occurred_at, m.order_id,
           o.order_number, p.full_name as user_name
    from inventory_movements m
    left join orders o on o.id = m.order_id
    left join profiles p on p.id = m.created_by
    where true
      ${opts.productId ? sql`and m.product_id = ${opts.productId}` : sql``}
      ${opts.type ? sql`and m.type = ${opts.type}` : sql``}
    order by m.occurred_at desc, m.id desc
    limit ${opts.limit ?? 200}`;
}

/** Underlag för "Att göra idag" på översikten */
export async function getTodayWork() {
  const [toPack, toInvoice, overdue, newOrders] = await Promise.all([
    sql<OrderRow[]>`
      select * from orders_overview where status in ('bekraftad', 'ska_packas')
      order by order_date asc, order_number asc limit 8`,
    sql<OrderRow[]>`
      select * from orders_overview
      where status in ('skickad','levererad','avslutad') and invoice_status = 'ej_fakturerad'
      order by order_date asc limit 8`,
    sql<OrderRow[]>`
      select * from orders_overview where is_overdue and status <> 'makulerad'
      order by invoice_due_date asc limit 8`,
    sql<OrderRow[]>`
      select * from orders_overview where status = 'ny'
      order by order_date asc, order_number asc limit 8`,
  ]);
  return { toPack, toInvoice, overdue, newOrders };
}

export const ORDER_STATUSES: OrderStatus[] = [
  "ny",
  "bekraftad",
  "ska_packas",
  "skickad",
  "levererad",
  "avslutad",
  "makulerad",
];
