export const expensePeople = ["Noah", "Ludvig", "Oskar", "Filip"] as const;
export const expenseStatuses = {
  pending: "Att ersätta",
  paid: "Utbetald",
  rejected: "Avslagen",
} as const;

export type ExpenseStatus = keyof typeof expenseStatuses;
export const receiptMaxBytes = 900_000;
export const pdfReceiptType = "application/pdf";
export const pdfReceiptHeader = "%PDF-";

export function isPdfReceipt(bytes: Uint8Array) {
  const decoder = new TextDecoder();
  const header = decoder.decode(bytes.subarray(0, 8));
  const tail = decoder.decode(bytes.subarray(-1024));
  return /^%PDF-[12]\.\d$/.test(header) && /%%EOF[\t\n\f\r ]*$/.test(tail);
}

export const expenseIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseExpenseAmount(input: string) {
  const match = /^(\d{1,6})(?:[,.](\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  const ore = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return ore > 0 ? ore : null;
}

const currency = new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK" });
export const formatExpenseAmount = (ore: number) => currency.format(ore / 100);
