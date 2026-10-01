"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { ActionResult } from "@/lib/types";

/** Flytta webbshoppens variant i en region mellan gammal och ny ask */
export async function setShopifyEdition(region: string, edition: "gammal" | "ny"): Promise<ActionResult> {
  try {
    await requireUser();
    z.enum(["gammal", "ny"]).parse(edition);
    await sql.begin(async (tx) => {
      const rows = await tx<{ id: number; edition: string; shopify_variant_id: string | null }[]>`
        select id, edition, shopify_variant_id from products where region = ${region} for update`;
      const variant = rows.find((r) => r.shopify_variant_id)?.shopify_variant_id;
      if (!variant) throw new Error(`Ingen Shopify-variant är kopplad till ${region}. Kör databasuppdateringen 0002 först.`);
      const target = rows.find((r) => r.edition === edition);
      if (!target) throw new Error("Produkten finns inte");
      await tx`update products set shopify_variant_id = null where region = ${region}`;
      await tx`update products set shopify_variant_id = ${variant} where id = ${target.id}`;
    });
    revalidatePath("/", "layout");
    return { ok: true, message: `Webbshoppens ${region}-ordrar drar nu från ${edition === "gammal" ? "gamla" : "nya"} askar` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
