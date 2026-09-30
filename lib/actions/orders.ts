"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { SHIPPED_STATUSES, statusLabel } from "@/lib/labels";
import { removeInvoicePdf, uploadInvoicePdf } from "@/lib/storage";
import type { ActionResult, OrderStatus } from "@/lib/types";
import { todayISO } from "@/lib/format";

const opt = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .transform((v) => v ?? null);

const optDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .transform((v) => v ?? null)
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Ogiltigt datum");

const statusEnum = z.enum(["ny", "bekraftad", "ska_packas", "skickad", "levererad", "avslutad", "makulerad"]);

const orderSchema = z.object({
  id: z.string().uuid().optional(),
  customerId: z.string().uuid().nullable().optional(),
  newCustomer: z
    .object({
      name: z.string().trim().min(1, "Ange kundens namn"),
      type: z.enum(["privat", "foretag", "aterforsaljare"]),
    })
    .nullable()
    .optional(),
  source: z.enum(["shopify", "foretag", "aterforsaljare", "annat"]),
  orderDate: optDate,
  contactName: opt,
  contactEmail: opt,
  contactPhone: opt,
  shipName: opt,
  shipAddress: opt,
  shipPostalCode: opt,
  shipCity: opt,
  shipCountry: opt,
  trackingNumber: opt,
  invoiceEmail: opt,
  invoiceReference: opt,
  comment: opt,
  initialStatus: z.enum(["ny", "bekraftad"]).optional(),
  saveToCustomer: z.boolean().optional(),
  lines: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().min(0).max(1_000_000),
        unitPrice: z.number().min(0).nullable().optional(),
      }),
    )
    .transform((l) => l.filter((x) => x.quantity > 0)),
});

export type OrderInput = z.input<typeof orderSchema>;

function fail(e: unknown): ActionResult {
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Ogiltiga uppgifter" };
  const msg = e instanceof Error ? e.message : String(e);
  console.error(e);
  return { ok: false, error: msg };
}

