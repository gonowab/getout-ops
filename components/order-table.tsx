import Link from "next/link";
import { cn } from "@/components/ui";
import { InvoiceBadge, SourceLabel, StatusBadge } from "@/components/badges";
import { QuickStatusButton } from "@/components/order-actions";
import { num, shortDate } from "@/lib/format";
import { orderRef } from "@/lib/labels";
import type { OrderLine, OrderRow, Product } from "@/lib/types";

export function ProductChips({ lines, products }: { lines: OrderLine[]; products: Product[] }) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const sorted = [...lines].sort((a, b) => (byId.get(a.product_id)?.sort_order ?? 0) - (byId.get(b.product_id)?.sort_order ?? 0));
  return (
    <span className="flex flex-wrap gap-x-2.5 gap-y-0.5">
      {sorted.map((l) => {
        const p = byId.get(l.product_id);
        if (!p) return null;
        return (
          <span key={l.product_id} className="inline-flex items-center gap-1 whitespace-nowrap text-[13px]">
            {p.edition === "gammal" ? (
              <span className="size-1.5 rounded-full bg-old" title="Gammal ask" aria-label="Gammal ask" />
            ) : null}
            <span className="text-muted">{p.region}</span>
            <span className="tabular text-ink">{num(l.quantity)}</span>
          </span>
        );
      })}
    </span>
  );
}

export function OrderTable({
  orders,
  lines,
  products,
  quickAction = false,
  hideCustomer = false,
}: {
  orders: OrderRow[];
  lines: Map<string, OrderLine[]>;
  products: Product[];
  quickAction?: boolean;
  hideCustomer?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[860px] text-[13px]">
        <thead className="bg-canvas text-left text-[12px] text-muted">
          <tr>
            <th className="px-4 py-2 font-medium">Order</th>
            {!hideCustomer ? <th className="px-4 py-2 font-medium">Kund</th> : null}
            <th className="px-4 py-2 font-medium">Kortlekar</th>
            <th className="px-4 py-2 text-right font-medium">Antal</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Faktura</th>
            <th className="px-4 py-2 font-medium">Datum</th>
            {quickAction ? <th className="px-4 py-2" /> : null}
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr
              key={o.id}
              className={cn("relative border-t border-line hover:bg-canvas", o.status === "makulerad" && "opacity-60")}
            >
              <td className="whitespace-nowrap px-4 py-2.5">
                <Link href={`/ordrar/${o.order_number}`} className="font-medium text-ink after:absolute after:inset-0">
                  {orderRef(o.order_number)}
                </Link>
                <div className="text-[12px] text-subtle">
                  <SourceLabel source={o.source} />
                  {o.shopify_order_name ? ` ${o.shopify_order_name}` : ""}
                </div>
              </td>
              {!hideCustomer ? (
                <td className="max-w-[220px] px-4 py-2.5">
                  <div className="truncate text-ink">{o.customer_name ?? "–"}</div>
                  {o.contact_name && o.contact_name !== o.customer_name ? (
                    <div className="truncate text-[12px] text-muted">{o.contact_name}</div>
                  ) : null}
                </td>
              ) : null}
              <td className="px-4 py-2.5">
                <ProductChips lines={lines.get(o.id) ?? []} products={products} />
              </td>
              <td className="px-4 py-2.5 text-right font-medium tabular">{num(o.total_qty)}</td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <StatusBadge status={o.status} />
              </td>
              <td className="whitespace-nowrap px-4 py-2.5">
                {o.source === "shopify" && o.invoice_status === "betald" ? (
                  <span className="text-[13px] text-subtle">Betald i Shopify</span>
                ) : (
                  <InvoiceBadge status={o.invoice_status} overdue={o.is_overdue} />
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-muted tabular">{shortDate(o.order_date)}</td>
              {quickAction ? (
                <td className="relative z-10 whitespace-nowrap px-4 py-2 text-right">
                  <QuickStatusButton orderId={o.id} status={o.status} totalQty={o.total_qty} />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
