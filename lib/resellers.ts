import { z } from "zod";
import { addDaysISO } from "@/lib/format";

export const optionalDate = z
  .string()
  .trim()
  .nullish()
  .transform((v) => v || null)
  .refine((v) => {
    if (!v) return true;
    return (
      /^\d{4}-\d{2}-\d{2}$/.test(v) &&
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v
    );
  }, "Ogiltigt datum");
export const optionalText = z
  .string()
  .trim()
  .nullish()
  .transform((v) => v || null);
export const resellerSchema = z.object({
  name: z.string().trim().max(500).default(""),
  address: optionalText,
  postal_code: optionalText,
  city: optionalText,
  invoice_email: optionalText,
  phone: optionalText,
  org_number: optionalText,
  invoice_reference: optionalText,
  contacts: z
    .array(z.object({ name: z.string().trim(), email: z.string().trim() }))
    .max(100)
    .default([]),
});
export const deliverySchema = z.object({
  id: z.string().uuid().optional(),
  customerId: z.string().uuid().nullish(),
  newReseller: resellerSchema.optional(),
  deliveredOn: optionalDate,
  followUpOn: optionalDate,
  followUpManual: z.boolean().default(false),
  note: optionalText,
  shipName: optionalText,
  shipAddress: optionalText,
  shipPostalCode: optionalText,
  shipCity: optionalText,
  unitPrice: z.number().finite().min(0).max(99999999).nullable().optional(),
  lines: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().min(0).max(1000000),
      }),
    )
    .default([]),
  legacyQuantity: z.number().int().min(0).optional(),
});
export type ResellerInput = z.input<typeof resellerSchema>;
export type DeliveryInput = z.input<typeof deliverySchema>;
export function followUpDate(
  delivered: string | null,
  manual: boolean,
  chosen: string | null,
) {
  return manual ? chosen : delivered ? addDaysISO(delivered, 30) : null;
}
export const shipmentWeight = (lines: { quantity: number }[]) =>
  lines.reduce((n, l) => n + l.quantity, 0) * 190;
