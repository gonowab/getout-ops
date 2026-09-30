import type { CustomerType, InvoiceStatus, MovementType, OrderSource, OrderStatus, Product } from "./types";

export const ORDER_FLOW: OrderStatus[] = [
  "ny",
  "bekraftad",
  "ska_packas",
  "skickad",
  "levererad",
  "avslutad",
];

export const SHIPPED_STATUSES: OrderStatus[] = ["skickad", "levererad", "avslutad"];

export const statusLabel: Record<OrderStatus, string> = {
  ny: "Ny",
  bekraftad: "Bekräftad",
  ska_packas: "Ska packas",
  skickad: "Skickad",
  levererad: "Levererad",
  avslutad: "Avslutad",
  makulerad: "Makulerad",
};

/** Färg för statusprick – tailwind-klass */
export const statusTone: Record<OrderStatus, string> = {
  ny: "bg-sky-500",
  bekraftad: "bg-violet-500",
  ska_packas: "bg-amber-500",
  skickad: "bg-teal-500",
  levererad: "bg-brand",
  avslutad: "bg-stone-400",
  makulerad: "bg-stone-300",
};

export type InvoiceDisplay = InvoiceStatus | "forfallen";

export const invoiceLabel: Record<InvoiceDisplay, string> = {
  ej_fakturerad: "Ej fakturerad",
  fakturerad: "Fakturerad",
  betald: "Betald",
  forfallen: "Förfallen",
};

export const invoiceTone: Record<InvoiceDisplay, string> = {
  ej_fakturerad: "text-muted",
  fakturerad: "text-sky-700",
  betald: "text-brand-strong",
  forfallen: "text-danger",
};

export function invoiceDisplay(status: InvoiceStatus, overdue: boolean): InvoiceDisplay {
  return overdue ? "forfallen" : status;
}

export const sourceLabel: Record<OrderSource, string> = {
  shopify: "Shopify",
  foretag: "Företag",
  aterforsaljare: "Återförsäljare",
  annat: "Annat",
};

export const customerTypeLabel: Record<CustomerType, string> = {
  foretag: "Företag",
  aterforsaljare: "Återförsäljare",
  privat: "Privatperson",
};

export const movementLabel: Record<MovementType, string> = {
  inleverans: "Inleverans",
  order: "Order",
  justering: "Justering",
  retur: "Retur",
};

export function editionLabel(edition: Product["edition"]) {
  return edition === "gammal" ? "Gammal ask" : "Ny ask";
}

export function productLabel(p: Pick<Product, "region" | "edition">) {
  return `${p.region} (${p.edition === "gammal" ? "gammal ask" : "ny ask"})`;
}

export function orderRef(n: number) {
  return `GO-${n}`;
}
