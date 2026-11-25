import { ButtonLink, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { MileageWizard } from "./wizard";

export default async function NewMileagePage() {
  await requireUser();
  return (
    <>
      <PageHeader title="Ny resa" actions={<ButtonLink href="/korersattning">Tillbaka</ButtonLink>} />
      <MileageWizard today={todayISO()} routeEnabled={Boolean(process.env.GOOGLE_ROUTES_API_KEY)} />
    </>
  );
}
