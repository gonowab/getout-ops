import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { canManageExpenses } from "@/lib/expense-access";
import { expenseIdPattern, formatExpenseAmount, pdfReceiptHeader, pdfReceiptType } from "@/lib/expenses";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  if (!user || !canManageExpenses(user) || !expenseIdPattern.test(id)) {
    return new Response(null, { status: 404 });
  }
  const [expense] = await sql<{ receipt: Buffer; person: string; amount_ore: number }[]>`
    select receipt, person, amount_ore from public.expenses where id = ${id}`;
  if (!expense) return new Response(null, { status: 404 });
  const isPdf = expense.receipt.toString("ascii", 0, pdfReceiptHeader.length) === pdfReceiptHeader;
  const amount = formatExpenseAmount(expense.amount_ore).replace(/\s/g, " ").replace(/,00(?= kr$)/, "");
  const filename = `kvitto ${expense.person} ${amount}.${isPdf ? "pdf" : "jpg"}`;
  const disposition = isPdf || new URL(request.url).searchParams.has("download") ? "attachment" : "inline";
  return new Response(new Uint8Array(expense.receipt), {
    headers: {
      "Content-Type": isPdf ? pdfReceiptType : "image/jpeg",
      "Content-Disposition": `${disposition}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
