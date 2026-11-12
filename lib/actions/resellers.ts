"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql, type Sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { SHIPPED_STATUSES } from "@/lib/labels";
import {
  deliverySchema,
  resellerSchema,
  optionalDate,
  followUpDate,
  shipmentWeight,
  type DeliveryInput,
  type ResellerInput,
} from "@/lib/resellers";
import type { ActionResult, OrderStatus } from "@/lib/types";

function fail(e: unknown): ActionResult {
  return {
    ok: false,
    error:
      e instanceof z.ZodError
        ? (e.issues[0]?.message ?? "Ogiltiga uppgifter")
        : e instanceof Error
          ? e.message
          : String(e),
  };
}
function customerFields(raw: ResellerInput) {
  const data = resellerSchema.parse(raw);
  return {
    ...data,
    contacts: JSON.stringify(data.contacts),
    contact_name: data.contacts[0]?.name || null,
    email: data.contacts[0]?.email || null,
  };
}
async function assertReseller(tx: Sql, id: string) {
  const [c] =
    await tx`select id from customers where id=${id} and type='aterforsaljare' for update`;
  if (!c) throw new Error("Återförsäljaren finns inte.");
}
export async function saveReseller(
  id: string | null,
  raw: ResellerInput,
): Promise<ActionResult> {
  try {
    await requireUser();
    const data = customerFields(raw);
    const saved = await sql.begin(async (tx) => {
      if (id) {
        z.string().uuid().parse(id);
        await assertReseller(tx, id);
        await tx`update customers set ${tx(data)} where id=${id}`;
        return id;
      }
      const [c] = await tx<
        { id: string }[]
      >`insert into customers ${tx({ ...data, type: "aterforsaljare" })} returning id`;
      return c.id;
    });
    revalidatePath("/", "layout");
    return { ok: true, id: saved, message: "Återförsäljaren sparades" };
  } catch (e) {
    return fail(e);
  }
}
export async function saveDelivery(raw: DeliveryInput): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const d = deliverySchema.parse(raw);
    const result = await sql.begin(async (tx) => {
      let customerId = d.customerId;
      let orderId: string | null = null;
      let existing = false;
      if (d.id) {
        const [old] = await tx<
          { customer_id: string; order_id: string | null }[]
        >`select customer_id,order_id from reseller_deliveries where id=${d.id} for update`;
        if (!old) throw new Error("Leveransen finns inte.");
        customerId = old.customer_id;
        orderId = old.order_id;
        existing = true;
      }
      if (!customerId) {
        const fields = customerFields(d.newReseller ?? { name: "" });
        const [c] = await tx<
          { id: string }[]
        >`insert into customers ${tx({ ...fields, type: "aterforsaljare" })} returning id`;
        customerId = c.id;
      }
      await assertReseller(tx, customerId);
      const follow = followUpDate(
        d.deliveredOn,
        d.followUpManual,
        d.followUpOn,
      );
      if (existing && !orderId) {
        await tx`update reseller_deliveries set delivered_on=${d.deliveredOn},follow_up_on=${follow},follow_up_manual=${d.followUpManual},note=${d.note},quantity=coalesce(${d.legacyQuantity},quantity) where id=${d.id}`;
        return d.id;
      }
      const lines = d.lines.filter((l) => l.quantity > 0);
      if (new Set(lines.map((l) => l.productId)).size !== lines.length)
        throw new Error("Samma produkt finns flera gånger.");
      if (lines.length) {
        const valid = await tx<
          { id: number }[]
        >`select id from products where id in ${tx(lines.map((l) => l.productId))}`;
        if (valid.length !== lines.length)
          throw new Error("En produkt finns inte längre.");
      }
      const [c] = await tx<
        {
          name: string;
          contact_name: string | null;
          email: string | null;
          invoice_email: string | null;
        }[]
      >`select name,contact_name,email,invoice_email from customers where id=${customerId}`;
      const fields = {
        customer_id: customerId,
        source: "aterforsaljare",
        ship_name: d.shipName,
        ship_address: d.shipAddress,
        ship_postal_code: d.shipPostalCode,
        ship_city: d.shipCity,
        comment: d.note,
        weight_grams: shipmentWeight(lines),
      };
      if (orderId) {
        const [order] = await tx<
          { status: OrderStatus }[]
        >`select status from orders where id=${orderId} for update`;
        if (!order) throw new Error("Ordern finns inte.");
        const before = await tx<
          { product_id: number; quantity: number }[]
        >`select product_id,quantity from order_lines where order_id=${orderId}`;
        const signature = (ls: { product_id: number; quantity: number }[]) =>
          ls
            .map((l) => `${l.product_id}:${l.quantity}`)
            .sort()
            .join(",");
        if (
          SHIPPED_STATUSES.includes(order.status) &&
          signature(before) !==
            signature(
              lines.map((l) => ({
                product_id: l.productId,
                quantity: l.quantity,
              })),
            )
        )
          throw new Error(
            "Ordern är redan skickad. Backa statusen i orderflödet innan antalet ändras.",
          );
        await tx`update orders set ${tx(fields)} where id=${orderId}`;
        await tx`delete from order_lines where order_id=${orderId}`;
      } else {
        const [o] = await tx<
          { id: string }[]
        >`insert into orders ${tx({ ...fields, created_by: user.id, contact_name: c.contact_name, contact_email: c.email, invoice_email: c.invoice_email })} returning id`;
        orderId = o.id;
      }
      if (lines.length)
        await tx`insert into order_lines ${tx(lines.map((l) => ({ order_id: orderId, product_id: l.productId, quantity: l.quantity, unit_price: d.unitPrice ?? null })))}`;
      await tx`update reseller_deliveries set delivered_on=${d.deliveredOn},follow_up_on=${follow},follow_up_manual=${d.followUpManual} where order_id=${orderId}`;
      await tx`insert into order_events(order_id,kind,note,created_by) values(${orderId},${existing ? "andrad" : "skapad"},'Leverans via återförsäljarfliken',${user.id})`;
      return orderId;
    });
    revalidatePath("/", "layout");
    return { ok: true, id: result, message: "Leveransen sparades" };
  } catch (e) {
    return fail(e);
  }
}
export async function saveResellerNote(
  customerId: string,
  id: string | null,
  form: FormData,
): Promise<ActionResult> {
  try {
    await requireUser();
    z.string().uuid().parse(customerId);
    if (id) z.string().uuid().parse(id);
    const body = z
      .string()
      .max(20000)
      .parse(form.get("body") ?? "");
    const date = optionalDate.parse(form.get("noted_on"));
    await sql.begin(async (tx) => {
      await assertReseller(tx, customerId);
      if (id)
        await tx`update reseller_notes set body=${body},noted_on=${date} where id=${id} and customer_id=${customerId}`;
      else
        await tx`insert into reseller_notes(customer_id,body,noted_on) values(${customerId},${body},${date})`;
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Anteckningen sparades" };
  } catch (e) {
    return fail(e);
  }
}
export async function setResellerFollowedUp(
  id: string,
  followedUp: boolean,
): Promise<ActionResult> {
  try {
    await requireUser();
    z.string().uuid().parse(id);
    z.boolean().parse(followedUp);
    await sql`update reseller_deliveries set followed_up=${followedUp} where id=${id}`;
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
// Explicit koppling av en äldre fristående leverans till en befintlig order.
export async function linkLegacyDelivery(
  deliveryId: string,
  orderId: string,
): Promise<ActionResult> {
  try {
    await requireUser();
    z.string().uuid().parse(deliveryId);
    z.string().uuid().parse(orderId);
    await sql.begin(async (tx) => {
      const [d] = await tx<
        { customer_id: string; order_id: string | null; note: string | null }[]
      >`select customer_id,order_id,note from reseller_deliveries where id=${deliveryId} for update`;
      if (!d || d.order_id)
        throw new Error("Leveransen är redan kopplad eller finns inte.");
      const [o] =
        await tx`select id from orders where id=${orderId} and customer_id=${d.customer_id} for update`;
      if (!o) throw new Error("Välj en order för samma återförsäljare.");
      const [other] = await tx<
        {
          id: string;
          delivered_on: string | null;
          follow_up_on: string | null;
          note: string | null;
        }[]
      >`select id,delivered_on,follow_up_on,note from reseller_deliveries where order_id=${orderId} for update`;
      if (other?.delivered_on || other?.follow_up_on || other?.note)
        throw new Error(
          "Ordern har redan leveransuppgifter. Kopplingen behöver granskas manuellt.",
        );
      if (d.note)
        await tx`update orders set comment=concat_ws(chr(10),nullif(comment,''),${d.note}::text) where id=${orderId}`;
      if (other) await tx`delete from reseller_deliveries where id=${other.id}`;
      await tx`update reseller_deliveries set order_id=${orderId} where id=${deliveryId}`;
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Leveransen kopplades till ordern" };
  } catch (e) {
    return fail(e);
  }
}
