import { ClipboardList, Plus } from "lucide-react";
import { ActionCards } from "@/components/action-cards";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { canManageExpenses } from "@/lib/expense-access";

export default async function MileagePage() {
  const user = await requireUser();
  const options = [
    { href: "/korersattning/ny", label: "Ny resa", description: "Registrera en resa och beräkna milersättningen.", icon: Plus },
  ];
  if (canManageExpenses(user)) {
    options.push({
      href: "/korersattning/hantera",
      label: "Hantera körersättning",
      description: "Granska resor, följ upp utbetalningar och ladda ner underlag.",
      icon: ClipboardList,
    });
  }

  return (
    <>
      <PageHeader title="Körersättning" />
      <ActionCards options={options} />
    </>
  );
}