export async function saveOrder(raw: OrderInput): Promise<ActionResult & { orderNumber?: number }> {
  try {
    const user = await requireUser();
    const input = orderSchema.parse(raw);
    if (input.lines.length === 0) return { ok: false, error: "Lägg till minst en kortlek." };
    if (!input.customerId && !input.newCustomer)
      return { ok: false, error: "Välj en kund eller skriv in en ny." };

    const result = await sql.begin(async (tx) => {
      // Ny kund skapas i samma transaktion
      let customerId = input.customerId ?? null;
      if (!customerId && input.newCustomer) {
        const [c] = await tx<{ id: string }[]>`
          insert into customers (name, type, contact_name, email, phone, address, postal_code, city,
                                 invoice_email, invoice_reference)
          values (${input.newCustomer.name}, ${input.newCustomer.type}, ${input.contactName},
                  ${input.contactEmail}, ${input.contactPhone}, ${input.shipAddress},
                  ${input.shipPostalCode}, ${input.shipCity}, ${input.invoiceEmail}, ${input.invoiceReference})
          returning id`;
        customerId = c.id;
      } else if (customerId && input.saveToCustomer) {
        // Fyll bara i det som saknas hos kunden – skriv aldrig över befintliga uppgifter
        await tx`
          update customers set
            contact_name      = coalesce(contact_name, ${input.contactName}),
            email             = coalesce(email, ${input.contactEmail}),
            phone             = coalesce(phone, ${input.contactPhone}),
            address           = coalesce(address, ${input.shipAddress}),
            postal_code       = coalesce(postal_code, ${input.shipPostalCode}),
            city              = coalesce(city, ${input.shipCity}),
            invoice_email     = coalesce(invoice_email, ${input.invoiceEmail}),
            invoice_reference = coalesce(invoice_reference, ${input.invoiceReference})
          where id = ${customerId}`;
      }

      const fields = {
        customer_id: customerId,
        source: input.source,
        contact_name: input.contactName,
        contact_email: input.contactEmail,
        contact_phone: input.contactPhone,
        ship_name: input.shipName,
        ship_address: input.shipAddress,
        ship_postal_code: input.shipPostalCode,
        ship_city: input.shipCity,
        ship_country: input.shipCountry ?? "SE",
        tracking_number: input.trackingNumber,
        invoice_email: input.invoiceEmail,
        invoice_reference: input.invoiceReference,
        comment: input.comment,
      };

      let orderId: string;
      let orderNumber: number;

      if (input.id) {
        const [existing] = await tx<{ status: OrderStatus }[]>`
          select status from orders where id = ${input.id} for update`;
        if (!existing) throw new Error("Ordern finns inte längre.");

        const [row] = await tx<{ id: string; order_number: number }[]>`
          update orders set ${tx(fields)}, order_date = coalesce(${input.orderDate}, order_date)
          where id = ${input.id} returning id, order_number`;
        orderId = row.id;
        orderNumber = row.order_number;

        const shipped = SHIPPED_STATUSES.includes(existing.status);
        const current = await tx<{ product_id: number; quantity: number; unit_price: string | null }[]>`
          select product_id, quantity, unit_price from order_lines where order_id = ${orderId}`;
        const key = (l: { product_id: number; quantity: number }) => `${l.product_id}:${l.quantity}`;
        const before = current.map(key).sort().join(",");
        const after = input.lines
          .map((l) => key({ product_id: l.productId, quantity: l.quantity }))
          .sort()
          .join(",");

        if (shipped && before !== after) {
          throw new Error(
            "Ordern är redan skickad, så antalet kan inte ändras. Backa statusen först om det blev fel.",
          );
        }

        await tx`delete from order_lines where order_id = ${orderId}`;
        await tx`
          insert into order_lines ${tx(
            input.lines.map((l) => ({
              order_id: orderId,
              product_id: l.productId,
              quantity: l.quantity,
              unit_price: l.unitPrice ?? null,
            })),
          )}`;
        await tx`insert into order_events (order_id, kind, note, created_by)
                 values (${orderId}, 'andrad', 'Ordern uppdaterades', ${user.id})`;
      } else {
        const [row] = await tx<{ id: string; order_number: number }[]>`
          insert into orders ${tx({ ...fields, created_by: user.id })}
          returning id, order_number`;
        orderId = row.id;
        orderNumber = row.order_number;
        if (input.orderDate) await tx`update orders set order_date = ${input.orderDate} where id = ${orderId}`;

        await tx`
          insert into order_lines ${tx(
            input.lines.map((l) => ({
              order_id: orderId,
              product_id: l.productId,
              quantity: l.quantity,
              unit_price: l.unitPrice ?? null,
            })),
          )}`;
        await tx`insert into order_events (order_id, kind, to_value, created_by)
                 values (${orderId}, 'skapad', 'ny', ${user.id})`;

        if (input.initialStatus && input.initialStatus !== "ny") {
          await tx`select set_order_status(${orderId}, ${input.initialStatus}::order_status, ${user.id}, null)`;
        }
      }
      return { orderId, orderNumber };
    });

    revalidatePath("/", "layout");
    return { ok: true, id: result.orderId, orderNumber: result.orderNumber };
  } catch (e) {
    return fail(e);
  }
}

export async function changeOrderStatus(orderId: string, status: OrderStatus): Promise<ActionResult> {
  try {
    const user = await requireUser();
    statusEnum.parse(status);
    await sql`select set_order_status(${orderId}, ${status}::order_status, ${user.id}, null)`;
    revalidatePath("/", "layout");
    return { ok: true, message: `Status: ${statusLabel[status]}` };
  } catch (e) {
    return fail(e);
  }
}

