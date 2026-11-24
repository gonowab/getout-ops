import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { canManageExpenses } from "@/lib/expense-access";
import { expenseIdPattern } from "@/lib/expenses";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  if (!user || !canManageExpenses(user) || !expenseIdPattern.test(id)) {
    return new Response(null, { status: 404 });
  }
  const [expense] = await sql<{ receipt: Buffer }[]>`select receipt from public.expenses where id = ${id}`;
  if (!expense) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(expense.receipt), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Disposition": 'inline; filename="kvitto.jpg"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
