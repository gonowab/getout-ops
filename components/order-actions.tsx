"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, FileText, Pencil, Trash2, Upload } from "lucide-react";
import { Button, Field, Input, Textarea, cn } from "@/components/ui";
import { Modal } from "@/components/sheet";
import { Segmented } from "@/components/order-form";
import { useToast } from "@/components/toast";
import { useOrderPanel } from "@/components/order-panel";
import type { EditPayload } from "@/components/order-form";
import { addOrderComment, changeOrderStatus, deleteInvoicePdf, updateInvoice } from "@/lib/actions/orders";
import { ORDER_FLOW, SHIPPED_STATUSES, statusLabel } from "@/lib/labels";
import { addDaysISO, num, todayISO } from "@/lib/format";
import type { InvoiceStatus, OrderStatus } from "@/lib/types";

const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  ny: { to: "bekraftad", label: "Bekräfta" },
  bekraftad: { to: "ska_packas", label: "Till packning" },
  ska_packas: { to: "skickad", label: "Markera skickad" },
  skickad: { to: "levererad", label: "Markera levererad" },
  levererad: { to: "avslutad", label: "Avsluta" },
};

const isShipped = (s: OrderStatus) => SHIPPED_STATUSES.includes(s);

/** Beskriver vad ett statusbyte gör med lagret, eller null om inget händer */
function stockEffect(from: OrderStatus, to: OrderStatus, qty: number) {
  if (!isShipped(from) && isShipped(to)) return `${num(qty)} kortlekar dras från lagret.`;
  if (isShipped(from) && !isShipped(to)) return `${num(qty)} kortlekar läggs tillbaka i lagret.`;
  return null;
}

function useStatusChange() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const run = (orderId: string, to: OrderStatus, done?: () => void) =>
    start(async () => {
      const res = await changeOrderStatus(orderId, to);
      done?.();
      if (!res.ok) toast({ kind: "error", text: res.error });
      else {
        toast({ kind: "ok", text: res.message ?? "Uppdaterad" });
        router.refresh();
      }
    });
  return { pending, run };
}

function ConfirmStatus({
  open,
  onOpenChange,
  from,
  to,
  qty,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  from: OrderStatus;
  to: OrderStatus;
  qty: number;
  pending: boolean;
  onConfirm: () => void;
}) {
  const effect = stockEffect(from, to, qty);
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={to === "makulerad" ? "Makulera ordern?" : `Ändra till ${statusLabel[to].toLowerCase()}?`}
      description={
        effect ??
        (to === "makulerad" ? "Ordern slutar reservera lager. Den kan återställas senare." : undefined)
      }
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button variant={to === "makulerad" ? "danger" : "primary"} onClick={onConfirm} disabled={pending}>
            {pending ? "Sparar…" : to === "makulerad" ? "Makulera" : statusLabel[to]}
          </Button>
        </>
      }
    />
  );
}

/** Snabbknapp i orderlistan: nästa steg i flödet */
export function QuickStatusButton({
  orderId,
  status,
  totalQty,
}: {
  orderId: string;
  status: OrderStatus;
  totalQty: number;
}) {
  const next = NEXT[status];
  const { pending, run } = useStatusChange();
  const [confirm, setConfirm] = useState(false);
  if (!next) return null;
  const needsConfirm = stockEffect(status, next.to, totalQty) !== null;
  return (
    <>
      <Button
        size="sm"
        variant={next.to === "skickad" ? "primary" : "secondary"}
        disabled={pending}
        onClick={() => (needsConfirm ? setConfirm(true) : run(orderId, next.to))}
      >
        {next.label}
      </Button>
      <ConfirmStatus
        open={confirm}
        onOpenChange={setConfirm}
        from={status}
        to={next.to}
        qty={totalQty}
        pending={pending}
        onConfirm={() => run(orderId, next.to, () => setConfirm(false))}
      />
    </>
  );
}