const invoiceSchema = z.object({
  invoiceStatus: z.enum(["ej_fakturerad", "fakturerad", "betald"]),
  invoiceNumber: opt,
  invoiceDate: optDate,
  invoiceDueDate: optDate,
  paidAt: optDate,
});

const invoiceWord = { ej_fakturerad: "Ej fakturerad", fakturerad: "Fakturerad", betald: "Betald" } as const;

export async function updateInvoice(orderId: string, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const input = invoiceSchema.parse({
      invoiceStatus: formData.get("invoiceStatus"),
      invoiceNumber: formData.get("invoiceNumber"),
      invoiceDate: formData.get("invoiceDate"),
      invoiceDueDate: formData.get("invoiceDueDate"),
      paidAt: formData.get("paidAt"),
    });

    if (input.invoiceStatus === "fakturerad" && !input.invoiceDueDate)
      return { ok: false, error: "Ange förfallodatum, annars kan systemet inte se när fakturan förfaller." };

    const file = formData.get("pdf");
    let pdfPath: string | undefined;
    if (file instanceof File && file.size > 0) {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))
        return { ok: false, error: "Fakturan måste vara en PDF." };
      if (file.size > 10 * 1024 * 1024) return { ok: false, error: "PDF:en får vara högst 10 MB." };
      const safe = (input.invoiceNumber ?? "faktura").replace(/[^a-zA-Z0-9_-]/g, "");
      pdfPath = `${orderId}/${safe || "faktura"}-${Date.now()}.pdf`;
      await uploadInvoicePdf(pdfPath, file);
    }

    const [before] = await sql<{ invoice_status: string; invoice_pdf_path: string | null }[]>`
      select invoice_status, invoice_pdf_path from orders where id = ${orderId}`;
    if (!before) return { ok: false, error: "Ordern finns inte." };

    const paidAt =
      input.invoiceStatus === "betald" ? (input.paidAt ?? todayISO()) : null;

    await sql`
      update orders set
        invoice_status   = ${input.invoiceStatus},
        invoice_number   = ${input.invoiceNumber},
        invoice_date     = ${input.invoiceDate},
        invoice_due_date = ${input.invoiceDueDate},
        paid_at          = ${paidAt}
        ${pdfPath ? sql`, invoice_pdf_path = ${pdfPath}` : sql``}
      where id = ${orderId}`;

    if (pdfPath && before.invoice_pdf_path) await removeInvoicePdf(before.invoice_pdf_path).catch(() => {});

    const changed = before.invoice_status !== input.invoiceStatus;
    const notes = [pdfPath ? "PDF uppladdad" : null, input.invoiceNumber ? `Faktura ${input.invoiceNumber}` : null]
      .filter(Boolean)
      .join(" · ");
    if (changed || pdfPath) {
      await sql`
        insert into order_events (order_id, kind, from_value, to_value, note, created_by)
        values (${orderId}, 'faktura',
                ${changed ? invoiceWord[before.invoice_status as keyof typeof invoiceWord] : null},
                ${changed ? invoiceWord[input.invoiceStatus] : null},
                ${notes || null}, ${user.id})`;
    }

    revalidatePath("/", "layout");
    return { ok: true, message: "Fakturauppgifterna sparades" };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteInvoicePdf(orderId: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const [o] = await sql<{ invoice_pdf_path: string | null }[]>`
      select invoice_pdf_path from orders where id = ${orderId}`;
    if (o?.invoice_pdf_path) await removeInvoicePdf(o.invoice_pdf_path);
    await sql`update orders set invoice_pdf_path = null where id = ${orderId}`;
    await sql`insert into order_events (order_id, kind, note, created_by)
              values (${orderId}, 'faktura', 'PDF borttagen', ${user.id})`;
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function addOrderComment(orderId: string, text: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const note = z.string().trim().min(1, "Skriv en kommentar").max(2000).parse(text);
    await sql`insert into order_events (order_id, kind, note, created_by)
              values (${orderId}, 'kommentar', ${note}, ${user.id})`;
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
