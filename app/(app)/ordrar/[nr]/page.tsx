import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EditionTag, cn } from "@/components/ui";
import { InvoiceBadge, StatusBadge } from "@/components/badges";
import { CommentBox, EditOrderButton, InvoicePanel, StatusControl } from "@/components/order-actions";
import { ShippingPanel } from "@/components/shipping-panel";
import { getOrderByNumber, getProducts } from "@/lib/queries";
import { dateTime, num, relativeDays, shortDate } from "@/lib/format";
import { customerTypeLabel, orderRef, sourceLabel, statusLabel } from "@/lib/labels";
import type { OrderEvent, OrderStatus } from "@/lib/types";

export async function generateMetadata(props: PageProps<"/ordrar/[nr]">) {
  const { nr } = await props.params;
  return { title: `GO-${nr.replace(/\D/g, "")}` };
}

export default async function OrderPage(props: PageProps<"/ordrar/[nr]">) {
  const { nr } = await props.params;
  const n = parseInt(nr.replace(/\D/g, ""), 10);
  if (!n) notFound();
  const [data, products] = await Promise.all([getOrderByNumber(n), getProducts()]);
  if (!data) notFound();
  const { order: o, lines, events } = data;
  const byId = new Map(products.map((p) => [p.id, p]));
  const sortedLines = [...lines].sort(
    (a, b) => (byId.get(a.product_id)?.sort_order ?? 0) - (byId.get(b.product_id)?.sort_order ?? 0),
  );
  const hasPrices = lines.some((l) => l.unit_price !== null);
  const value = lines.reduce((s, l) => s + (l.unit_price ? Number(l.unit_price) * l.quantity : 0), 0);
  const isShopify = o.source === "shopify";

  return (
    <>
      <Link href="/ordrar" className="mb-4 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
        <ArrowLeft className="size-3.5" /> Ordrar
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[22px] font-semibold tracking-[-0.01em]">{orderRef(o.order_number)}</h1>
            <StatusBadge status={o.status} />
            {!isShopify || o.invoice_status !== "betald" ? (
              <InvoiceBadge status={o.invoice_status} overdue={o.is_overdue} />
            ) : null}
          </div>
          <p className="mt-1 text-[13px] text-muted">
            {o.customer_id ? (
              <Link href={`/kunder/${o.customer_id}`} className="text-ink hover:underline">
                {o.customer_name}
              </Link>
            ) : (
              "Ingen kund"
            )}
            {", "}
            {sourceLabel[o.source]}
            {o.shopify_order_name ? ` ${o.shopify_order_name}` : ""}
            {", "}
            {shortDate(o.order_date)}
          </p>
        </div>
        <EditOrderButton payload={{ order: o, lines }} />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-8">
          <section>
            <StatusControl orderId={o.id} status={o.status} totalQty={o.total_qty} />
          </section>

          <section>
            <div className="overflow-hidden rounded-xl border border-line">
              <table className="w-full text-[13px]">
                <thead className="bg-canvas text-left text-[12px] text-muted">
                  <tr>
                    <th className="px-4 py-2 font-medium">Kortlek</th>
                    <th className="px-4 py-2 text-right font-medium">Antal</th>
                    {hasPrices ? <th className="px-4 py-2 text-right font-medium">À-pris</th> : null}
                    {hasPrices ? <th className="px-4 py-2 text-right font-medium">Summa</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {sortedLines.map((l) => {
                    const p = byId.get(l.product_id);
                    return (
                      <tr key={l.product_id} className="border-t border-line">
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-2">
                            <span className="text-ink">{p?.name ?? "Okänd"}</span>
                            {p ? <EditionTag edition={p.edition} /> : null}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium tabular">{num(l.quantity)}</td>
                        {hasPrices ? (
                          <td className="px-4 py-2.5 text-right text-muted tabular">
                            {l.unit_price ? `${num(Number(l.unit_price))} kr` : "–"}
                          </td>
                        ) : null}
                        {hasPrices ? (
                          <td className="px-4 py-2.5 text-right tabular">
                            {l.unit_price ? `${num(Math.round(Number(l.unit_price) * l.quantity))} kr` : "–"}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line bg-canvas/60">
                    <td className="px-4 py-2.5 font-medium">Totalt</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular">{num(o.total_qty)} st</td>
                    {hasPrices ? <td /> : null}
                    {hasPrices ? (
                      <td className="px-4 py-2.5 text-right font-semibold tabular">
                        {num(Math.round(value))} kr
                        <div className="text-[11px] font-normal text-subtle">ex moms</div>
                      </td>
                    ) : null}
                  </tr>
                </tfoot>
              </table>
            </div>
            {o.comment ? (
              <div className="mt-4 rounded-lg bg-canvas px-4 py-3 text-[13px] text-ink">
                <div className="mb-0.5 text-[12px] font-medium text-muted">Kommentar</div>
                <p className="whitespace-pre-wrap">{o.comment}</p>
              </div>
            ) : null}
          </section>

          <section>
            <h2 className="mb-3 text-[15px] font-semibold">Händelser</h2>
            <Timeline events={events} />
            <div className="mt-4">
              <CommentBox orderId={o.id} />
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <InfoBlock title="Kontakt">
            <Row label="Kund">
              {o.customer_name ?? "–"}
              {o.customer_type ? <span className="text-muted"> ({customerTypeLabel[o.customer_type].toLowerCase()})</span> : null}
            </Row>
            <Row label="Kontaktperson">{o.contact_name ?? "–"}</Row>
            <Row label="E-post">
              {o.contact_email ? (
                <a href={`mailto:${o.contact_email}`} className="hover:underline">
                  {o.contact_email}
                </a>
              ) : (
                "–"
              )}
            </Row>
            <Row label="Telefon">
              {o.contact_phone ? (
                <a href={`tel:${o.contact_phone.replace(/\s/g, "")}`} className="hover:underline">
                  {o.contact_phone}
                </a>
              ) : (
                "–"
              )}
            </Row>
          </InfoBlock>

          <InfoBlock title="Leverans">
            <div className="text-[13px] leading-5 text-ink">
              {o.ship_name || o.ship_address ? (
                <>
                  {o.ship_name ? <div>{o.ship_name}</div> : null}
                  {o.ship_address ? <div>{o.ship_address}</div> : null}
                  {o.ship_postal_code || o.ship_city ? (
                    <div>
                      {o.ship_postal_code} {o.ship_city}
                    </div>
                  ) : null}
                </>
              ) : (
                <span className="text-muted">Ingen adress angiven</span>
              )}
            </div>
            {o.shipped_at ? <Row label="Skickad">{dateTime(o.shipped_at)}</Row> : null}
            <ShippingPanel
              orderId={o.id}
              status={o.status}
              weightGrams={o.weight_grams}
              trackingNumber={o.tracking_number}
              isShopify={Boolean(o.shopify_order_id)}
              shopifyFulfilled={Boolean(o.shopify_fulfilled_at)}
            />
          </InfoBlock>

          <InfoBlock title="Faktura">
            {isShopify && o.invoice_status === "betald" ? (
              <p className="text-[13px] text-muted">Betald i Shopify vid köpet. Ingen faktura behövs.</p>
            ) : (
              <>
                {(o.invoice_email || o.invoice_reference) && (
                  <div className="mb-1 flex flex-col gap-1.5">
                    {o.invoice_email ? <Row label="Fakturamejl">{o.invoice_email}</Row> : null}
                    {o.invoice_reference ? <Row label="Referens">{o.invoice_reference}</Row> : null}
                  </div>
                )}
                {o.is_overdue && o.invoice_due_date ? (
                  <p className="rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">
                    Förföll {shortDate(o.invoice_due_date)}, {relativeDays(o.invoice_due_date)}.
                  </p>
                ) : null}
                <InvoicePanel
                  orderId={o.id}
                  hasPdf={Boolean(o.invoice_pdf_path)}
                  initial={{
                    invoiceStatus: o.invoice_status,
                    invoiceNumber: o.invoice_number,
                    invoiceDate: o.invoice_date,
                    invoiceDueDate: o.invoice_due_date,
                    paidAt: o.paid_at,
                  }}
                />
              </>
            )}
          </InfoBlock>
        </aside>
      </div>
    </>
  );
}

function InfoBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 border-t border-line pt-4 first:border-t-0 first:pt-0">
      <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[104px_1fr] gap-2 text-[13px]">
      <span className="text-muted">{label}</span>
      <span className="min-w-0 break-words text-ink">{children}</span>
    </div>
  );
}

function eventText(e: OrderEvent) {
  const s = (v: string | null) => (v && v in statusLabel ? statusLabel[v as OrderStatus] : v);
  switch (e.kind) {
    case "skapad":
      return "Ordern skapades";
    case "status":
      return (
        <>
          Status ändrad från <b className="font-medium">{s(e.from_value)}</b> till{" "}
          <b className="font-medium">{s(e.to_value)}</b>
        </>
      );
    case "faktura":
      return (
        <>
          {e.from_value && e.to_value ? (
            <>
              Faktura: <b className="font-medium">{e.from_value}</b> till <b className="font-medium">{e.to_value}</b>
              {e.note ? `, ${e.note.toLowerCase()}` : ""}
            </>
          ) : (
            (e.note ?? "Fakturan uppdaterades")
          )}
        </>
      );
    case "andrad":
      return e.note ?? "Ordern uppdaterades";
    default:
      return e.note;
  }
}

function Timeline({ events }: { events: OrderEvent[] }) {
  if (events.length === 0) return <p className="text-[13px] text-muted">Inga händelser än.</p>;
  return (
    <ol className="relative flex flex-col gap-3 border-l border-line pl-5">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span
            className={cn(
              "absolute -left-[25px] top-1.5 size-2 rounded-full ring-4 ring-surface",
              e.kind === "kommentar" ? "bg-sky-500" : e.kind === "status" ? "bg-ink" : "bg-line-strong",
            )}
            aria-hidden
          />
          {e.kind === "kommentar" ? (
            <div className="rounded-lg border border-line px-3 py-2">
              <p className="whitespace-pre-wrap text-[13px] text-ink">{e.note}</p>
              <p className="mt-1 text-[12px] text-subtle">
                {e.user_name ?? "Okänd"}, {dateTime(e.created_at)}
              </p>
            </div>
          ) : (
            <div className="text-[13px] text-ink">
              {eventText(e)}
              <span className="ml-2 text-[12px] text-subtle">
                {e.user_name ? `${e.user_name}, ` : ""}
                {dateTime(e.created_at)}
              </span>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