/** Statusrad på ordersidan: klickbara steg + nästa steg */
export function StatusControl({
  orderId,
  status,
  totalQty,
}: {
  orderId: string;
  status: OrderStatus;
  totalQty: number;
}) {
  const { pending, run } = useStatusChange();
  const [target, setTarget] = useState<OrderStatus | null>(null);
  const currentIndex = ORDER_FLOW.indexOf(status);
  const next = NEXT[status];

  function request(to: OrderStatus) {
    if (to === status) return;
    if (stockEffect(status, to, totalQty) || to === "makulerad") setTarget(to);
    else run(orderId, to);
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-wrap items-center gap-1" aria-label="Orderstatus">
        {ORDER_FLOW.map((s, i) => {
          const done = status !== "makulerad" && i < currentIndex;
          const current = s === status;
          return (
            <li key={s} className="flex items-center gap-1">
              {i > 0 ? <span className={cn("h-px w-3", done || current ? "bg-brand" : "bg-line")} aria-hidden /> : null}
              <button
                type="button"
                disabled={pending}
                onClick={() => request(s)}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] transition-colors",
                  current && "border-ink bg-ink font-medium text-white",
                  done && "border-brand/30 bg-brand-soft text-brand-strong hover:border-brand",
                  !current && !done && "border-line text-muted hover:border-line-strong hover:text-ink",
                )}
              >
                {done ? <Check className="size-3" strokeWidth={3} /> : null}
                {statusLabel[s]}
              </button>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        {status === "makulerad" ? (
          <>
            <span className="text-[13px] text-muted">Ordern är makulerad.</span>
            <Button size="sm" onClick={() => request("ny")} disabled={pending}>
              Återställ som ny
            </Button>
          </>
        ) : (
          <>
            {next ? (
              <Button variant="primary" onClick={() => request(next.to)} disabled={pending}>
                {next.label}
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={() => request("makulerad")} disabled={pending}>
              Makulera
            </Button>
          </>
        )}
      </div>
      {target ? (
        <ConfirmStatus
          open={Boolean(target)}
          onOpenChange={(o) => !o && setTarget(null)}
          from={status}
          to={target}
          qty={totalQty}
          pending={pending}
          onConfirm={() => run(orderId, target, () => setTarget(null))}
        />
      ) : null}
    </div>
  );
}

export function EditOrderButton({ payload }: { payload: EditPayload }) {
  const { openEdit } = useOrderPanel();
  return (
    <Button onClick={() => openEdit(payload)}>
      <Pencil className="size-3.5" /> Redigera
    </Button>
  );
}

export function NewOrderForCustomerButton({ customerId }: { customerId: string }) {
  const { openNew } = useOrderPanel();
  return (
    <Button variant="primary" onClick={() => openNew({ customerId })}>
      Ny order
    </Button>
  );
}

export function InvoicePanel({
  orderId,
  initial,
  hasPdf,
}: {
  orderId: string;
  initial: {
    invoiceStatus: InvoiceStatus;
    invoiceNumber: string | null;
    invoiceDate: string | null;
    invoiceDueDate: string | null;
    paidAt: string | null;
  };
  hasPdf: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<InvoiceStatus>(initial.invoiceStatus);
  const [invoiceDate, setInvoiceDate] = useState(initial.invoiceDate ?? "");
  const [dueDate, setDueDate] = useState(initial.invoiceDueDate ?? "");
  const [fileName, setFileName] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  function onStatus(v: string) {
    const s = v as InvoiceStatus;
    setStatus(s);
    if (s !== "ej_fakturerad" && !invoiceDate) {
      const d = todayISO();
      setInvoiceDate(d);
      if (!dueDate) setDueDate(addDaysISO(d, 30));
    }
  }

  function submit(formData: FormData) {
    setError(null);
    formData.set("invoiceStatus", status);
    start(async () => {
      const res = await updateInvoice(orderId, formData);
      if (!res.ok) return setError(res.error);
      setFileName(null);
      setFormKey((k) => k + 1);
      toast({ kind: "ok", text: res.message ?? "Sparat" });
      router.refresh();
    });
  }

  return (
    <form key={formKey} action={submit} className="flex flex-col gap-4">
      <Segmented
        value={status}
        onChange={onStatus}
        options={[
          { value: "ej_fakturerad", label: "Ej fakturerad" },
          { value: "fakturerad", label: "Fakturerad" },
          { value: "betald", label: "Betald" },
        ]}
      />
      {status !== "ej_fakturerad" ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fakturanummer">
            <Input name="invoiceNumber" defaultValue={initial.invoiceNumber ?? ""} placeholder="Från Fortnox" />
          </Field>
          <Field label="Fakturadatum">
            <Input
              name="invoiceDate"
              type="date"
              value={invoiceDate}
              onChange={(e) => {
                setInvoiceDate(e.target.value);
                if (e.target.value && !dueDate) setDueDate(addDaysISO(e.target.value, 30));
              }}
            />
          </Field>
          <Field label="Förfallodatum" hint="30 dagar netto föreslås">
            <Input name="invoiceDueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          {status === "betald" ? (
            <Field label="Betald">
              <Input name="paidAt" type="date" defaultValue={initial.paidAt ?? todayISO()} />
            </Field>
          ) : (
            <div />
          )}
        </div>
      ) : (
        <>
          <input type="hidden" name="invoiceNumber" value={initial.invoiceNumber ?? ""} />
          <input type="hidden" name="invoiceDate" value="" />
          <input type="hidden" name="invoiceDueDate" value="" />
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {hasPdf ? (
          <>
            <a
              href={`/api/faktura/${orderId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-3 text-[13px] font-medium hover:bg-hover"
            >
              <FileText className="size-4 text-danger" /> Öppna faktura-PDF
            </a>
            <DeletePdfButton orderId={orderId} />
          </>
        ) : null}
        <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-[13px] text-muted hover:bg-hover hover:text-ink">
          <Upload className="size-4" />
          {fileName ?? (hasPdf ? "Byt PDF" : "Ladda upp PDF")}
          <input
            type="file"
            name="pdf"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
        </label>
      </div>

      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Sparar…" : "Spara faktura"}
        </Button>
      </div>
    </form>
  );
}

function DeletePdfButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label="Ta bort PDF"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await deleteInvoicePdf(orderId);
          router.refresh();
        })
      }
      className="rounded-md p-2 text-subtle hover:bg-hover hover:text-danger"
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}

export function CommentBox({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        start(async () => {
          const res = await addOrderComment(orderId, text);
          if (!res.ok) return toast({ kind: "error", text: res.error });
          setText("");
          router.refresh();
        });
      }}
      className="flex flex-col gap-2"
    >
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Skriv en anteckning, t.ex. ”Ringde Anna, levererar på fredag”"
        className="min-h-[56px]"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") (e.currentTarget.form as HTMLFormElement).requestSubmit();
        }}
      />
      <div>
        <Button type="submit" size="sm" disabled={pending || !text.trim()}>
          Lägg till anteckning
        </Button>
      </div>
    </form>
  );
}
