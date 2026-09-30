"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { ActionResult } from "@/lib/types";

const opt = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .transform((v) => v ?? null);

const customerSchema = z.object({
  name: z.string().trim().min(1, "Ange ett namn"),
  type: z.enum(["privat", "foretag", "aterforsaljare"]),
  org_number: opt,
  contact_name: opt,
  email: opt.refine((v) => v === null || /.+@.+\..+/.test(v), "E-postadressen ser inte rätt ut"),
  phone: opt,
  address: opt,
  postal_code: opt,
  city: opt,
  invoice_email: opt.refine((v) => v === null || /.+@.+\..+/.test(v), "Fakturamejlen ser inte rätt ut"),
  invoice_reference: opt,
  notes: opt,
});

export async function saveCustomer(id: string | null, formData: FormData): Promise<ActionResult> {
  try {
    await requireUser();
    const data = customerSchema.parse(Object.fromEntries(formData.entries()));
    let savedId = id;
    if (id) {
      await sql`update customers set ${sql(data)} where id = ${id}`;
    } else {
      const [row] = await sql<{ id: string }[]>`insert into customers ${sql(data)} returning id`;
      savedId = row.id;
    }
    revalidatePath("/", "layout");
    return { ok: true, id: savedId ?? undefined, message: "Kunden sparades" };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Ogiltiga uppgifter" };
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteCustomer(id: string): Promise<ActionResult> {
  try {
    await requireUser();
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from orders where customer_id = ${id}`;
    if (n > 0) return { ok: false, error: `Kunden har ${n} ordrar och kan inte tas bort.` };
    await sql`delete from customers where id = ${id}`;
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
