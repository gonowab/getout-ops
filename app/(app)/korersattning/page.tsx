import { ButtonLink, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { canManageExpenses } from "@/lib/expense-access";

export default async function MileagePage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Körersättning" description="Registrera körda kilometer och fördela ersättningen." />
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/korersattning/ny" variant="primary" className="max-md:h-11">Ny resa</ButtonLink>
        {canManageExpenses(user) && <ButtonLink href="/korersattning/hantera" className="max-md:h-11">Hantera körersättning</ButtonLink>}
      </div>
    </>
  );
}
