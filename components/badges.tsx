import { cn } from "@/components/ui";
import {
  invoiceDisplay,
  invoiceLabel,
  invoiceTone,
  sourceLabel,
  statusLabel,
  statusTone,
} from "@/lib/labels";
import type { InvoiceStatus, OrderSource, OrderStatus } from "@/lib/types";

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[13px] text-ink",
        status === "makulerad" && "text-muted line-through decoration-subtle",
        className,
      )}
    >
      <span className={cn("size-2 shrink-0 rounded-full", statusTone[status])} aria-hidden />
      {statusLabel[status]}
    </span>
  );
}

export function InvoiceBadge({
  status,
  overdue,
  className,
}: {
  status: InvoiceStatus;
  overdue: boolean;
  className?: string;
}) {
  const d = invoiceDisplay(status, overdue);
  return (
    <span
      className={cn(
        "text-[13px]",
        invoiceTone[d],
        d === "forfallen" && "rounded bg-danger-soft px-1.5 py-px font-medium",
        className,
      )}
    >
      {invoiceLabel[d]}
    </span>
  );
}

export function SourceLabel({ source }: { source: OrderSource }) {
  return <span className="text-[13px] text-muted">{sourceLabel[source]}</span>;
}
