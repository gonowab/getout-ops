import Link from "next/link";
import { Search } from "lucide-react";
import { EmptyState, Input, PageHeader, cn } from "@/components/ui";
import { CustomerFormButton } from "@/components/customer-form";
import { getCustomers } from "@/lib/queries";
import { customerTypeLabel } from "@/lib/labels";
import { num, shortDate } from "@/lib/format";
import type { CustomerType } from "@/lib/types";

export const metadata = { title: "Kunder" };

const TABS: { value: CustomerType | ""; label: string }[] = [
  { value: "", label: "Alla" },
  { value: "foretag", label: "Företag" },
  { value: "aterforsaljare", label: "Återförsäljare" },
  { value: "privat", label: "Privatpersoner" },
];

export default async function KunderPage(props: PageProps<"/kunder">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const typ = typeof sp.typ === "string" ? sp.typ : "";
  const all = await getCustomers(q);
  const customers = typ ? all.filter((c) => c.type === typ) : all;

  const href = (t: string) => {
    const p = new URLSearchParams();
    if (t) p.set("typ", t);
    if (q) p.set("q", q);
    const s = p.toString();
    return s ? `/kunder?${s}` : "/kunder";
  };

  return (
    <>
      <PageHeader title="Kunder" description={`${num(all.length)} kunder`} actions={<CustomerFormButton />} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 text-[13px]">
          {TABS.map((t) => {
            const count = t.value ? all.filter((c) => c.type === t.value).length : all.length;
            return (
              <Link
                key={t.value}
                href={href(t.value)}
                className={cn(
                  "rounded-md px-2.5 py-1",
                  typ === t.value ? "bg-hover font-medium text-ink" : "text-muted hover:text-ink",
                )}
              >
                {t.label} <span className="text-subtle tabular">{count}</span>
              </Link>
            );
          })}
        </div>
        <form className="relative w-full sm:w-64">
          {typ ? <input type="hidden" name="typ" value={typ} /> : null}
          <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-subtle" />
          <Input name="q" defaultValue={q} placeholder="Sök namn, kontakt, ort" className="pl-8" />
        </form>
      </div>

      {customers.length === 0 ? (
        <EmptyState title={q ? `Inga kunder matchar ”${q}”` : "Inga kunder än"}>
          {q ? "Prova ett annat sökord." : "Lägg till en kund, eller skapa en direkt från en ny order."}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead className="bg-canvas text-left text-[12px] text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Namn</th>
                <th className="px-4 py-2 font-medium">Typ</th>
                <th className="px-4 py-2 font-medium">Kontakt</th>
                <th className="px-4 py-2 font-medium">Ort</th>
                <th className="px-4 py-2 text-right font-medium">Ordrar</th>
                <th className="px-4 py-2 text-right font-medium">Kortlekar</th>
                <th className="px-4 py-2 font-medium">Senaste order</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="relative border-t border-line hover:bg-canvas">
                  <td className="px-4 py-2.5 font-medium text-ink">
                    <Link href={`/kunder/${c.id}`} className="after:absolute after:inset-0">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted">{customerTypeLabel[c.type]}</td>
                  <td className="px-4 py-2.5">
                    <div>{c.contact_name ?? "–"}</div>
                    {c.email ? <div className="text-[12px] text-muted">{c.email}</div> : null}
                  </td>
                  <td className="px-4 py-2.5 text-muted">{c.city ?? "–"}</td>
                  <td className="px-4 py-2.5 text-right tabular">{c.order_count}</td>
                  <td className="px-4 py-2.5 text-right tabular">{num(c.total_qty)}</td>
                  <td className="px-4 py-2.5 text-muted tabular">{shortDate(c.last_order)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
