import "server-only";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { isDevAuth } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

const getOutProductionManager = {
  id: "32d60d12-fb7c-48e8-b2ae-9f682cab5627",
  email: "info@getout.nu",
};

export function canManageExpenses(user: CurrentUser) {
  if (isDevAuth()) return true;
  const email = user.email?.toLowerCase();
  const adminEmail = process.env.EXPENSE_ADMIN_EMAIL?.trim().toLowerCase();
  if (adminEmail) return email === adminEmail;
  return process.env.VERCEL_ENV === "production"
    && process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") === "https://tkpewthgpyvohtswlbfp.supabase.co"
    && user.id === getOutProductionManager.id
    && email === getOutProductionManager.email;
}

export async function requireExpenseManager() {
  const user = await requireUser();
  if (!canManageExpenses(user)) notFound();
  return user;
}
