import { getCurrentUser } from "@/lib/auth";
import { canManageExpenses } from "@/lib/expense-access";
import { expenseIdPattern } from "@/lib/expenses";
import { createMileagePdf, type MileagePdfTrip } from "@/lib/mileage-pdf";
import { sql } from "@/lib/db";
import { todayISO } from "@/lib/format";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Logga in för att ladda ner underlaget.", { status: 401 });
  if (!canManageExpenses(user)) return new Response("Du saknar behörighet till körersättningen.", { status: 403 });

  const form = await request.formData().catch(() => null);
  const values = form?.getAll("resor") ?? [];
  if (values.length === 0 || values.length > 500 || values.some((id) => typeof id !== "string" || !expenseIdPattern.test(id))) {
    return new Response("Markera mellan 1 och 500 resor som ska ingå i underlaget.", { status: 400 });
  }
  const ids = [...new Set(values.map(String))];

  try {
    const trips = await sql<MileagePdfTrip[]>`
      select travel_date, driver, purpose, origin, destination, trip_kind, distance_tenths,
        (amounts->>'mileageOre')::int as mileage_ore
      from public.mileage_claims
      where id in ${sql(ids)}
      order by travel_date, created_at, id`;
    if (trips.length !== ids.length) return new Response("En markerad resa saknas. Uppdatera översikten och försök igen.", { status: 404 });

    const date = todayISO();
    return new Response(new Uint8Array(await createMileagePdf(trips, date)), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="milersattningsunderlag-${date}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[mileage] Kunde inte skapa underlag", error instanceof Error ? error.message : "");
    return new Response("Det gick inte att skapa PDF-underlaget. Försök igen.", { status: 500 });
  }
}
