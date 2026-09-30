"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { ActionResult } from "@/lib/types";

const schema = z.object({
  type: z.enum(["inleverans", "justering", "retur"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ange ett datum"),
  note: z.string().trim().max(500).optional().default(""),
  rows: z
    .array(z.object({ productId: z.number().int().positive(), quantity: z.number().int() }))
    .transform((r) => r.filter((x) => x.quantity !== 0)),
});

export type MovementInput = z.input<typeof schema>;

export async function registerMovements(raw: MovementInput): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const input = schema.parse(raw);
    if (input.rows.length === 0) return { ok: false, error: "Ange antal för minst en kortlek." };

    if (input.type !== "justering" && input.rows.some((r) => r.quantity < 0))
      return { ok: false, error: "Inleverans och retur ska vara positiva tal. Använd justering för att minska." };
    if (input.type === "justering" && !input.note)
      return { ok: false, error: "Skriv en kort anledning till justeringen, t.ex. ”Inventering”." };

    // Datum idag = nu, annars mitt på dagen det angivna datumet
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm" });
    const occurredAt = input.date === today ? new Date() : new Date(`${input.date}T12:00:00+02:00`);

    await sql`
      insert into inventory_movements ${sql(
        input.rows.map((r) => ({
          product_id: r.productId,
          quantity: r.quantity,
          type: input.type,
          note: input.note || null,
          occurred_at: occurredAt,
          created_by: user.id,
        })),
      )}`;
    revalidatePath("/", "layout");
    const total = input.rows.reduce((s, r) => s + r.quantity, 0);
    return { ok: true, message: `${total > 0 ? "+" : ""}${total} st registrerat` };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Ogiltiga uppgifter" };
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteMovement(id: number): Promise<ActionResult> {
  try {
    await requireUser();
    const [m] = await sql<{ type: string }[]>`select type from inventory_movements where id = ${id}`;
    if (!m) return { ok: false, error: "Rörelsen finns inte." };
    if (m.type === "order")
      return { ok: false, error: "Orderdragningar ändras genom att byta status på ordern." };
    await sql`delete from inventory_movements where id = ${id}`;
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function updateThreshold(productId: number, threshold: number): Promise<ActionResult> {
  try {
    await requireUser();
    const t = z.number().int().min(0).max(1_000_000).parse(threshold);
    await sql`update products set low_stock_threshold = ${t} where id = ${productId}`;
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
