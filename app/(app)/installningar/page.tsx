import Link from "next/link";
import { PageHeader, cn } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getProducts } from "@/lib/queries";
import { dateTime } from "@/lib/format";
import { isDevAuth } from "@/lib/supabase/server";
import { PasswordForm, ShopifyEditionForm, ThresholdForm } from "./forms";

export const metadata = { title: "Inställningar" };

type ShopifyEvent = {
  id: number;
  topic: string;
  shopify_order_name: string | null;
  outcome: string;
  message: string | null;
  received_at: Date;
  order_number: number | null;
};

const TOPIC: Record<string, string> = {
  "orders/create": "Ny order",
  "orders/updated": "Ändrad",
  "orders/paid": "Betald",
  "orders/fulfilled": "Skickad",
  "orders/cancelled": "Avbruten",
};

export default async function SettingsPage() {
  const [user, products] = await Promise.all([getCurrentUser(), getProducts()]);

  // Shopify-delen tål att databasuppdateringen 0002 inte körts än
  let mapping: { region: string; edition: "gammal" | "ny" | null }[] = [];
  let events: ShopifyEvent[] | null = null;
  try {
    const rows = await sql<{ region: string; edition: "gammal" | "ny"; shopify_variant_id: string | null }[]>`
      select region, edition, shopify_variant_id from products where active order by sort_order`;
    const regions = [...new Set(rows.map((r) => r.region))];
    mapping = regions.map((region) => ({
      region,
      edition: rows.find((r) => r.region === region && r.shopify_variant_id)?.edition ?? null,
    }));
    events = await sql<ShopifyEvent[]>`
      select e.id, e.topic, e.shopify_order_name, e.outcome, e.message, e.received_at, o.order_number
      from shopify_events e left join orders o on o.shopify_order_id = e.shopify_order_id
      order by e.received_at desc, e.id desc limit 15`;
  } catch {
    events = null;
  }

  return (
    <>
      <PageHeader title="Inställningar" />

      <section className="mb-12 max-w-[720px]">
        <h2 className="mb-1 text-[15px] font-semibold">Shopify</h2>
        <p className="mb-4 text-[13px] text-muted">
          Ordrar från webbshoppen kommer in automatiskt och hamnar under Att packa. Välj vilken ask webbshoppens
          försäljning ska dra från. Byt till ny ask när de gamla är slutsålda.
        </p>
        {events === null ? (
          <p className="rounded-md bg-warn-soft px-3 py-2 text-[13px] text-warn">
            Databasuppdateringen för Shopify (0002_shopify.sql) är inte körd än.
          </p>
        ) : (
          <>
            <ShopifyEditionForm mapping={mapping} />

            <h3 className="mb-2 mt-8 text-[13px] font-semibold">Senast från Shopify</h3>
            {events.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-4 py-3 text-[13px] text-muted">
                Inget har kommit från Shopify än. När en order läggs eller ändras i webbshoppen syns den här.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full whitespace-nowrap text-[13px]">
                  <tbody>
                    {events.map((e) => (
                      <tr key={e.id} className="border-t border-line first:border-t-0">
                        <td className="px-4 py-2 text-muted tabular">{dateTime(e.received_at)}</td>
                        <td className="px-4 py-2">
                          {e.order_number ? (
                            <Link href={`/ordrar/${e.order_number}`} prefetch={false} className="font-medium hover:underline">
                              {e.shopify_order_name}
                            </Link>
                          ) : (
                            <span className="font-medium">{e.shopify_order_name ?? "–"}</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-muted">{TOPIC[e.topic] ?? e.topic}</td>
                        <td
                          className={cn(
                            "px-4 py-2",
                            e.outcome === "fel" ? "font-medium text-danger" : e.outcome === "importerad" ? "text-brand-strong" : "text-muted",
                          )}
                        >
                          {e.outcome.charAt(0).toUpperCase() + e.outcome.slice(1)}
                          {e.message ? <span className="ml-1.5 text-muted">{e.message}</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      <section className="mb-12 max-w-[640px]">
        <h2 className="mb-1 text-[15px] font-semibold">Varning för lågt lager</h2>
        <p className="mb-4 text-[13px] text-muted">
          Översikten varnar när tillgängligt lager går under gränsen. Sätt 0 för att stänga av varningen, som för
          gamla askar som ska säljas slut.
        </p>
        <ThresholdForm products={products} />
      </section>

      <section className="max-w-[420px]">
        <h2 className="mb-1 text-[15px] font-semibold">Ditt konto</h2>
        <p className="mb-4 text-[13px] text-muted">
          Inloggad som {user?.name}
          {user?.email ? ` (${user.email})` : ""}.
        </p>
        {isDevAuth() ? (
          <p className="text-[13px] text-muted">Lösenord kan inte bytas i testläget.</p>
        ) : (
          <PasswordForm />
        )}
      </section>
    </>
  );
}
