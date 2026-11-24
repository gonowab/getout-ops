import { notFound } from "next/navigation";
import { ButtonLink, PageHeader, buttonClass } from "@/components/ui";
import { requireExpenseManager } from "@/lib/expense-access";
import { expenseIdPattern, formatExpenseAmount, pdfReceiptHeader, type ExpenseStatus } from "@/lib/expenses";
import { dateTime } from "@/lib/format";
import { sql } from "@/lib/db";
import { ExpenseStatusForm } from "./status-form";

export default async function ExpenseDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireExpenseManager();
  const { id } = await params;
  if (!expenseIdPattern.test(id)) notFound();

  const [expense] = await sql<{
    expense_number: string; person: string; reason: string; amount_ore: number; created_at: Date; status: ExpenseStatus;
    status_updated_at: Date | null; receipt_is_pdf: boolean;
  }[]>`
    select expense_number, person, reason, amount_ore, created_at, status, status_updated_at,
      substring(receipt from 1 for ${pdfReceiptHeader.length}) = convert_to(${pdfReceiptHeader}, 'UTF8') as receipt_is_pdf
    from public.expenses where id = ${id}`;
  if (!expense) notFound();
  const receiptUrl = `/api/utlagg/${id}/kvitto`;

  return (
    <>
      <PageHeader title={`Utlägg nr ${expense.expense_number} · ${expense.person}`} description={`Inskickat ${dateTime(expense.created_at)}`}
        actions={<ButtonLink href="/utlagg/hantera">Tillbaka till översikten</ButtonLink>} />
      <div className="grid max-w-4xl items-start gap-4 md:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-line bg-surface p-5">
          <dl className="space-y-3 text-sm">
            <div><dt className="text-muted">Anledning</dt><dd className="break-words">{expense.reason}</dd></div>
            <div><dt className="text-muted">Totalt</dt><dd className="text-xl font-semibold">{formatExpenseAmount(expense.amount_ore)}</dd></div>
          </dl>
          <ExpenseStatusForm key={expense.status} id={id} status={expense.status} />
          {expense.status_updated_at && <p className="text-xs text-muted">Status ändrad {dateTime(expense.status_updated_at)}</p>}
        </section>
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold">Kvitto</h2>
          {!expense.receipt_is_pdf && (
            <a href={receiptUrl} target="_blank" rel="noreferrer" className="block w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element -- Kvittot kräver den inloggade användarens session. */}
              <img src={receiptUrl} alt="Öppna kvittot i full storlek" className="max-h-[65vh] max-w-full rounded-md border border-line object-contain" />
            </a>
          )}
          <a href={`${receiptUrl}?download=1`} className={buttonClass("secondary", "md", expense.receipt_is_pdf ? undefined : "mt-3")}>
            {expense.receipt_is_pdf ? "Ladda ner kvitto (PDF)" : "Ladda ner kvitto (JPG)"}
          </a>
        </section>
      </div>
    </>
  );
}
