import Link from "next/link";
import { ButtonLink, PageHeader } from "@/components/ui";
import { sql } from "@/lib/db";
import { requireExpenseManager } from "@/lib/expense-access";
import { formatExpenseAmount, type ExpenseStatus } from "@/lib/expenses";
import { shortDate } from "@/lib/format";

const groups = [
  ["pending", "Att ersätta"],
  ["paid", "Utbetalda"],
  ["rejected", "Avslagna"],
] as const;

export default async function MileageManagementPage() {
  await requireExpenseManager();
  const claims = await sql<{
    id: string; driver: string; origin: string; destination: string; travel_date: string;
    distance_tenths: number; total_ore: number; status: ExpenseStatus;
  }[]>`
    select id, driver, origin, destination, travel_date, distance_tenths, status,
      (amounts->>'totalOre')::int as total_ore
    from public.mileage_claims order by travel_date desc, created_at desc, id desc`;

  return (
    <>
      <PageHeader title="Hantera körersättning" actions={<ButtonLink href="/korersattning">Tillbaka</ButtonLink>} />
      <div className="space-y-5">
        {groups.map(([status, label]) => {
          const rows = claims.filter((claim) => claim.status === status);
          return (
            <section key={status} aria-labelledby={`mileage-${status}`} className="overflow-hidden rounded-lg border border-line bg-surface">
              <div className="flex flex-wrap items-baseline justify-between gap-2 bg-canvas px-4 py-3">
                <h2 id={`mileage-${status}`} className="font-semibold">{label} <span className="font-normal text-muted">· {rows.length}</span></h2>
                <strong>{formatExpenseAmount(rows.reduce((sum, claim) => sum + claim.total_ore, 0))}</strong>
              </div>
              {rows.length === 0 ? <p className="px-4 py-3 text-muted">Inga resor i den här gruppen.</p> : (
                <ul className="divide-y divide-line">
                  {rows.map((claim) => (
                    <li key={claim.id}>
                      <Link href={`/korersattning/hantera/${claim.id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 hover:bg-hover">
                        <div className="min-w-0">
                          <p className="break-words font-medium">{claim.origin} → {claim.destination}</p>
                          <p className="text-xs text-muted">{claim.driver} · {shortDate(claim.travel_date)} · {(claim.distance_tenths / 10).toLocaleString("sv-SE")} km</p>
                        </div>
                        <strong>{formatExpenseAmount(claim.total_ore)}</strong>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
