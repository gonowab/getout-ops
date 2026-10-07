"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Printer, Truck } from "lucide-react";
import { Button, buttonClass, cn } from "@/components/ui";
import { useToast } from "@/components/toast";
import { bookWithPostnord, type BookResult } from "@/lib/actions/shipping";
import { orderRef } from "@/lib/labels";

type Row = { id: string; orderNumber: number; name: string; city: string | null; qty: number; ready: boolean };

/** "Att packa": boka flera ordrar hos PostNord på en gång och skriv ut etiketterna */
export function PostnordBatch({
  rows,
  bookedToday,
  bookingBlocked,
}: {
  rows: Row[];
  bookedToday: number[];
  bookingBlocked: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(rows.filter((r) => r.ready).map((r) => r.id)));
  const [result, setResult] = useState<BookResult | null>(null);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const book = () =>
    start(async () => {
      const res = await bookWithPostnord([...selected]);
      setResult(res);
      setSelected(new Set());
      if (res.booked.length) toast({ kind: "ok", text: `${res.booked.length} bokade hos PostNord` });
      if (res.failed.length) toast({ kind: "error", text: `${res.failed.length} gick inte att boka` });
      router.refresh();
    });

  const labelLink = (numbers: number[]) => `/api/etiketter?ordrar=${numbers.join(",")}`;
  const justBooked = result?.booked.map((b) => b.orderNumber) ?? [];

  if (rows.length === 0 && bookedToday.length === 0 && !result) return null;

  return (
    <section className="mb-6 rounded-xl border border-line p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-semibold text-ink">Boka hos PostNord</h2>
          <p className="text-[12px] text-muted">
            {bookingBlocked ??
              "Home Small Prio. Spårningsnumret läggs in i Shopify och kunden får ett mejl direkt."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {bookedToday.length ? (
            <a href={labelLink(bookedToday)} target="_blank" rel="noreferrer" className={buttonClass("secondary")}>
              <Printer className="size-3.5" /> Dagens etiketter ({bookedToday.length})
            </a>
          ) : null}
          {rows.length ? (
            <Button variant="primary" onClick={book} disabled={pending || selected.size === 0 || Boolean(bookingBlocked)}>
              <Truck className="size-3.5" />
              {pending ? "Bokar…" : `Boka ${selected.size} st`}
            </Button>
          ) : null}
        </div>
      </div>

      {result && (justBooked.length || result.failed.length) ? (
        <div className="mb-3 flex flex-col gap-2 rounded-lg bg-canvas p-3 text-[13px]">
          {justBooked.length ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-ink">{justBooked.length} bokade.</span>
              <a href={labelLink(justBooked)} target="_blank" rel="noreferrer" className={buttonClass("primary", "sm")}>
                <Printer className="size-3.5" /> Skriv ut etiketterna
              </a>
            </div>
          ) : null}
          {result.failed.map((f) => (
            <div key={f.orderNumber} className="text-danger">
              {orderRef(f.orderNumber)}: {f.error}
            </div>
          ))}
        </div>
      ) : null}

      {rows.length ? (
        <ul className="flex flex-col divide-y divide-line text-[13px]">
          {rows.map((r) => (
            <li key={r.id}>
              <label className={cn("flex items-center gap-3 py-2", !r.ready && "opacity-60")}>
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--color-ink,black)]"
                  checked={selected.has(r.id)}
                  disabled={!r.ready || pending}
                  onChange={() => toggle(r.id)}
                />
                <span className="w-16 font-medium text-ink">{orderRef(r.orderNumber)}</span>
                <span className="min-w-0 flex-1 truncate text-ink">
                  {r.name}
                  {r.city ? <span className="text-muted">, {r.city}</span> : null}
                </span>
                <span className="tabular text-muted">{r.ready ? `${r.qty} st` : "Adress saknas"}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted">Inga ordrar kvar att boka.</p>
      )}
    </section>
  );
}
