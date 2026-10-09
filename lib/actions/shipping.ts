"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fulfillWithTracking } from "@/lib/shopify-admin";
import { bookShipment } from "@/lib/postnord";
import { orderRef } from "@/lib/labels";
import type { ActionResult, OrderStatus } from "@/lib/types";

// PostNords kolli-ID är bokstäver och siffror, t.ex. 00370712345678901234 eller UA123456789SE
const trackingSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s+/g, "").toUpperCase())
  .refine((v) => /^[A-Z0-9]{8,40}$/.test(v), "Spårningsnumret ser inte rätt ut");

function errorText(e: unknown) {
  if (e instanceof z.ZodError) return e.issues[0]?.message ?? "Ogiltiga uppgifter";
  return e instanceof Error ? e.message : String(e);
}

function fail(e: unknown): ActionResult {
  console.error(e);
  return { ok: false, error: errorText(e) };
}

type ShipRow = {
  id: string;
  order_number: number;
  status: OrderStatus;
  shopify_order_id: string | null;
  shopify_order_name: string | null;
  shopify_fulfilled_at: Date | null;
  postnord_booked_at: Date | null;
  tracking_number: string | null;
  ship_name: string | null;
  contact_name: string | null;
  ship_address: string | null;
  ship_postal_code: string | null;
  ship_city: string | null;
  ship_country: string;
  contact_email: string | null;
  contact_phone: string | null;
  weight_grams: number | null;
};

const SHIP_COLUMNS = sql`
  id, order_number, status, shopify_order_id, shopify_order_name, shopify_fulfilled_at, postnord_booked_at,
  tracking_number, ship_name, contact_name, ship_address, ship_postal_code, ship_city, ship_country,
  contact_email, contact_phone, weight_grams`;

/**
 * Efter att spårningsnumret är sparat: markera ordern som skickad i Shopify (kunden får
 * mejl med spårningslänk) och lägg den under Att packa (Ska packas). Den blir Skickad här,
 * och lagret dras, först när någon klickar Markera skickad.
 */
async function finishShipped(o: ShipRow, tracking: string, userId: string, how: string) {
  let shopifyNote = "";
  if (o.shopify_order_id && !o.shopify_fulfilled_at) {
    const result = await fulfillWithTracking(o.shopify_order_id, tracking, true);
    await sql`update orders set shopify_fulfilled_at = now() where id = ${o.id}`;
    shopifyNote = result === "redan" ? "Ordern var redan skickad i Shopify" : "Skickad i Shopify, kunden har fått mejl";
  }

  await sql`insert into order_events (order_id, kind, note, created_by)
            values (${o.id}, 'andrad', ${`${how} ${tracking}${shopifyNote ? `. ${shopifyNote}` : ""}`}, ${userId})`;

  if (["ny", "bekraftad"].includes(o.status)) {
    await sql`select set_order_status(${o.id}, 'ska_packas'::order_status, ${userId}, ${how})`;
  }
  return shopifyNote;
}

/** Spårningsnummer inlagt för hand (reserv om bokningen görs utanför appen) */
export async function sendTrackingToShopify(orderId: string, rawTracking: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const tracking = trackingSchema.parse(rawTracking);

    const [o] = await sql<ShipRow[]>`select ${SHIP_COLUMNS} from orders where id = ${orderId}`;
    if (!o) throw new Error("Ordern finns inte");
    if (o.status === "makulerad") throw new Error("Ordern är makulerad");

    // Spara numret först, så att det inte försvinner om Shopify krånglar
    await sql`update orders set tracking_number = ${tracking} where id = ${orderId}`;
    const note = await finishShipped(o, tracking, user.id, "Spårningsnummer inlagt");

    revalidatePath("/", "layout");
    return { ok: true, message: note || "Spårningsnummer sparat" };
  } catch (e) {
    return fail(e);
  }
}

export type BookResult = {
  ok: boolean;
  booked: { orderNumber: number; trackingNumber: string }[];
  failed: { orderNumber: number; error: string }[];
};

/**
 * Bokar Home Small Prio hos PostNord för valda ordrar. För varje order: kolli-ID sparas,
 * ordern markeras som skickad i Shopify (kunden mejlas) och ligger kvar under Att packa.
 * Etiketterna skrivs sedan ut via /api/etiketter.
 */
export async function bookWithPostnord(orderIds: string[]): Promise<BookResult> {
  const user = await requireUser();
  const ids = z.array(z.string().uuid()).min(1, "Välj minst en order").max(50).parse(orderIds);
  const rows = await sql<ShipRow[]>`select ${SHIP_COLUMNS} from orders where id in ${sql(ids)} order by order_number`;

  const result: BookResult = { ok: true, booked: [], failed: [] };
  for (const o of rows) {
    try {
      if (o.status === "makulerad") throw new Error("Ordern är makulerad");
      if (o.postnord_booked_at && o.tracking_number) throw new Error("Redan bokad");
      if (!["ny", "bekraftad", "ska_packas"].includes(o.status)) throw new Error("Ordern är redan skickad");

      const booking = await bookShipment({
        orderRef: orderRef(o.order_number),
        shopifyName: o.shopify_order_name,
        name: o.ship_name ?? o.contact_name ?? "",
        address: o.ship_address ?? "",
        postalCode: o.ship_postal_code ?? "",
        city: o.ship_city ?? "",
        country: o.ship_country || "SE",
        email: o.contact_email,
        phone: o.contact_phone,
        weightGrams: o.weight_grams,
      });

      // Spara bokningen direkt, så att den aldrig görs två gånger
      await sql`update orders set tracking_number = ${booking.trackingNumber}, postnord_booked_at = now(),
                postnord_booking_id = ${booking.bookingId} where id = ${o.id}`;
      result.booked.push({ orderNumber: o.order_number, trackingNumber: booking.trackingNumber });

      try {
        await finishShipped(o, booking.trackingNumber, user.id, "Bokad hos PostNord, kolli-ID");
      } catch (e) {
        // Bokningen är gjord – bara Shopify-steget misslyckades
        result.failed.push({
          orderNumber: o.order_number,
          error: `Bokad (${booking.trackingNumber}) men inte skickad i Shopify: ${errorText(e)}`,
        });
      }
    } catch (e) {
      console.error(e);
      result.failed.push({ orderNumber: o.order_number, error: errorText(e) });
    }
  }

  result.ok = result.failed.length === 0;
  revalidatePath("/", "layout");
  return result;
}
