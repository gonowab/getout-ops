"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Button, Input, Select, PageHeader } from "@/components/ui";
import {
  DeliveryEditor,
  NewDeliveryButton,
  NewResellerButton,
  NoteEditor,
  ResellerEditor,
} from "@/components/reseller-form";
import { FollowedUpButton } from "@/components/reseller-followed-up-button";
import { InvoicePanel } from "@/components/order-actions";
import { linkLegacyDelivery } from "@/lib/actions/resellers";
import { num, shortDate, relativeDays } from "@/lib/format";
import type {
  Product,
  Reseller,
  ResellerHistory,
  ResellerNote,
} from "@/lib/types";

type Props = {
  resellers: Reseller[];
  deliveries: ResellerHistory[];
  notes: ResellerNote[];
  products: Product[];
  today: string;
};
function LegacyLink({
  delivery,
  history,
}: {
  delivery: ResellerHistory;
  history: ResellerHistory[];
}) {
  const [orderId, setOrderId] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  const options = history.filter(
    (h) => h.order && !h.delivered_on && !h.follow_up_on,
  );
  if (!options.length) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <Select
        aria-label="Befintlig order att koppla"
        className="max-w-xs"
        value={orderId}
        onChange={(e) => setOrderId(e.target.value)}
      >
        <option value="">Koppla till befintlig order…</option>
        {options.map((h) => (
          <option key={h.id} value={h.order_id!}>
            GO-{h.order!.order_number} · {h.quantity} kortlekar ·{" "}
            {shortDate(h.order!.order_date)}
          </option>
        ))}
      </Select>
      <Button
        disabled={pending || !orderId}
        onClick={() =>
          start(async () => {
            const res = await linkLegacyDelivery(delivery.id, orderId);
            if (!res.ok) setError(res.error);
            else {
              setError("");
              router.refresh();
            }
          })
        }
      >
        Koppla
      </Button>
      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
export function ResellerRegister({
  resellers,
  deliveries,
  notes,
  products,
  today,
}: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const active = deliveries.filter((d) => d.order?.status !== "makulerad");
  const due = active.filter(
    (d) => !d.followed_up && d.follow_up_on && d.follow_up_on <= today,
  );
  const upcoming = active.filter(
    (d) => !d.followed_up && d.follow_up_on && d.follow_up_on > today,
  );
  const visible = resellers.filter((c) => {
    const text = [
      c.name,
      c.city,
      c.address,
      c.invoice_email,
      ...c.contacts.flatMap((p) => [p.name, p.email]),
    ]
      .join(" ")
      .toLocaleLowerCase("sv");
    return (
      text.includes(search.toLocaleLowerCase("sv")) &&
      (filter === "all" ||
        (filter === "due" ? due : upcoming).some((d) => d.customer_id === c.id))
    );
  });
  return (
    <>
      <PageHeader
        title="Återförsäljare"
        description={`${num(active.reduce((s, d) => s + d.quantity, 0))} kortlekar registrerade hos ${num(resellers.length)} återförsäljare`}
        actions={
          <>
            <NewResellerButton />
            <NewDeliveryButton resellers={resellers} products={products} />
          </>
        }
      />
      <section className="mb-8">
        <h2 className="mb-3 text-[15px] font-semibold">
          Dags att följa upp{" "}
          <span className="font-normal text-subtle">{due.length}</span>
        </h2>
        {!due.length ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-4 text-[13px] text-muted">
            Ingen uppföljning är försenad just nu.
          </p>
        ) : (
          <div className="divide-y divide-line rounded-xl border border-line">
            {due.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 text-[13px]"
              >
                <button
                  className="text-left font-medium hover:underline"
                  onClick={() => {
                    setFilter("all");
                    setSearch("");
                    setExpanded((e) => ({ ...e, [d.customer_id]: true }));
                    requestAnimationFrame(() =>
                      document
                        .getElementById(`reseller-${d.customer_id}`)
                        ?.scrollIntoView({
                          block: "nearest",
                          behavior: "smooth",
                        }),
                    );
                  }}
                >
                  {resellers.find((c) => c.id === d.customer_id)?.name ||
                    "Namnlös återförsäljare"}{" "}
                  · {d.order ? `GO-${d.order.order_number}` : "Äldre leverans"}{" "}
                  · {d.quantity} kortlekar{" "}
                  <span className="text-danger">
                    {shortDate(d.follow_up_on)} ({relativeDays(d.follow_up_on)})
                  </span>
                </button>
                <FollowedUpButton
                  id={d.id}
                  name={
                    resellers.find((c) => c.id === d.customer_id)?.name ?? ""
                  }
                  done={false}
                />
              </div>
            ))}
          </div>
        )}
      </section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {[
            ["all", `Alla återförsäljare ${resellers.length}`],
            ["due", `Dags att följa upp ${due.length}`],
            ["upcoming", `Kommande ${upcoming.length}`],
          ].map(([value, label]) => (
            <Button
              key={value}
              variant={filter === value ? "secondary" : "ghost"}
              onClick={() => setFilter(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-2 size-4 text-subtle" />
          <Input
            aria-label="Sök återförsäljare"
            className="pl-8"
            placeholder="Sök butik, kontakt, mejl eller ort"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead className="bg-canvas text-left text-[12px] text-muted">
            <tr>
              {[
                "Återförsäljare",
                "Antal senast",
                "Senaste leverans",
                "Följ upp",
                "Anteckning",
              ].map((h) => (
                <th key={h} className="px-4 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => {
              const history = deliveries.filter((d) => d.customer_id === c.id);
              const current = history.filter(
                (d) => d.order?.status !== "makulerad",
              );
              const latest = current[0];
              const next = current
                .filter((d) => !d.followed_up && d.follow_up_on)
                .sort((a, b) =>
                  a.follow_up_on!.localeCompare(b.follow_up_on!),
                )[0];
              const customerNotes = notes.filter((n) => n.customer_id === c.id);
              const preview = customerNotes[0]?.body || latest?.note;
              return (
                <Fragment key={c.id}>
                  <tr
                    id={`reseller-${c.id}`}
                    className="border-t border-line align-top hover:bg-canvas"
                  >
                    <td className="px-4 py-3">
                      <button
                        aria-expanded={!!expanded[c.id]}
                        aria-controls={`reseller-detail-${c.id}`}
                        className="flex items-center gap-2 text-left font-medium"
                        onClick={() =>
                          setExpanded((e) => ({ ...e, [c.id]: !e[c.id] }))
                        }
                      >
                        {expanded[c.id] ? (
                          <ChevronDown className="size-4 shrink-0" />
                        ) : (
                          <ChevronRight className="size-4 shrink-0" />
                        )}
                        {c.name || "Namnlös återförsäljare"}
                      </button>
                    </td>
                    <td className="px-4 py-3 tabular">
                      {latest ? num(latest.quantity) : "–"}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {shortDate(latest?.delivered_on)}
                    </td>
                    <td
                      className={`px-4 py-3 ${next?.follow_up_on && next.follow_up_on <= today ? "text-danger" : "text-muted"}`}
                    >
                      {next
                        ? `${shortDate(next.follow_up_on)} (${relativeDays(next.follow_up_on)})`
                        : "–"}
                    </td>
                    <td className="max-w-72 px-4 py-3 text-muted">
                      <span className="line-clamp-2 whitespace-pre-line">
                        {preview || "–"}
                      </span>
                    </td>
                  </tr>
                  <tr id={`reseller-detail-${c.id}`} hidden={!expanded[c.id]}>
                    <td
                      colSpan={5}
                      className="border-t border-line bg-canvas/50 p-4"
                    >
                      {expanded[c.id] ? (
                        <div className="space-y-6">
                          <div className="grid gap-6 lg:grid-cols-2">
                            <section>
                              <h3 className="mb-3 font-semibold">
                                Kontaktuppgifter
                              </h3>
                              <ResellerEditor reseller={c} />
                            </section>
                            <section>
                              <h3 className="mb-3 font-semibold">
                                Anteckningar
                              </h3>
                              <NoteEditor customerId={c.id} today={today} />
                              <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
                                {customerNotes.map((n) => (
                                  <details
                                    key={n.id}
                                    className="rounded-lg border border-line bg-surface p-3"
                                  >
                                    <summary className="cursor-pointer">
                                      <span className="text-muted">
                                        {shortDate(n.noted_on)} ·{" "}
                                      </span>
                                      {n.body.slice(0, 100) || "Tom anteckning"}
                                    </summary>
                                    <div className="mt-3">
                                      <NoteEditor
                                        customerId={c.id}
                                        note={n}
                                        today={today}
                                      />
                                    </div>
                                  </details>
                                ))}
                              </div>
                            </section>
                          </div>
                          <section>
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <h3 className="font-semibold">
                                Leveranshistorik{" "}
                                <span className="font-normal text-muted">
                                  {history.length} leveranser
                                </span>
                              </h3>
                              <NewDeliveryButton
                                resellers={resellers}
                                products={products}
                                customerId={c.id}
                              />
                            </div>
                            {!history.length ? (
                              <p className="text-muted">
                                Inga leveranser registrerade.
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {history.map((d) => (
                                  <details
                                    key={d.id}
                                    className="rounded-lg border border-line bg-surface p-3"
                                  >
                                    <summary className="cursor-pointer">
                                      <span className="font-medium">
                                        {d.order
                                          ? `GO-${d.order.order_number}`
                                          : "Äldre fristående leverans"}
                                      </span>{" "}
                                      · {shortDate(d.delivered_on)} ·{" "}
                                      {num(d.quantity)} kortlekar{" "}
                                      {d.order?.status === "makulerad"
                                        ? "· Makulerad"
                                        : ""}
                                      <span className="ml-3 text-muted">
                                        {d.order?.invoice_status === "betald"
                                          ? "Betald"
                                          : d.order?.invoice_status ===
                                              "fakturerad"
                                            ? "Fakturerad"
                                            : d.order
                                              ? "Ej fakturerad"
                                              : ""}
                                      </span>
                                      <span className="ml-3 text-muted">
                                        {d.followed_up
                                          ? "Uppföljd"
                                          : d.follow_up_on
                                            ? `Följ upp ${shortDate(d.follow_up_on)}`
                                            : "Uppföljningsdatum saknas"}
                                      </span>
                                    </summary>
                                    <div className="mt-4 space-y-4">
                                      <div className="flex justify-end">
                                        <FollowedUpButton
                                          id={d.id}
                                          name={c.name}
                                          done={d.followed_up}
                                        />
                                      </div>
                                      <DeliveryEditor
                                        key={d.order_id ?? d.id}
                                        delivery={d}
                                        resellers={resellers}
                                        products={products}
                                      />
                                      {d.order ? (
                                        <div className="border-t border-line pt-4">
                                          <h4 className="mb-3 font-medium">
                                            Faktura och betalning
                                          </h4>
                                          <InvoicePanel
                                            orderId={d.order.id}
                                            hasPdf={Boolean(
                                              d.order.invoice_pdf_path,
                                            )}
                                            initial={{
                                              invoiceStatus:
                                                d.order.invoice_status,
                                              invoiceNumber:
                                                d.order.invoice_number,
                                              invoiceDate: d.order.invoice_date,
                                              invoiceDueDate:
                                                d.order.invoice_due_date,
                                              paidAt: d.order.paid_at,
                                            }}
                                          />
                                        </div>
                                      ) : (
                                        <LegacyLink
                                          delivery={d}
                                          history={history}
                                        />
                                      )}
                                    </div>
                                  </details>
                                ))}
                              </div>
                            )}
                          </section>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
            {!visible.length ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted">
                  {search
                    ? "Inga återförsäljare matchar sökningen."
                    : "Inga återförsäljare i den här vyn."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
