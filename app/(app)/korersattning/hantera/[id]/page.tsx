import { notFound } from "next/navigation";
import { ButtonLink, PageHeader } from "@/components/ui";
import { updateMileageStatus } from "@/lib/actions/mileage";
import { requireExpenseManager } from "@/lib/expense-access";
import { expenseIdPattern, formatExpenseAmount, type ExpenseStatus } from "@/lib/expenses";
import { sql } from "@/lib/db";
import { shortDate } from "@/lib/format";
import { mileageTripKinds, type mileageAmounts, type MileageTripKind } from "@/lib/mileage";
import { ExpenseStatusForm } from "../../../utlagg/hantera/[id]/status-form";
import { MileagePayouts } from "../../payouts";

export default async function MileageDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireExpenseManager();
  const { id } = await params;
  if (!expenseIdPattern.test(id)) notFound();

  const [claim] = await sql<{
    driver: string; travel_date: string; origin: string; destination: string; distance_tenths: number;
    purpose: string; trip_kind: MileageTripKind | null; fuel_ore: number; fuel_payer: string | null; amounts: ReturnType<typeof mileageAmounts>; status: ExpenseStatus;
  }[]>`
    select driver, travel_date, origin, destination, distance_tenths, purpose, trip_kind, fuel_ore, fuel_payer, amounts, status
    from public.mileage_claims where id = ${id}`;
  if (!claim) notFound();

  return (
    <>
      <PageHeader title="Resa" description={`${claim.driver} · ${shortDate(claim.travel_date)}`}
        actions={<ButtonLink href="/korersattning/hantera">Tillbaka till översikten</ButtonLink>} />
      <div className="grid max-w-4xl items-start gap-4 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-line bg-surface p-5">
          <dl className="space-y-2 text-sm">
            <div><dt className="text-muted">Från</dt><dd className="break-words">{claim.origin}</dd></div>
            <div><dt className="text-muted">Till</dt><dd className="break-words">{claim.destination}</dd></div>
            <div><dt className="text-muted">Typ av resa</dt><dd>{claim.trip_kind ? mileageTripKinds[claim.trip_kind] : "Ej registrerad"}</dd></div>
            <div><dt className="text-muted">Syfte</dt><dd className="break-words">{claim.purpose}</dd></div>
            <div><dt className="text-muted">Körd sträcka</dt><dd>{(claim.distance_tenths / 10).toLocaleString("sv-SE")} km</dd></div>
            <div><dt className="text-muted">Betald bensin</dt><dd>{formatExpenseAmount(claim.fuel_ore)}{claim.fuel_payer && ` · ${claim.fuel_payer}`}</dd></div>
          </dl>
          <ExpenseStatusForm key={claim.status} id={id} status={claim.status} saveStatusAction={updateMileageStatus} />
        </section>
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-3 font-semibold">Fördelning</h2>
          <MileagePayouts amounts={claim.amounts} />
        </section>
      </div>
    </>
  );
}
