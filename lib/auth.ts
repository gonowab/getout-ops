import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { createSupabaseServerClient, isDevAuth, isSupabaseConfigured } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string | null; name: string };

const DEV_USER: CurrentUser = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "dev@getout.local",
  name: "Testanvändare",
};

/** Inloggad användare, eller null. Skapar profilen vid första besöket. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Allt i appen är inloggat och ska alltid renderas per förfrågan, aldrig i förväg
  await connection();
  if (isDevAuth()) return DEV_USER;
  if (!isSupabaseConfigured()) return null;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const u = data.user;
  if (!u) return null;

  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const fallback = (u.email ?? "Användare").split("@")[0];
  const name =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    fallback.charAt(0).toUpperCase() + fallback.slice(1);

  const [profile] = await sql<{ full_name: string }[]>`
    insert into profiles (id, full_name, email)
    values (${u.id}, ${name}, ${u.email ?? null})
    on conflict (id) do update set email = excluded.email
    returning full_name`;

  return { id: u.id, email: u.email ?? null, name: profile.full_name };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
