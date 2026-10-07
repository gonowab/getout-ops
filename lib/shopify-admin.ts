import "server-only";

/*
 * GetOut Operations → Shopify
 *
 * Appen "GetOut ops" i Shopifys Dev Dashboard ger oss en nyckel via client credentials:
 * SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET byts mot en åtkomstnyckel som gäller ett dygn.
 * Behörigheter som appen behöver: read_orders, read_merchant_managed_fulfillment_orders,
 * write_merchant_managed_fulfillment_orders.
 */

const API_VERSION = "2026-07";

type Token = { value: string; expiresAt: number };
let cached: Token | null = null;

export function isShopifyAdminConfigured() {
  return Boolean(process.env.SHOPIFY_SHOP && process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET);
}

/** "getout" eller "getout.myshopify.com" eller en hel adress → "getout.myshopify.com" */
function shopDomain() {
  const raw = (process.env.SHOPIFY_SHOP ?? "").trim().toLowerCase();
  const host = raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!host) throw new Error("SHOPIFY_SHOP saknas i Vercel");
  return host.endsWith(".myshopify.com") ? host : `${host}.myshopify.com`;
}

async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value;
  if (!isShopifyAdminConfigured()) {
    throw new Error("Shopify-kopplingen är inte inställd (SHOPIFY_SHOP, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET)");
  }
  const res = await fetch(`https://${shopDomain()}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.SHOPIFY_CLIENT_ID!,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET!,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Shopify godkände inte inloggningen (${res.status}). Kontrollera Client ID/secret och att appen är installerad. ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in?: number };
  cached = { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 86_399) * 1000 };
  return cached.value;
}

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://${shopDomain()}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": await accessToken() },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (res.status === 401) cached = null;
  const json = (await res.json().catch(() => ({}))) as { data?: T; errors?: { message: string }[] };
  if (!res.ok || json.errors?.length) {
    throw new Error(`Shopify svarade med fel: ${json.errors?.map((e) => e.message).join("; ") ?? res.status}`);
  }
  return json.data as T;
}

export const postnordTrackingUrl = (trackingNumber: string) =>
  `https://tracking.postnord.com/se/?id=${encodeURIComponent(trackingNumber)}`;

type FulfillmentOrders = {
  order: {
    id: string;
    name: string;
    displayFulfillmentStatus: string;
    fulfillmentOrders: { nodes: { id: string; status: string }[] };
  } | null;
};

/**
 * Markerar Shopify-ordern som skickad med PostNord-spårning.
 * Shopify mejlar kunden sin leveransbekräftelse med spårningslänken.
 * Returnerar "redan" om ordern redan var helt skickad i Shopify.
 */
export async function fulfillWithTracking(
  shopifyOrderId: string,
  trackingNumber: string,
  notifyCustomer = true,
): Promise<"skickad" | "redan"> {
  const id = shopifyOrderId.startsWith("gid://") ? shopifyOrderId : `gid://shopify/Order/${shopifyOrderId}`;

  const data = await gql<FulfillmentOrders>(
    `query OrderFulfillmentOrders($id: ID!) {
      order(id: $id) {
        id
        name
        displayFulfillmentStatus
        fulfillmentOrders(first: 10) { nodes { id status } }
      }
    }`,
    { id },
  );
  if (!data.order) throw new Error("Ordern finns inte i Shopify");

  const open = data.order.fulfillmentOrders.nodes.filter((f) => ["OPEN", "IN_PROGRESS"].includes(f.status));
  if (open.length === 0) {
    if (data.order.displayFulfillmentStatus === "FULFILLED") return "redan";
    throw new Error(`Ordern ${data.order.name} har inget att skicka i Shopify (${data.order.displayFulfillmentStatus})`);
  }

  const result = await gql<{
    fulfillmentCreate: { fulfillment: { id: string } | null; userErrors: { field: string[] | null; message: string }[] };
  }>(
    `mutation CreateFulfillment($fulfillment: FulfillmentInput!) {
      fulfillmentCreate(fulfillment: $fulfillment) {
        fulfillment { id }
        userErrors { field message }
      }
    }`,
    {
      fulfillment: {
        lineItemsByFulfillmentOrder: open.map((f) => ({ fulfillmentOrderId: f.id })),
        notifyCustomer,
        trackingInfo: {
          company: "PostNord SE",
          number: trackingNumber,
          url: postnordTrackingUrl(trackingNumber),
        },
      },
    },
  );
  const errors = result.fulfillmentCreate.userErrors;
  if (errors.length) throw new Error(`Shopify: ${errors.map((e) => e.message).join("; ")}`);
  return "skickad";
}
