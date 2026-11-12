"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  prospectSchema,
  prospectStatus,
  type ProspectInput,
} from "@/lib/prospects";
import type { ActionResult } from "@/lib/types";

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
export async function saveProspect(
  id: string | null,
  raw: ProspectInput,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const data = prospectSchema.parse(raw);
    if (id) {
      z.string().uuid().parse(id);
      const rows =
        await sql`update reseller_prospects set ${sql(data)} where id=${id} returning id`;
      if (!rows.length)
        return { ok: false, error: "Prospektet finns inte längre." };
    } else {
      const [row] = await sql<
        { id: string }[]
      >`insert into reseller_prospects ${sql({ ...data, created_by: user.id })} returning id`;
      id = row.id;
    }
    revalidatePath("/aterforsaljare");
    return { ok: true, id, message: "Prospektet sparades" };
  } catch (e) {
    return fail(e);
  }
}
export async function updateProspectStatus(
  id: string,
  status: "red" | "yellow" | "green" | null,
): Promise<ActionResult> {
  try {
    await requireUser();
    z.string().uuid().parse(id);
    const value = prospectStatus.parse(status);
    const rows =
      await sql`update reseller_prospects set status=${value} where id=${id} returning id`;
    if (!rows.length)
      return { ok: false, error: "Prospektet finns inte längre." };
    revalidatePath("/aterforsaljare");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
export async function updateProspectContacted(
  id: string,
  contacted: boolean,
): Promise<ActionResult> {
  try {
    await requireUser();
    z.string().uuid().parse(id);
    z.boolean().parse(contacted);
    const rows =
      await sql`update reseller_prospects set contacted=${contacted} where id=${id} returning id`;
    if (!rows.length)
      return { ok: false, error: "Prospektet finns inte längre." };
    revalidatePath("/aterforsaljare");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
