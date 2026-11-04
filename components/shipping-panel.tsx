"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Printer, Send, Truck, X } from "lucide-react";
import { Button, Input, buttonClass } from "@/components/ui";
import { useToast } from "@/components/toast";
import { bookWithPostnord, sendTrackingToShopify, updateOrderWeight } from "@/lib/actions/shipping";
import { ShippingFields } from "@/components/shipping-fields";
import { shippingDetailsSchema, type ShippingDetails } from "@/lib/shipping-details";
import { SHIPPING_SERVICE } from "@/lib/labels";
import type { OrderStatus } from "@/lib/types";

/** Frakt på ordersidan: boka hos PostNord, skriv ut etikett, spårning till Shopify */
export function ShippingPanel({
  orderId,
  orderNumber,
  shippingDetails,
  status,
  weightGrams,
  trackingNumber,
  isShopify,
  shopifyFulfilled,
  booked,
  bookingBlocked,
}: {
  orderId: string;
  orderNumber: number;
  shippingDetails: ShippingDetails;
  status: OrderStatus;
  weightGrams: number | null;
  trackingNumber: string | null;
  isShopify: boolean;
  shopifyFulfilled: boolean;
  booked: boolean;
  /** Varför bokning inte går just nu, eller null om den går */
  bookingBlocked: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [tracking, setTracking] = useState(trackingNumber ?? "");
  const [details, setDetails] = useState(shippingDetails);
  const [manual, setManual] = useState(false);
  const [editingWeight, setEditingWeight] = useState(false);
  const [weight, setWeight] = useState(weightGrams ? String(weightGrams) : "");
  const locked = status === "makulerad";
  const canEditWeight = !locked && !booked;

  const saveWeight = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await updateOrderWeight(orderId, weight);
      if (!res.ok) toast({ kind: "error", text: res.error });
      else {
        toast({ kind: "ok", text: res.message ?? "Sparat" });
        setEditingWeight(false);
        router.refresh();
      }
    });
  };
  const done = Boolean(trackingNumber) && (!isShopify || shopifyFulfilled);
  const canShip = !locked && ["ny", "bekraftad", "ska_packas"].includes(status);

  const book = () =>
    start(async () => {
      const parsed = shippingDetailsSchema.safeParse(details);
      if (!parsed.success) {
        toast({ kind: "error", text: parsed.error.issues[0].message });
        return;
      }
      const res = await bookWithPostnord([orderId], { [orderId]: parsed.data });
      if (res.failed.length) toast({ kind: "error", text: res.failed[0].error });
      else toast({ kind: "ok", text: `Bokad hos PostNord: ${res.booked[0]?.trackingNumber}` });
      router.refresh();
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await sendTrackingToShopify(orderId, tracking);
      if (!res.ok) toast({ kind: "error", text: res.error });
      else {
        toast({ kind: "ok", text: res.message ?? "Sparat" });
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[104px_1fr] gap-2 text-[13px]">
        <span className="text-muted">Frakt</span>
        <span className="min-w-0 text-ink">
          {SHIPPING_SERVICE.name}
          {editingWeight ? (
            <form onSubmit={saveWeight} className="mt-1 flex items-center gap-2">
              <Input
                id={`weight-${orderId}`}
                aria-label="Vikt i gram"
                type="number"
                inputMode="numeric"
                min={1}
                max={3000}
                step={1}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="gram"
                autoFocus
                className="w-24"
              />
              <span className="text-[12px] text-muted">g</span>
              <Button type="submit" variant="secondary" disabled={pending} aria-label="Spara vikt">
                <Check className="size-3.5" />
                {pending ? "Sparar…" : "Spara"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                aria-label="Avbryt"
                onClick={() => {
                  setWeight(weightGrams ? String(weightGrams) : "");
                  setEditingWeight(false);
                }}
              >
                <X className="size-3.5" />
              </Button>
            </form>
          ) : (
            <span className="flex items-center gap-2 text-[12px] text-muted">
              {weightGrams ? `${weightGrams} g` : "Vikt saknas"}
              {canEditWeight ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 underline-offset-2 hover:text-ink hover:underline"
                  onClick={() => {
                    setWeight(weightGrams ? String(weightGrams) : "");
                    setEditingWeight(true);
                  }}
                >
                  <Pencil className="size-3" /> Ändra vikt
                </button>
              ) : null}
            </span>
          )}
        </span>
      </div>

      {trackingNumber ? (
        <div className="grid grid-cols-[104px_1fr] gap-2 text-[13px]">
          <span className="text-muted">Spårning</span>
          <span className="min-w-0 break-words text-ink">
            <a
              href={`https://tracking.postnord.com/se/?id=${encodeURIComponent(trackingNumber)}`}
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
            >
              {trackingNumber}
            </a>
            {isShopify && shopifyFulfilled ? (
              <span className="block text-[12px] text-muted">Skickad i Shopify, kunden har fått mejl</span>
            ) : null}
          </span>
        </div>
      ) : null}

      {booked && trackingNumber ? (
        <a
          href={`/api/etiketter?ordrar=${orderNumber}`}
          target="_blank"
          rel="noreferrer"
          className={buttonClass("secondary", "md", "w-fit")}
        >
          <Printer className="size-3.5" /> Skriv ut etikett
        </a>
      ) : null}

      {!done && canShip && !trackingNumber ? (
        <div className="flex flex-col gap-1.5">
          <ShippingFields id={`shipping-${orderId}`} value={details} onChange={setDetails} disabled={pending} />
          <Button variant="primary" className="w-fit" disabled={pending || Boolean(bookingBlocked)} onClick={book}>
            <Truck className="size-3.5" />
            {pending ? "Bokar…" : "Boka hos PostNord"}
          </Button>
          <span className="text-[12px] text-muted">
            {bookingBlocked ??
              (isShopify
                ? "Bokar Home Small Prio och mejlar kunden spårningslänken. Ordern ligger kvar under Att packa tills du markerar den som skickad."
                : "Bokar Home Small Prio. Ordern ligger kvar under Att packa tills du markerar den som skickad.")}
          </span>
          {!manual ? (
            <button
              type="button"
              className="w-fit text-[12px] text-muted underline-offset-2 hover:text-ink hover:underline"
              onClick={() => setManual(true)}
            >
              Lägg in spårningsnummer själv
            </button>
          ) : null}
        </div>
      ) : null}

      {!done && !locked && (manual || (trackingNumber && !booked)) ? (
        <form onSubmit={submit} className="flex flex-col gap-1.5">
          <label htmlFor={`tracking-${orderId}`} className="text-[12px] text-muted">
            Spårningsnummer (kolli-ID)
          </label>
          <div className="flex gap-2">
            <Input
              id={`tracking-${orderId}`}
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="t.ex. 00370712345678901234"
              autoComplete="off"
              className="min-w-0 flex-1"
            />
            <Button type="submit" variant="secondary" disabled={pending || tracking.trim() === ""}>
              <Send className="size-3.5" />
              {pending ? "Skickar…" : isShopify ? "Skicka" : "Spara"}
            </Button>
          </div>
        </form>
      ) : null}

      {booked && trackingNumber && isShopify && !shopifyFulfilled && !locked ? (
        <Button
          variant="secondary"
          className="w-fit"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await sendTrackingToShopify(orderId, trackingNumber);
              if (!res.ok) toast({ kind: "error", text: res.error });
              else toast({ kind: "ok", text: res.message ?? "Skickad i Shopify" });
              router.refresh();
            })
          }
        >
          <Send className="size-3.5" /> Försök skicka till Shopify igen
        </Button>
      ) : null}
    </div>
  );
}
