"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { Segmented } from "@/components/order-form";
import { useToast } from "@/components/toast";
import { sendTrackingToShopify, setShippingService } from "@/lib/actions/shipping";
import { shippingServiceLabel } from "@/lib/labels";
import type { OrderStatus, ShippingService } from "@/lib/types";

/** Frakt på ordersidan: fraktsätt, vikt och spårningsnummer som skickas till Shopify */
export function ShippingPanel({
  orderId,
  status,
  service,
  weightGrams,
  trackingNumber,
  isShopify,
  shopifyFulfilled,
}: {
  orderId: string;
  status: OrderStatus;
  service: ShippingService;
  weightGrams: number | null;
  trackingNumber: string | null;
  isShopify: boolean;
  shopifyFulfilled: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [svc, setSvc] = useState<ShippingService>(service);
  const [tracking, setTracking] = useState(trackingNumber ?? "");
  const locked = status === "makulerad";
  const done = isShopify ? shopifyFulfilled : Boolean(trackingNumber);

  const changeService = (v: string) => {
    const next = v as ShippingService;
    setSvc(next);
    start(async () => {
      const res = await setShippingService(orderId, next);
      if (!res.ok) {
        setSvc(service);
        toast({ kind: "error", text: res.error });
      } else router.refresh();
    });
  };

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
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] text-muted">Fraktsätt PostNord</span>
        {done || locked ? (
          <span className="text-[13px] text-ink">{shippingServiceLabel[svc]}</span>
        ) : (
          <Segmented
            value={svc}
            onChange={changeService}
            options={[
              { value: "home_small", label: shippingServiceLabel.home_small },
              { value: "home_small_prio", label: shippingServiceLabel.home_small_prio },
            ]}
          />
        )}
        <span className="text-[12px] text-muted">
          {weightGrams ? `Vikt ${weightGrams} g` : "Vikt saknas"}
        </span>
      </div>

      {done ? (
        <div className="grid grid-cols-[104px_1fr] gap-2 text-[13px]">
          <span className="text-muted">Spårning</span>
          <span className="min-w-0 break-words text-ink">
            <a
              href={`https://tracking.postnord.com/se/?id=${encodeURIComponent(trackingNumber ?? "")}`}
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
            >
              {trackingNumber}
            </a>
            {isShopify ? <span className="block text-[12px] text-muted">Skickad i Shopify, kunden har fått mejl</span> : null}
          </span>
        </div>
      ) : locked ? null : (
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
            <Button type="submit" variant="primary" disabled={pending || tracking.trim() === ""}>
              <Send className="size-3.5" />
              {pending ? "Skickar…" : isShopify ? "Skicka" : "Spara"}
            </Button>
          </div>
          <span className="text-[12px] text-muted">
            {isShopify
              ? "Läggs in i Shopify, ordern markeras som skickad och kunden får ett mejl med spårningslänk."
              : "Ordern markeras som skickad och lagret dras."}
          </span>
        </form>
      )}
    </div>
  );
}
