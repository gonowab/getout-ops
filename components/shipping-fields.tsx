"use client";

import { Input } from "@/components/ui";
import type { ShippingDetails } from "@/lib/shipping-details";

export function ShippingFields({ id, value, onChange, disabled }: {
  id: string;
  value: ShippingDetails;
  onChange: (value: ShippingDetails) => void;
  disabled: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="grid min-w-0 gap-2 text-[12px]">
      <legend className="mb-2 font-medium text-ink">Uppgifter till PostNord</legend>
      <label htmlFor={`${id}-reference`} className="grid gap-1 text-muted">
        Referens på fraktsedeln (max 35 tecken)
        <Input id={`${id}-reference`} value={value.reference} maxLength={35} required
          onChange={(e) => onChange({ ...value, reference: e.target.value })} />
      </label>
      <label htmlFor={`${id}-email`} className="grid gap-1 text-muted">
        Mottagarens mejladress
        <Input id={`${id}-email`} type="email" value={value.email} maxLength={254}
          onChange={(e) => onChange({ ...value, email: e.target.value })} />
      </label>
      <label htmlFor={`${id}-phone`} className="grid gap-1 text-muted">
        Mottagarens mobilnummer
        <Input id={`${id}-phone`} type="tel" value={value.phone} maxLength={30}
          placeholder="t.ex. +46701234567"
          onChange={(e) => onChange({ ...value, phone: e.target.value })} />
      </label>
      <p className="text-muted">Gäller denna fraktbokning. Kundens kontaktuppgifter ändras inte.</p>
    </fieldset>
  );
}
