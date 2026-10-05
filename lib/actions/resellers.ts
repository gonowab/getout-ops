"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { ActionResult } from "@/lib/types";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ange ett giltigt datum");

const deliverySchema = z.object({
  name: z.string().trim().min(1, "Ange återförsäljarens namn"),
  quantity: z.coerce
    .number({ error: "Ange antal kortlekar" })
    .int("Antalet måste vara ett helt tal")
    .min(1, "Antalet måste vara minst 1"),
  delivered_on: isoDate,
  follow_up_on: isoDate,
  note: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v)),
});

export async function saveResellerDelivery(id: string | null, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const data = deliverySchema.parse(Object.fromEntries(formData.entries()));
    if (data.follow_up_on < data.delivered_on) {
      return { ok: false, error: "Uppföljningen kan inte ligga före leveransdatumet" };
    }
    if (id) {
      await sql`update reseller_deliveries set ${sql(data)} where id = ${id}`;
    } else {
      await sql`insert into reseller_deliveries ${sql({ ...data, created_by: user.id })}`;
    }
    revalidatePath("/", "layout");
    return { ok: true, message: id ? "Ändringen sparades" : `${data.name} lades till` };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Ogiltiga uppgifter" };
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function setResellerFollowedUp(id: string, followedUp: boolean): Promise<ActionResult> {
  try {
    await requireUser();
    await sql`update reseller_deliveries set followed_up = ${followedUp} where id = ${id}`;
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteResellerDelivery(id: string): Promise<ActionResult> {
  try {
    await requireUser();
    await sql`delete from reseller_deliveries where id = ${id}`;
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
