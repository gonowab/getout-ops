import "server-only";
import crypto from "node:crypto";
import { sql, type Sql } from "@/lib/db";
import type { InvoiceStatus, OrderStatus, ShippingService } from "@/lib/types";

/*
 * Shopify → GetOut Operations
 *
 * Shopify skickar en webhook när en order skapas eller ändras. Vi:
 *  1. verifierar signaturen (HMAC) mot SHOPIFY_WEBHOOK_SECRET
 *  2. skapar ordern första gången (status Bekräftad = reserverar lager och hamnar i "Att packa")
 *  3. vid senare uppdateringar: skickad i Shopify → Skickad här (drar lager),
 *     avbruten i Shopify → Makulerad här (släpper lagret)
 * Allt lager hanteras av set_order_status i databasen, precis som för manuella ordrar.
 */

// ---------- Typer för det vi använder ur Shopifys order-JSON ----------
type Money = string | number | null | undefined;
type ShopifyAddress = {
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  zip?: string | null;
  country_code?: string | null;
  phone?: string | null;
};
type ShopifyLineItem = {
  variant_id?: number | string | null;
  title?: string | null;
  quantity?: number | null;
  price?: Money;
  tax_lines?: { price?: Money }[];
  discount_allocations?: { amount?: Money }[];
};
export type ShopifyOrder = {
  id: number | string;
  name?: string | null;
  created_at?: string | null;
  processed_at?: string | null;
  cancelled_at?: string | null;
  email?: string | null;
  contact_email?: string | null;
  phone?: string | null;
  note?: string | null;
  financial_status?: string | null;
  fulfillment_status?: string | null;
  taxes_included?: boolean | null;
  total_weight?: number | null; // gram
  shipping_lines?: { title?: string | null; code?: string | null }[];
  fulfillments?: { tracking_number?: string | null; status?: string | null }[];
  customer?: {
    id?: number | string | null;
    email?: string | null;
    phone?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  shipping_address?: ShopifyAddress | null;
  billing_address?: ShopifyAddress | null;
  line_items?: ShopifyLineItem[];
};

export type ProcessResult = {
  outcome: "importerad" | "uppdaterad" | "oförändrad" | "ignorerad" | "dubblett";
  message?: string;
  orderNumber?: number;
};

// ---------- Hjälpfunktioner ----------
export function verifyShopifyHmac(rawBody: string, hmacHeader: string | null, secret: string) {
  if (!hmacHeader) return false;
  const computed = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(computed, "utf8");
  const b = Buffer.from(hmacHeader, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const toNum = (v: Money) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"));
  return Number.isFinite(n) ? n : 0;
};
const clean = (v: string | null | undefined) => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};
const stockholmDate = (iso: string | null | undefined) =>
  new Date(iso ?? Date.now()).toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm" });

function personName(o: ShopifyOrder) {
  const c = o.customer;
  const fromCustomer = [c?.first_name, c?.last_name].map(clean).filter(Boolean).join(" ");
  const ship = o.shipping_address ?? o.billing_address;
  const fromAddress = clean(ship?.name) ?? [ship?.first_name, ship?.last_name].map(clean).filter(Boolean).join(" ");
  return clean(fromCustomer) ?? clean(fromAddress) ?? clean(o.email) ?? "Shopify-kund";
}

function desiredStatus(o: ShopifyOrder): OrderStatus {
  if (o.cancelled_at) return "makulerad";
  if (o.fulfillment_status === "fulfilled") return "skickad";
  return "bekraftad";
}

/** Kundens valda frakt i kassan → PostNord-fraktsätt. Okänt = vanliga Home Small. */
export function serviceFromShopify(o: ShopifyOrder): ShippingService {
  const text = (o.shipping_lines ?? []).map((l) => `${l.title ?? ""} ${l.code ?? ""}`).join(" ");
  return /prio|1:a klass|express/i.test(text) ? "home_small_prio" : "home_small";
}

function weightFromShopify(o: ShopifyOrder) {
  const w = Number(o.total_weight);
  return Number.isFinite(w) && w > 0 ? Math.round(w) : null;
}

function invoiceFromShopify(o: ShopifyOrder): InvoiceStatus {
  return ["paid", "partially_refunded", "refunded"].includes(o.financial_status ?? "") ? "betald" : "ej_fakturerad";
}

/** À-pris exkl. moms per rad, efter rabatt */
function netUnitPrice(li: ShopifyLineItem, taxesIncluded: boolean) {
  const qty = li.quantity ?? 0;
  if (qty <= 0) return 0;
  const gross = toNum(li.price) * qty;
  const discount = (li.discount_allocations ?? []).reduce((s, d) => s + toNum(d.amount), 0);
  const tax = (li.tax_lines ?? []).reduce((s, t) => s + toNum(t.price), 0);
  const net = taxesIncluded ? gross - discount - tax : gross - discount;
  return Math.max(0, net) / qty;
}

// ---------- Huvudfunktion ----------
export async function processShopifyOrder(
  topic: string,
  order: ShopifyOrder,
  webhookId: string | null,
): Promise<ProcessResult> {
  const shopifyId = String(order.id);
  const name = clean(order.name) ?? `#${shopifyId}`;

  if (webhookId) {
    const [seen] = await sql<{ id: number }[]>`select id from shopify_events where webhook_id = ${webhookId}`;
    if (seen) return { outcome: "dubblett" };
  }

  const result = await sql.begin(async (tx) => {
    const [existing] = await tx<{ id: string; order_number: number; status: OrderStatus; invoice_status: InvoiceStatus }[]>`
      select id, order_number, status, invoice_status from orders where shopify_order_id = ${shopifyId} for update`;

    if (existing) return updateExisting(tx, existing, order);

    // En äldre order (från före kopplingen) som redan är skickad eller avbruten ska inte
    // importeras när den ändras i Shopify – då skulle lagret dras i efterhand.
    if (topic !== "orders/create" && desiredStatus(order) !== "bekraftad") {
      return {
        outcome: "ignorerad" as const,
        message: "Äldre order som redan är skickad eller avbruten – importeras inte",
      };
    }
    return createNew(tx, order, shopifyId, name);
  });

  await sql`
    insert into shopify_events (webhook_id, topic, shopify_order_id, shopify_order_name, outcome, message)
    values (${webhookId}, ${topic}, ${shopifyId}, ${name}, ${result.outcome}, ${result.message ?? null})
    on conflict (webhook_id) do nothing`;

  return result;
}

async function updateExisting(
  tx: Sql,
  existing: { id: string; order_number: number; status: OrderStatus; invoice_status: InvoiceStatus },
  order: ShopifyOrder,
): Promise<ProcessResult> {
  const changes: string[] = [];
  const want = desiredStatus(order);

  // Vikten fylls i om den saknas (ordrar importerade innan vikten sparades)
  const weight = weightFromShopify(order);
  if (weight) await tx`update orders set weight_grams = ${weight} where id = ${existing.id} and weight_grams is null`;
  const notShippedYet = ["ny", "bekraftad", "ska_packas"].includes(existing.status);

  if (want === "makulerad" && existing.status !== "makulerad") {
    await tx`select set_order_status(${existing.id}, 'makulerad'::order_status, null, 'Avbruten i Shopify')`;
    changes.push("makulerad");
  } else if (want === "skickad" && notShippedYet) {
    await tx`select set_order_status(${existing.id}, 'skickad'::order_status, null, 'Skickad i Shopify')`;
    changes.push("skickad");
  }

  // Spårningsnummer som lagts in i Shopify (t.ex. av Synca) sparas här också om vi saknar det
  const tracking = (order.fulfillments ?? []).map((f) => clean(f.tracking_number)).find(Boolean);
  if (tracking) {
    const updated = await tx`update orders set tracking_number = ${tracking}
                             where id = ${existing.id} and tracking_number is null returning id`;
    if (updated.length) changes.push("spårningsnummer");
  }

  if (invoiceFromShopify(order) === "betald" && existing.invoice_status === "ej_fakturerad") {
    await tx`update orders set invoice_status = 'betald', paid_at = ${stockholmDate(order.processed_at)} where id = ${existing.id}`;
    await tx`insert into order_events (order_id, kind, from_value, to_value, note)
             values (${existing.id}, 'faktura', 'Ej fakturerad', 'Betald', 'Betald i Shopify')`;
    changes.push("betald");
  }

  return changes.length
    ? { outcome: "uppdaterad", message: changes.join(", "), orderNumber: existing.order_number }
    : { outcome: "oförändrad", orderNumber: existing.order_number };
}

async function createNew(tx: Sql, order: ShopifyOrder, shopifyId: string, name: string): Promise<ProcessResult> {
  // Produktkoppling: Shopify-variant → kortlek (gammal eller ny ask, styrs under Inställningar)
  const mapped = await tx<{ id: number; shopify_variant_id: string }[]>`
    select id, shopify_variant_id from products where shopify_variant_id is not null and active`;
  const byVariant = new Map(mapped.map((p) => [p.shopify_variant_id, p.id]));
  const taxesIncluded = order.taxes_included !== false;

  const lines = new Map<number, { qty: number; net: number }>();
  const unknown: string[] = [];
  for (const li of order.line_items ?? []) {
    const qty = li.quantity ?? 0;
    if (qty <= 0) continue;
    const productId = li.variant_id != null ? byVariant.get(String(li.variant_id)) : undefined;
    if (!productId) {
      unknown.push(`${li.title ?? "Okänd produkt"} × ${qty}`);
      continue;
    }
    const cur = lines.get(productId) ?? { qty: 0, net: 0 };
    cur.qty += qty;
    cur.net += netUnitPrice(li, taxesIncluded) * qty;
    lines.set(productId, cur);
  }

  if (lines.size === 0) {
    return {
      outcome: "ignorerad",
      message: unknown.length ? `Inga kortlekar i ordern (${unknown.join(", ")})` : "Ordern saknar produkter",
    };
  }

  // Kund: samma Shopify-kund eller e-post återanvänds, annars skapas en privatperson
  const email = clean(order.customer?.email) ?? clean(order.contact_email) ?? clean(order.email);
  const phone = clean(order.customer?.phone) ?? clean(order.phone) ?? clean(order.shipping_address?.phone);
  const shopifyCustomerId = order.customer?.id != null ? String(order.customer.id) : null;
  const ship = order.shipping_address ?? order.billing_address ?? {};
  const contactName = personName(order);
  const address = [clean(ship.address1), clean(ship.address2)].filter(Boolean).join(", ") || null;

  let customerId: string | null = null;
  if (shopifyCustomerId) {
    const [c] = await tx<{ id: string }[]>`select id from customers where shopify_customer_id = ${shopifyCustomerId}`;
    customerId = c?.id ?? null;
  }
  if (!customerId && email) {
    const [c] = await tx<{ id: string }[]>`
      select id from customers where lower(email) = lower(${email}) order by created_at limit 1`;
    customerId = c?.id ?? null;
    if (customerId && shopifyCustomerId) {
      await tx`update customers set shopify_customer_id = coalesce(shopify_customer_id, ${shopifyCustomerId})
               where id = ${customerId}
                 and not exists (select 1 from customers where shopify_customer_id = ${shopifyCustomerId})`;
    }
  }
  if (!customerId) {
    const [c] = await tx<{ id: string }[]>`
      insert into customers ${tx({
        name: clean(ship.company) ?? contactName,
        type: clean(ship.company) ? "foretag" : "privat",
        contact_name: contactName,
        email,
        phone,
        address,
        postal_code: clean(ship.zip),
        city: clean(ship.city),
        country: clean(ship.country_code) ?? "SE",
        shopify_customer_id: shopifyCustomerId,
      })}
      returning id`;
    customerId = c.id;
  }

  const invoiceStatus = invoiceFromShopify(order);
  const comment = [clean(order.note), unknown.length ? `Ej kortlekar i ordern: ${unknown.join(", ")}` : null]
    .filter(Boolean)
    .join("\n") || null;

  const [created] = await tx<{ id: string; order_number: number }[]>`
    insert into orders ${tx({
      customer_id: customerId,
      source: "shopify",
      status: "ny",
      invoice_status: invoiceStatus,
      paid_at: invoiceStatus === "betald" ? stockholmDate(order.processed_at ?? order.created_at) : null,
      order_date: stockholmDate(order.created_at),
      contact_name: contactName,
      contact_email: email,
      contact_phone: phone,
      ship_name: clean(ship.name) ?? contactName,
      ship_address: address,
      ship_postal_code: clean(ship.zip),
      ship_city: clean(ship.city),
      ship_country: clean(ship.country_code) ?? "SE",
      comment,
      shopify_order_id: shopifyId,
      shopify_order_name: name,
      weight_grams: weightFromShopify(order),
      shipping_service: serviceFromShopify(order),
    })}
    returning id, order_number`;

  await tx`
    insert into order_lines ${tx(
      [...lines.entries()].map(([productId, l]) => ({
        order_id: created.id,
        product_id: productId,
        quantity: l.qty,
        unit_price: Math.round((l.net / l.qty) * 100) / 100,
      })),
    )}`;

  await tx`insert into order_events (order_id, kind, to_value, note)
           values (${created.id}, 'skapad', 'ny', ${`Importerad från Shopify ${name}`})`;

  const want = desiredStatus(order);
  await tx`select set_order_status(${created.id}, ${want}::order_status, null, 'Shopify')`;

  const qty = [...lines.values()].reduce((s, l) => s + l.qty, 0);
  return {
    outcome: "importerad",
    message: `${qty} st${want !== "bekraftad" ? `, ${want}` : ""}${unknown.length ? `, ${unknown.length} övriga rader` : ""}`,
    orderNumber: created.order_number,
  };
}

export async function logShopifyError(topic: string, webhookId: string | null, order: Partial<ShopifyOrder> | null, message: string) {
  try {
    await sql`
      insert into shopify_events (webhook_id, topic, shopify_order_id, shopify_order_name, outcome, message)
      values (${null}, ${topic}, ${order?.id != null ? String(order.id) : null}, ${order?.name ?? null}, 'fel', ${message.slice(0, 500)})`;
  } catch (e) {
    console.error("[shopify] kunde inte logga fel", e, webhookId);
  }
}
