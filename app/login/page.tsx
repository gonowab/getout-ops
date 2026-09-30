import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isDevAuth, isSupabaseConfigured } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata = { title: "Logga in" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user || isDevAuth()) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-[360px]">
        <div className="mb-8 text-center">
          <div className="text-[26px] font-bold tracking-[-0.02em]">
            <span className="text-black">Get</span>
            <span className="text-brand">Out</span>
          </div>
          <p className="mt-1 text-[13px] text-muted">Lager och ordrar</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          {isSupabaseConfigured() ? (
            <LoginForm />
          ) : (
            <p className="text-[13px] text-muted">
              Inloggningen är inte kopplad än. Lägg in Supabase-nycklarna i Vercel enligt SETUP.md.
            </p>
          )}
        </div>
        <p className="mt-6 text-center text-[12px] text-subtle">
          Konton skapas av en administratör i Supabase.
        </p>
      </div>
    </div>
  );
}
