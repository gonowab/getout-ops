import "server-only";
import { connection } from "next/server";
import { sql } from "@/lib/db";

/**
 * Kontrollerar databasanslutningen och översätter vanliga fel till något begripligt.
 * Returnerar null om allt fungerar. Visar aldrig lösenord eller anslutningssträng.
 */
export async function checkDatabase(): Promise<{ title: string; hint: string; detail: string } | null> {
  await connection();
  if (!process.env.DATABASE_URL) {
    return {
      title: "DATABASE_URL saknas",
      hint: "Lägg in anslutningssträngen i Vercel och driftsätt igen.",
      detail: "",
    };
  }
  try {
    await sql`select count(*) from products`;
    return null;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    const raw = String(err.message ?? e)
      .replace(/postgres(ql)?:\/\/\S+/gi, "[anslutningssträng dold]")
      .slice(0, 300);
    const code = err.code ?? "";

    if (code === "28P01" || /password authentication failed/i.test(raw))
      return {
        title: "Fel lösenord i DATABASE_URL",
        hint: "Lösenordet i anslutningssträngen stämmer inte med databaslösenordet i Supabase. Byt ut det i Vercel (eller återställ lösenordet i Supabase) och driftsätt igen.",
        detail: raw,
      };
    if (/tenant or user not found/i.test(raw))
      return {
        title: "Supabase känner inte igen användaren",
        hint: "Kontrollera att strängen börjar med postgres.<projekt-ID> och att adressen är Transaction pooler (port 6543).",
        detail: raw,
      };
    if (code === "42P01" || /does not exist/i.test(raw))
      return {
        title: "Tabellerna saknas",
        hint: "Kör supabase/migrations/0001_init.sql i Supabase SQL Editor.",
        detail: raw,
      };
    if (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|timeout/i.test(raw) || /ENOTFOUND|ETIMEDOUT|ECONNREFUSED/.test(code))
      return {
        title: "Databasen går inte att nå",
        hint: "Kontrollera att adressen i DATABASE_URL är Transaction pooler (…pooler.supabase.com:6543), inte Direct connection.",
        detail: raw,
      };
    return { title: "Databasfel", hint: "Skicka felet nedan till den som sköter systemet.", detail: raw };
  }
}
