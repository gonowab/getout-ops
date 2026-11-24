import Link from "next/link";
import { ButtonLink, PageHeader, cn } from "@/components/ui";
import { requireExpenseManager } from "@/lib/expense-access";
import { formatExpenseAmount, type ExpenseStatus } from "@/lib/expenses";
import { dateTime } from "@/lib/format";
import { sql } from "@/lib/db";

const statusGroups = [
  { status: "pending", id: "att-ersatta", label: "Att ersätta", tone: "bg-warn-soft text-warn" },
  { status: "paid", id: "utbetalda", label: "Utbetalda", tone: "bg-brand-soft text-brand-strong" },
  { status: "rejected", id: "avslagna", label: "Avslagna", tone: "bg-danger-soft text-danger" },
] satisfies { status: ExpenseStatus; id: string; label: string; tone: string }[];

export default async function ManageExpensesPage() {
  await requireExpenseManager();
  const expenses = await sql<{
    id: string; expense_number: string; person: string; reason: string; amount_ore: number;
    created_at: Date; status: ExpenseStatus;
  }[]>`
    select id, expense_number, person, reason, amount_ore, created_at, status
    from public.expenses
    order by created_at desc, id desc`;

  const groups = statusGroups.map((group) => {
    const items = expenses.filter((expense) => expense.status === group.status);
    const total = items.reduce((sum, expense) => sum + expense.amount_ore, 0);
    return { ...group, items, total };
  });

  return (
    <>
      <PageHeader title="Hantera utlägg" actions={<ButtonLink href="/utlagg">Tillbaka till Utlägg</ButtonLink>} />
      <nav aria-label="Hoppa till utläggsstatus" className="mb-6 grid gap-2 sm:grid-cols-3">
        {groups.map(({ id, label, tone, items }) => (
          <a key={id} href={`#${id}`} className={cn("flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:underline", tone)}>
            <span>{label}</span>
            <span className="tabular" aria-label={`${items.length} utlägg`}>{items.length}</span>
          </a>
        ))}
      </nav>

      <div className="space-y-5">
        {groups.map(({ id, label, tone, items, total }) => (
          <section key={id} id={id} aria-labelledby={`${id}-rubrik`} className="scroll-mt-4 overflow-hidden rounded-lg border border-line bg-surface">
            <div className={cn("flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3", tone)}>
              <h2 id={`${id}-rubrik`} className="text-sm font-semibold">{label}</h2>
              <p className="text-sm font-semibold tabular">{formatExpenseAmount(total)}</p>
            </div>
            {items.length ? (
              <ul className="divide-y divide-line">
                {items.map((expense) => (
                  <li key={expense.id}>
                    <Link href={`/utlagg/hantera/${expense.id}`}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 hover:bg-hover">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">Utlägg nr {expense.expense_number} · {expense.person}</p>
                        <p className="break-words text-sm text-ink">{expense.reason}</p>
                        <p className="mt-1 text-xs text-muted">{dateTime(expense.created_at)}</p>
                      </div>
                      <p className="text-right text-sm font-semibold tabular">{formatExpenseAmount(expense.amount_ore)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-3 text-sm text-muted">Inga utlägg i den här gruppen.</p>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
