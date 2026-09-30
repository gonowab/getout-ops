import { NextResponse } from "next/server";
import { connection } from "next/server";

// Tillfällig felsökning: visar vilken version som körs och OM variablerna finns – aldrig deras värden.
export async function GET() {
  await connection();
  const has = (v: string | undefined) => (v && v.trim().length > 0 ? "finns" : v === "" ? "tom" : "saknas");
  return NextResponse.json({
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    miljo: process.env.VERCEL_ENV ?? null,
    DATABASE_URL: has(process.env.DATABASE_URL),
    NEXT_PUBLIC_SUPABASE_URL: has(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: has(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    SUPABASE_SECRET_KEY: has(process.env.SUPABASE_SECRET_KEY),
    antal_variabler: Object.keys(process.env).length,
  });
}
