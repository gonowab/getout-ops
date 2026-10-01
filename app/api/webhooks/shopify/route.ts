import { NextResponse } from "next/server";
import { logShopifyError, processShopifyOrder, verifyShopifyHmac, type ShopifyOrder } from "@/lib/shopify";

// Tar emot Shopifys order-webhooks (orders/create, orders/updated, orders/paid,
// orders/fulfilled, orders/cancelled). Kräver ingen inloggning – skyddas av signaturen.
const HANDLED = new Set(["orders/create", "orders/updated", "orders/paid", "orders/fulfilled", "orders/cancelled"]);

export async function POST(request: Request) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[shopify] SHOPIFY_WEBHOOK_SECRET saknas");
    return NextResponse.json({ error: "Inte konfigurerad" }, { status: 500 });
  }

  const raw = await request.text();
  if (!verifyShopifyHmac(raw, request.headers.get("x-shopify-hmac-sha256"), secret)) {
    return NextResponse.json({ error: "Ogiltig signatur" }, { status: 401 });
  }

  const topic = request.headers.get("x-shopify-topic") ?? "okänd";
  const webhookId = request.headers.get("x-shopify-webhook-id") ?? request.headers.get("x-shopify-event-id");
  if (!HANDLED.has(topic)) return NextResponse.json({ ok: true, ignored: topic });

  let order: ShopifyOrder | null = null;
  try {
    order = JSON.parse(raw) as ShopifyOrder;
    if (order?.id == null) throw new Error("Ordern saknar id");
    const result = await processShopifyOrder(topic, order, webhookId);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[shopify]", topic, order?.name, message);
    await logShopifyError(topic, webhookId, order, message);
    // 500 gör att Shopify försöker igen senare (upp till 8 gånger under 4 timmar)
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
