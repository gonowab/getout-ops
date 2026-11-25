import { ButtonLink, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import type { MileageAddress } from "@/lib/mileage";
import { todayISO } from "@/lib/format";
import { MileageWizard } from "./wizard";

export default async function NewMileagePage() {
  await requireUser();
  const addresses = await sql<MileageAddress[]>`select id, name, address from public.mileage_addresses order by name`;
  return (
    <>
      <PageHeader title="Ny resa" actions={<ButtonLink href="/korersattning">Tillbaka</ButtonLink>} />
      <MileageWizard initialAddresses={addresses} today={todayISO()} routeEnabled={Boolean(process.env.GOOGLE_ROUTES_API_KEY)} />
    </>
  );
}
