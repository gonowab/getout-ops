import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { CustomerFormButton } from "@/components/customer-form";
import { NewOrderForCustomerButton } from "@/components/order-actions";
import { OrderTable } from "@/components/order-table";
import { DeleteCustomerButton } from "./delete-customer";
import { getCustomer, getOrderLinesFor, getOrders, getProducts } from "@/lib/queries";
import { customerTypeLabel } from "@/lib/labels";
import { num, shortDate } from "@/lib/format";

export async function generateMetadata(props: PageProps<"/kunder/[id]">) {
  const { id } = await props.params;
  const c = await getCustomer(id);
  return { title: c?.name ?? "Kund" };
}

export default async function CustomerPage(props: PageProps<"/kunder/[id]">) {
  const { id } = await props.params;
  const customer = await getCustomer(id);
  if (!customer) notFound();

  const [orders, products] = await Promise.all([getOrders({ view: "alla", customerId: id }), getProducts()]);
  const lines = await getOrderLinesFor(orders.map((o) => o.id));
  const active = orders.filter((o) => o.status !== "makulerad");
  const totalQty = active.reduce((s, o) => s + o.total_qty, 0);
  const c = customer;

  return (
    <>
      <Link href="/kunder" className="mb-4 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
        <ArrowLeft className="size-3.5" /> Kunder
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 pb-6">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.01em]">{c.name}</h1>
          <p className="mt-1 text-[13px] text-muted">
            {customerTypeLabel[c.type]}
            {c.city ? `, ${c.city}` : ""}
            {c.org_number ? `, org.nr ${c.org_number}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CustomerFormButton customer={c} />
          <NewOrderForCustomerButton customerId={c.id} />
        </div>
      </div>

      <dl className="mb-8 grid grid-cols-2 gap-x-8 gap-y-5 border-y border-line py-5 text-[13px] sm:grid-cols-4">
        <Stat label="Kontaktperson" value={c.contact_name} sub={c.phone} />
        <Stat
          label="E-post"
          value={c.email ? <a className="hover:underline" href={`mailto:${c.email}`}>{c.email}</a> : null}
          sub={c.invoice_email ? `Faktura: ${c.invoice_email}` : null}
        />
        <Stat
          label="Adress"
          value={c.address}
          sub={c.postal_code || c.city ? `${c.postal_code ?? ""} ${c.city ?? ""}`.trim() : null}
        />
        <Stat
          label="Ordrar"
          value={`${active.length} ordrar, ${num(totalQty)} kortlekar`}
          sub={active[0] ? `Senast ${shortDate(active[0].order_date)}` : null}
        />
      </dl>

      {c.notes ? (
        <div className="mb-8 rounded-lg bg-canvas px-4 py-3 text-[13px]">
          <div className="mb-0.5 text-[12px] font-medium text-muted">Anteckningar</div>
          <p className="whitespace-pre-wrap">{c.notes}</p>
        </div>
      ) : null}

      <h2 className="mb-3 text-[15px] font-semibold">Ordrar</h2>
      {orders.length === 0 ? (
        <EmptyState title="Inga ordrar än">
          <div className="mt-3 flex justify-center gap-2">
            <NewOrderForCustomerButton customerId={c.id} />
            <DeleteCustomerButton id={c.id} name={c.name} />
          </div>
        </EmptyState>
      ) : (
        <OrderTable orders={orders} lines={lines} products={products} hideCustomer />
      )}
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="mt-1 break-words text-ink">{value ?? <span className="text-subtle">–</span>}</dd>
      {sub ? <dd className="break-words text-[12px] text-muted">{sub}</dd> : null}
    </div>
  );
}
