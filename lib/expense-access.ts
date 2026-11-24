import "server-only";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { isDevAuth } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export function canManageExpenses(user: CurrentUser) {
  const adminEmail = process.env.EXPENSE_ADMIN_EMAIL?.trim().toLowerCase();
  return isDevAuth() || Boolean(adminEmail && user.email?.toLowerCase() === adminEmail);
}

export async function requireExpenseManager() {
  const user = await requireUser();
  if (!canManageExpenses(user)) notFound();
  return user;
}
