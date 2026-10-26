"use client";

import { createContext, useContext, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, cn } from "@/components/ui";
import { Modal } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { markOrdersShipped } from "@/lib/actions/orders";
import { orderRef, SHIPPED_STATUSES } from "@/lib/labels";
import { num } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";

export type BulkItem = { id: string; orderNumber: number; status: OrderStatus; qty: number };

type Ctx = {
  items: Map<string, BulkItem>;
  selected: Set<string>;
  toggle: (id: string) => void;
  setAll: (on: boolean) => void;
  clear: () => void;
};

const BulkContext = createContext<Ctx | null>(null);

function useBulk() {
  const ctx = useContext(BulkContext);
  if (!ctx) throw new Error("Måste ligga inom BulkProvider");
  return ctx;
}

/** Bara ordrar som ännu inte är skickade (eller makulerade) kan markeras som skickade */
const canMark = (status: OrderStatus) => status !== "makulerad" && !SHIPPED_STATUSES.includes(status);

/** Håller reda på vilka ordrar som är valda i listan */
export function BulkProvider({ items, children }: { items: BulkItem[]; children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  // Rensa val som inte längre finns i listan, t.ex. efter att ordrar har markerats som skickade
  const valid = useMemo(() => new Set([...selected].filter((id) => byId.has(id) && canMark(byId.get(id)!.status))), [
    selected,
    byId,
  ]);

  const value: Ctx = {
    items: byId,
    selected: valid,
    toggle: (id) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    setAll: (on) => setSelected(on ? new Set(items.filter((i) => canMark(i.status)).map((i) => i.id)) : new Set()),
    clear: () => setSelected(new Set()),
  };

  return <BulkContext.Provider value={value}>{children}</BulkContext.Provider>;
}

const boxClass = "size-4 cursor-pointer accent-[var(--color-ink,black)] disabled:cursor-default disabled:opacity-40";

export function RowCheckbox({ id }: { id: string }) {
  const { items, selected, toggle } = useBulk();
  const item = items.get(id);
  if (!item) return null;
  return (
    <input
      type="checkbox"
      className={boxClass}
      aria-label={`Välj ${orderRef(item.orderNumber)}`}
      checked={selected.has(id)}
      disabled={!canMark(item.status)}
      onChange={() => toggle(id)}
    />
  );
}

export function HeaderCheckbox() {
  const { items, selected, setAll } = useBulk();
  const eligible = [...items.values()].filter((i) => canMark(i.status)).length;
  const all = eligible > 0 && selected.size === eligible;
  return (
    <input
      type="checkbox"
      className={boxClass}
      aria-label="Välj alla"
      checked={all}
      ref={(el) => {
        if (el) el.indeterminate = selected.size > 0 && !all;
      }}
      disabled={eligible === 0}
      onChange={() => setAll(!all)}
    />
  );
}

/** Åtgärdsrad som visas när minst en order är vald */
export function BulkBar() {
  const router = useRouter();
  const { toast } = useToast();
  const { items, selected, clear } = useBulk();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);

  if (selected.size === 0) return null;

  const chosen = [...selected].map((id) => items.get(id)!).filter(Boolean);
  const totalQty = chosen.reduce((sum, i) => sum + i.qty, 0);

  const run = () =>
    start(async () => {
      const res = await markOrdersShipped(chosen.map((c) => c.id));
      setConfirm(false);
      clear();
      if (res.shipped) toast({ kind: "ok", text: `${res.shipped} ordrar markerade som skickade` });
      for (const s of res.skipped) toast({ kind: "error", text: `${orderRef(s.orderNumber)}: ${s.reason}` });
      router.refresh();
    });

  return (
    <>
      <div
        className={cn(
          "sticky top-2 z-20 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line",
          "bg-surface px-4 py-2.5 text-[13px] shadow-sm",
        )}
      >
        <span className="text-ink">
          {selected.size} {selected.size === 1 ? "order vald" : "ordrar valda"}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={clear} disabled={pending}>
            Avmarkera
          </Button>
          <Button variant="primary" size="sm" onClick={() => setConfirm(true)} disabled={pending}>
            Markera som skickade
          </Button>
        </div>
      </div>

      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        title={`Markera ${selected.size} ${selected.size === 1 ? "order" : "ordrar"} som skickade?`}
        description={`${num(totalQty)} kortlekar dras från lagret.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)} disabled={pending}>
              Avbryt
            </Button>
            <Button variant="primary" onClick={run} disabled={pending}>
              {pending ? "Sparar…" : "Markera som skickade"}
            </Button>
          </>
        }
      />
    </>
  );
}
