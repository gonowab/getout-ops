import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getInvoicePdf } from "@/lib/storage";

// Öppnar fakturans PDF. Kräver inloggning; länken till Supabase gäller i 60 sekunder.
export async function GET(_req: Request, ctx: RouteContext<"/api/faktura/[orderId]">) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Inte inloggad", { status: 401 });

  const { orderId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return new NextResponse("Ogiltig order", { status: 400 });

  const [o] = await sql<{ invoice_pdf_path: string | null; invoice_number: string | null }[]>`
    select invoice_pdf_path, invoice_number from orders where id = ${orderId}`;
  if (!o?.invoice_pdf_path) return new NextResponse("Ingen PDF uppladdad", { status: 404 });

  const file = await getInvoicePdf(o.invoice_pdf_path);
  if (!file) return new NextResponse("PDF:en hittades inte", { status: 404 });
  if ("url" in file) return NextResponse.redirect(file.url);

  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="faktura-${o.invoice_number ?? "order"}.pdf"`,
    },
  });
}
