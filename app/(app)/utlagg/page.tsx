import { ClipboardList, Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { canManageExpenses } from "@/lib/expense-access";

export default async function ExpensesPage() {
  const user = await requireUser();
  const options = [
    { href: "/utlagg/nytt", label: "Nytt utlägg", description: "Registrera ett köp du har betalat själv.", icon: Plus },
  ];
  if (canManageExpenses(user)) {
    options.push({ href: "/utlagg/hantera", label: "Hantera utlägg", description: "Granska kvitton och följ upp utbetalningar.", icon: ClipboardList });
  }

  return (
    <>
      <PageHeader title="Utlägg" />
      <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
        {options.map(({ href, label, description, icon: Icon }) => (
          <Link key={href} href={href} className="rounded-xl border border-line bg-surface p-5 hover:border-line-strong hover:bg-hover">
            <Icon className="mb-3 size-5 text-muted" aria-hidden />
            <h2 className="font-semibold">{label}</h2>
            <p className="mt-1 text-sm text-muted">{description}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
