import Link from "next/link";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { requireExpenseManager } from "@/lib/expense-access";
import { expenseStatuses, formatExpenseAmount, type ExpenseStatus } from "@/lib/expenses";
import { dateTime } from "@/lib/format";
import { sql } from "@/lib/db";

export default async function ManageExpensesPage() {
  await requireExpenseManager();
  const expenses = await sql<{
    id: string; expense_number: string; person: string; reason: string; amount_ore: number;
    created_at: Date; status: ExpenseStatus;
  }[]>`
    select id, expense_number, person, reason, amount_ore, created_at, status
    from public.expenses
    order by (status = 'pending') desc, created_at desc, id desc`;

  const pending = expenses.filter((expense) => expense.status === "pending");
  const total = pending.reduce((sum, expense) => sum + expense.amount_ore, 0);

  return (
    <>
      <PageHeader title="Hantera utlägg" actions={<ButtonLink href="/utlagg">Tillbaka till Utlägg</ButtonLink>} />
      <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-line bg-surface px-4 py-3">
        <strong className="text-lg tabular">{formatExpenseAmount(total)}</strong>
        <span className="text-sm text-muted">{pending.length} utlägg att ersätta</span>
      </div>
      {expenses.length ? (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {expenses.map((expense) => (
            <li key={expense.id}>
              <Link href={`/utlagg/hantera/${expense.id}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 hover:bg-hover">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Utlägg nr {expense.expense_number} · {expense.person}</p>
                  <p className="break-words text-sm text-ink">{expense.reason}</p>
                  <p className="mt-1 text-xs text-muted">{dateTime(expense.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular">{formatExpenseAmount(expense.amount_ore)}</p>
                  <p className="mt-1 text-xs text-muted">{expenseStatuses[expense.status]}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : <EmptyState title="Inga utlägg har skickats in än" />}
    </>
  );
}
