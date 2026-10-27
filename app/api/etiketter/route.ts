import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { fetchLabels } from "@/lib/postnord";

// PostNord-etiketter som en PDF för en eller flera bokade ordrar: /api/etiketter?ordrar=1016,1017
// Etiketten sparas vid bokningen; saknas den hämtas den från PostNord.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Inte inloggad", { status: 401 });

  const numbers = (new URL(req.url).searchParams.get("ordrar") ?? "")
    .split(",")
    .map((n) => parseInt(n.replace(/\D/g, ""), 10))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 100);
  if (numbers.length === 0) return new NextResponse("Inga ordrar valda", { status: 400 });

  const rows = await sql<{ id: string; order_number: number; tracking_number: string }[]>`
    select id, order_number, tracking_number from orders
    where order_number in ${sql(numbers)} and postnord_booked_at is not null and tracking_number is not null
    order by order_number`;
  if (rows.length === 0) return new NextResponse("Ordrarna är inte bokade hos PostNord", { status: 404 });

  let stored = new Map<string, Buffer>();
  try {
    const saved = await sql<{ order_id: string; pdf: Buffer }[]>`
      select order_id, pdf from postnord_labels where order_id in ${sql(rows.map((r) => r.id))}`;
    stored = new Map(saved.map((s) => [s.order_id, s.pdf]));
  } catch {
    // Tabellen finns inte än (0007 inte körd) – hämta allt från PostNord
  }

  try {
    const pdfs: Buffer[] = [];
    const missing = rows.filter((r) => !stored.has(r.id));
    for (const r of rows) {
      const pdf = stored.get(r.id);
      if (pdf) pdfs.push(pdf);
    }
    if (missing.length) pdfs.push(await fetchLabels(missing.map((r) => r.tracking_number)));

    const out = pdfs.length === 1 ? pdfs[0] : await mergePdfs(pdfs);
    return new NextResponse(new Uint8Array(out), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="etiketter-${numbers.join("-").slice(0, 60)}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return new NextResponse(e instanceof Error ? e.message : "Kunde inte hämta etiketterna", {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

async function mergePdfs(pdfs: Buffer[]) {
  const merged = await PDFDocument.create();
  for (const bytes of pdfs) {
    const doc = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }
  return Buffer.from(await merged.save());
}
