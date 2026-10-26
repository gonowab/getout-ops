import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { testLabel } from "@/lib/postnord";

// Testbokning hos PostNord till oss själva. Öppnar testetiketten som PDF (eller visar felet).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Inte inloggad", { status: 401 });

  try {
    const result = await testLabel();
    if (!result.labelPdf) {
      return new NextResponse(
        `Testbokningen gick igenom (kolli-ID ${result.trackingNumber}), men PostNord skickade ingen etikett.`,
        { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } },
      );
    }
    return new NextResponse(new Uint8Array(result.labelPdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="postnord-test-${result.trackingNumber}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new NextResponse(`Testbokningen misslyckades:\n\n${message}`, {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
