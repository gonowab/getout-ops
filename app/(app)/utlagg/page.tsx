import { ClipboardList, Plus } from "lucide-react";
import { ActionCards } from "@/components/action-cards";
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
      <ActionCards options={options} />
    </>
  );
}
