"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fulfillWithTracking } from "@/lib/shopify-admin";
import { bookShipment } from "@/lib/postnord";
import { orderRef } from "@/lib/labels";
import { shippingDetailsSchema, type ShippingDetails } from "@/lib/shipping-details";
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
 * mejl med spårningslänk). Med markShipped sätts ordern också som Skickad här, vilket drar
 * lagret. Vid PostNord-bokning är markShipped av: ordern ligger kvar under Att packa tills
 * någon markerar den som skickad när paketet har lämnats.
 */
async function finishShipped(o: ShipRow, tracking: string, userId: string, how: string, markShipped = true) {
  let shopifyNote = "";
  if (o.shopify_order_id && !o.shopify_fulfilled_at) {
    const result = await fulfillWithTracking(o.shopify_order_id, tracking, true);
    await sql`update orders set shopify_fulfilled_at = now() where id = ${o.id}`;
    shopifyNote = result === "redan" ? "Ordern var redan skickad i Shopify" : "Skickad i Shopify, kunden har fått mejl";
  }

  await sql`insert into order_events (order_id, kind, note, created_by)
            values (${o.id}, 'andrad', ${`${how} ${tracking}${shopifyNote ? `. ${shopifyNote}` : ""}`}, ${userId})`;

  if (markShipped && ["ny", "bekraftad", "ska_packas"].includes(o.status)) {
    await sql`select set_order_status(${o.id}, 'skickad'::order_status, ${userId}, ${how})`;
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

const MAX_WEIGHT_GRAMS = 3000; // Home Small tar högst 3 kg

/** Ändra orderns vikt för hand (gram). Tomt värde = ingen vikt, då används standardvikten vid bokning. */
export async function updateOrderWeight(orderId: string, rawGrams: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const id = z.string().uuid().parse(orderId);
    const text = rawGrams.trim().replace(",", ".");

    let grams: number | null = null;
    if (text !== "") {
      const n = Number(text);
      if (!Number.isInteger(n)) throw new Error("Ange vikten i hela gram, t.ex. 300");
      if (n < 1) throw new Error("Vikten måste vara minst 1 gram");
      if (n > MAX_WEIGHT_GRAMS) throw new Error(`Vikten får vara högst ${MAX_WEIGHT_GRAMS} g för Home Small`);
      grams = n;
    }

    const [o] = await sql<{ status: OrderStatus; weight_grams: number | null; postnord_booked_at: Date | null }[]>`
      select status, weight_grams, postnord_booked_at from orders where id = ${id}`;
    if (!o) throw new Error("Ordern finns inte");
    if (o.status === "makulerad") throw new Error("Ordern är makulerad");
    if (o.postnord_booked_at) throw new Error("Ordern är redan bokad hos PostNord, så vikten kan inte ändras här");

    await sql`update orders set weight_grams = ${grams} where id = ${id}`;
    await sql`insert into order_events (order_id, kind, note, created_by)
              values (${id}, 'andrad',
                      ${`Vikt ändrad: ${o.weight_grams ? `${o.weight_grams} g` : "saknades"} → ${grams ? `${grams} g` : "ingen vikt"}`},
                      ${user.id})`;

    revalidatePath("/", "layout");
    return { ok: true, message: grams ? `Vikt sparad: ${grams} g` : "Vikten rensad" };
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
 * Bokar Home Small Prio hos PostNord för valda ordrar. För varje order: kolli-ID sparas och
 * ordern markeras som skickad i Shopify (kunden mejlas). Ordern behåller sin status här och
 * ligger kvar under Att packa; den markeras som skickad separat när paketet har lämnats.
 * Etiketterna skrivs sedan ut via /api/etiketter.
 */
export async function bookWithPostnord(
  orderIds: string[],
  details: Record<string, ShippingDetails> = {},
): Promise<BookResult> {
  const user = await requireUser();
  const ids = z.array(z.string().uuid()).min(1, "Välj minst en order").max(50).parse(orderIds);
  const rows = await sql<ShipRow[]>`select ${SHIP_COLUMNS} from orders where id in ${sql(ids)} order by order_number`;

  const result: BookResult = { ok: true, booked: [], failed: [] };
  for (const o of rows) {
    try {
      if (o.status === "makulerad") throw new Error("Ordern är makulerad");
      if (o.postnord_booked_at && o.tracking_number) throw new Error("Redan bokad");
      if (!["ny", "bekraftad", "ska_packas"].includes(o.status)) throw new Error("Ordern är redan skickad");

      // Validera på servern innan någon bokning görs. Tom kontaktuppgift rensar bara bokningens värde.
      const custom = Object.prototype.hasOwnProperty.call(details, o.id)
        ? shippingDetailsSchema.parse(details[o.id])
        : null;
      const booking = await bookShipment({
        ...(custom ? { reference: custom.reference } : {}),
        orderRef: orderRef(o.order_number),
        shopifyName: o.shopify_order_name,
        name: o.ship_name ?? o.contact_name ?? "",
        address: o.ship_address ?? "",
        postalCode: o.ship_postal_code ?? "",
        city: o.ship_city ?? "",
        country: o.ship_country || "SE",
        email: custom ? custom.email || null : o.contact_email,
        phone: custom ? custom.phone || null : o.contact_phone,
        weightGrams: o.weight_grams,
      });

      // Spara bokningen direkt, så att den aldrig görs två gånger
      await sql`update orders set tracking_number = ${booking.trackingNumber}, postnord_booked_at = now(),
                postnord_booking_id = ${booking.bookingId} where id = ${o.id}`;
      // Etiketten kommer med i PostNords svar – spara den så att den kan skrivas ut när som helst
      if (booking.labelPdf) {
        try {
          await sql`insert into postnord_labels (order_id, pdf) values (${o.id}, ${booking.labelPdf})
                    on conflict (order_id) do update set pdf = excluded.pdf, created_at = now()`;
        } catch (e) {
          console.error("[postnord] kunde inte spara etiketten", e);
        }
      }
      result.booked.push({ orderNumber: o.order_number, trackingNumber: booking.trackingNumber });

      try {
        await finishShipped(o, booking.trackingNumber, user.id, "Bokad hos PostNord, kolli-ID", false);
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
