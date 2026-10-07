import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { fetchLabels } from "@/lib/postnord";

// PostNord-etiketter som PDF för en eller flera bokade ordrar: /api/etiketter?ordrar=1016,1017
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Inte inloggad", { status: 401 });

  const numbers = (new URL(req.url).searchParams.get("ordrar") ?? "")
    .split(",")
    .map((n) => parseInt(n.replace(/\D/g, ""), 10))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 100);
  if (numbers.length === 0) return new NextResponse("Inga ordrar valda", { status: 400 });

  const rows = await sql<{ tracking_number: string }[]>`
    select tracking_number from orders
    where order_number in ${sql(numbers)} and postnord_booked_at is not null and tracking_number is not null
    order by order_number`;
  if (rows.length === 0) return new NextResponse("Ordrarna är inte bokade hos PostNord", { status: 404 });

  try {
    const pdf = await fetchLabels(rows.map((r) => r.tracking_number));
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="etiketter-${numbers.join("-").slice(0, 60)}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return new NextResponse(e instanceof Error ? e.message : "Kunde inte hämta etiketterna", { status: 502 });
  }
}
