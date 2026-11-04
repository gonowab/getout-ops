import { z } from "zod";

export const shippingDetailsSchema = z.object({
  reference: z.string().trim().min(1, "Ange en fraktreferens").max(35, "Fraktreferensen får vara högst 35 tecken")
    .refine((v) => !/[\r\n\x00-\x1f\x7f]/.test(v), "Referensen får inte innehålla radbrytningar"),
  email: z.string().trim().max(254).refine((v) => v === "" || z.email().safeParse(v).success, "Ange en giltig mejladress"),
  phone: z.string().trim().max(30, "Mobilnumret får vara högst 30 tecken")
    .refine((v) => v === "" || /^\+?[\d\s()-]+$/.test(v) && v.replace(/\D/g, "").length >= 6, "Ange ett giltigt mobilnummer"),
});

export type ShippingDetails = z.infer<typeof shippingDetailsSchema>;

export function defaultShippingDetails(orderNumber: number, shopifyName: string | null, email: string | null, phone: string | null): ShippingDetails {
  return {
    reference: [`GO-${orderNumber}`, shopifyName].filter(Boolean).join(" ").slice(0, 35),
    email: email ?? "",
    phone: phone ?? "",
  };
}
