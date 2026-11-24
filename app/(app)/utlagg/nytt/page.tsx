import { ButtonLink, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { ExpenseWizard } from "./wizard";

export default async function NewExpensePage() {
  await requireUser();
  return (
    <>
      <PageHeader title="Nytt utlägg" actions={<ButtonLink href="/utlagg">Alla val</ButtonLink>} />
      <ExpenseWizard />
    </>
  );
}
