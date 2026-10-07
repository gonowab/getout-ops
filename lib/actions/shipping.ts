"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fulfillWithTracking } from "@/lib/shopify-admin";
import type { ActionResult, OrderStatus } from "@/lib/types";

// PostNords kolli-ID är bokstäver och siffror, t.ex. 00370712345678901234 eller UA123456789SE
const trackingSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s+/g, "").toUpperCase())
  .refine((v) => /^[A-Z0-9]{8,40}$/.test(v), "Spårningsnumret ser inte rätt ut");

function fail(e: unknown): ActionResult {
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Ogiltiga uppgifter" };
  const msg = e instanceof Error ? e.message : String(e);
  console.error(e);
  return { ok: false, error: msg };
}

/**
 * Sparar spårningsnumret, markerar ordern som skickad i Shopify (kunden får mejl med
 * spårningslänk) och sätter ordern som Skickad här, vilket drar lagret.
 */
export async function sendTrackingToShopify(orderId: string, rawTracking: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const tracking = trackingSchema.parse(rawTracking);

    const [o] = await sql<{
      status: OrderStatus;
      shopify_order_id: string | null;
      shopify_fulfilled_at: Date | null;
    }[]>`select status, shopify_order_id, shopify_fulfilled_at from orders where id = ${orderId}`;
    if (!o) throw new Error("Ordern finns inte");
    if (o.status === "makulerad") throw new Error("Ordern är makulerad");

    // Spara numret först, så att det inte försvinner om Shopify krånglar
    await sql`update orders set tracking_number = ${tracking} where id = ${orderId}`;

    let shopifyNote = "";
    if (o.shopify_order_id && !o.shopify_fulfilled_at) {
      const result = await fulfillWithTracking(o.shopify_order_id, tracking, true);
      await sql`update orders set shopify_fulfilled_at = now() where id = ${orderId}`;
      shopifyNote = result === "redan" ? "Ordern var redan skickad i Shopify" : "Skickad i Shopify, kunden har fått mejl";
    }

    await sql`insert into order_events (order_id, kind, note, created_by)
              values (${orderId}, 'andrad', ${`Spårningsnummer ${tracking}${shopifyNote ? `. ${shopifyNote}` : ""}`}, ${user.id})`;

    if (["ny", "bekraftad", "ska_packas"].includes(o.status)) {
      await sql`select set_order_status(${orderId}, 'skickad'::order_status, ${user.id}, 'Spårningsnummer inlagt')`;
    }

    revalidatePath("/", "layout");
    return { ok: true, message: shopifyNote || "Spårningsnummer sparat" };
  } catch (e) {
    return fail(e);
  }
}
