import Link from "next/link";
import { PageHeader, SectionTitle, EmptyState, EditionTag, cn } from "@/components/ui";
import { StockBoard, StockTotals } from "@/components/stock-board";
import { MovementButton } from "@/components/movement-dialog";
import { DeleteMovementButton } from "./delete-movement";
import { getMovements, getProducts, getStock } from "@/lib/queries";
import { dateTime, num } from "@/lib/format";
import { movementLabel, orderRef, productLabel } from "@/lib/labels";

export const metadata = { title: "Lager" };

const TYPES = [
  { value: "", label: "Alla" },
  { value: "inleverans", label: "Inleverans" },
  { value: "order", label: "Order" },
  { value: "justering", label: "Justering" },
  { value: "retur", label: "Retur" },
];

export default async function LagerPage(props: PageProps<"/lager">) {
  const sp = await props.searchParams;
  const type = typeof sp.typ === "string" ? sp.typ : "";
  const productId = typeof sp.produkt === "string" ? Number(sp.produkt) || undefined : undefined;

  const [stock, products, movements] = await Promise.all([
    getStock(),
    getProducts(),
    getMovements({ type: type || undefined, productId, limit: 300 }),
  ]);
  const byId = new Map(products.map((p) => [p.id, p]));

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const next = { typ: type || undefined, produkt: productId ? String(productId) : undefined, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/lager?${s}` : "/lager";
  };

  return (
    <>
      <PageHeader
        title="Lager"
        description="Tillgängligt = det som går att sälja, alltså lagret minus bekräftade ordrar som inte skickats."
        actions={<MovementButton products={products} />}
      />

      <div className="mb-3">
        <StockTotals stock={stock} />
      </div>
      <StockBoard stock={stock} detailed />

      <div className="mt-12">
        <SectionTitle aside={`${movements.length} rader`}>Historik</SectionTitle>

        <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
          <div className="flex gap-1">
            {TYPES.map((t) => (
              <Link
                key={t.value}
                href={qs({ typ: t.value || undefined })}
                className={cn(
                  "rounded-md px-2 py-1",
                  type === t.value ? "bg-hover font-medium text-ink" : "text-muted hover:text-ink",
                )}
              >
                {t.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            <Link
              href={qs({ produkt: undefined })}
              className={cn("rounded-md px-2 py-1", !productId ? "bg-hover font-medium text-ink" : "text-muted hover:text-ink")}
            >
              Alla kortlekar
            </Link>
            {products.map((p) => (
              <Link
                key={p.id}
                href={qs({ produkt: String(p.id) })}
                className={cn(
                  "rounded-md px-2 py-1",
                  productId === p.id ? "bg-hover font-medium text-ink" : "text-muted hover:text-ink",
                )}
              >
                {productLabel(p)}
              </Link>
            ))}
          </div>
        </div>

        {movements.length === 0 ? (
          <EmptyState title="Inga lagerrörelser">Registrera en inleverans för att komma igång.</EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead className="bg-canvas text-left text-[12px] text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Datum</th>
                  <th className="px-4 py-2 font-medium">Kortlek</th>
                  <th className="px-4 py-2 text-right font-medium">Antal</th>
                  <th className="px-4 py-2 font-medium">Typ</th>
                  <th className="px-4 py-2 font-medium">Notering</th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => {
                  const p = byId.get(m.product_id);
                  return (
                    <tr key={m.id} className="group border-t border-line">
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted tabular">{dateTime(m.occurred_at)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        {p ? (
                          <span className="flex items-center gap-2">
                            {p.region}
                            <EditionTag edition={p.edition} />
                          </span>
                        ) : (
                          "–"
                        )}
                      </td>
                      <td
                        className={cn(
                          "whitespace-nowrap px-4 py-2.5 text-right font-medium tabular",
                          m.quantity > 0 ? "text-brand-strong" : "text-ink",
                        )}
                      >
                        {m.quantity > 0 ? "+" : "−"}
                        {num(Math.abs(m.quantity))}
                      </td>
                      <td className="px-4 py-2.5 text-muted">{movementLabel[m.type]}</td>
                      <td className="px-4 py-2.5">
                        {m.order_number ? (
                          <Link href={`/ordrar/${m.order_number}`} prefetch={false} className="hover:underline">
                            {m.note ?? orderRef(m.order_number)}
                          </Link>
                        ) : (
                          (m.note ?? "–")
                        )}
                        {m.user_name ? <span className="ml-2 text-[12px] text-subtle">{m.user_name}</span> : null}
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        {m.type !== "order" ? <DeleteMovementButton id={m.id} /> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
