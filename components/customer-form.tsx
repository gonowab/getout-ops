"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { saveCustomer } from "@/lib/actions/customers";
import type { Customer } from "@/lib/types";

export function CustomerFormButton({ customer }: { customer?: Customer }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const formId = customer ? `customer-${customer.id}` : "customer-new";

  function onSubmit(formData: FormData) {
    setError(null);
    start(async () => {
      const res = await saveCustomer(customer?.id ?? null, formData);
      if (!res.ok) return setError(res.error);
      setOpen(false);
      toast({ kind: "ok", text: res.message ?? "Sparat" });
      if (!customer && res.id) router.push(`/kunder/${res.id}`);
      else router.refresh();
    });
  }

  const c = customer;
  return (
    <>
      {customer ? (
        <Button onClick={() => setOpen(true)}>
          <Pencil className="size-3.5" /> Redigera
        </Button>
      ) : (
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Ny kund
        </Button>
      )}
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={customer ? `Redigera ${customer.name}` : "Ny kund"}
        width="max-w-[560px]"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
            <Button variant="primary" type="submit" form={formId} disabled={pending}>
              {pending ? "Sparar…" : "Spara kund"}
            </Button>
          </div>
        }
      >
        <form id={formId} action={onSubmit} className="flex flex-col gap-6">
          {error ? (
            <div role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">
              {error}
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Namn" className="sm:col-span-2">
              <Input name="name" defaultValue={c?.name} required autoFocus />
            </Field>
            <Field label="Typ">
              <Select name="type" defaultValue={c?.type ?? "foretag"}>
                <option value="foretag">Företag</option>
                <option value="aterforsaljare">Återförsäljare</option>
                <option value="privat">Privatperson</option>
              </Select>
            </Field>
            <Field label="Organisationsnummer">
              <Input name="org_number" defaultValue={c?.org_number ?? ""} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Kontaktperson">
              <Input name="contact_name" defaultValue={c?.contact_name ?? ""} />
            </Field>
            <Field label="E-post">
              <Input name="email" type="email" defaultValue={c?.email ?? ""} />
            </Field>
            <Field label="Telefon">
              <Input name="phone" type="tel" defaultValue={c?.phone ?? ""} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr]">
            <Field label="Adress">
              <Input name="address" defaultValue={c?.address ?? ""} />
            </Field>
            <Field label="Postnummer">
              <Input name="postal_code" defaultValue={c?.postal_code ?? ""} />
            </Field>
            <Field label="Ort">
              <Input name="city" defaultValue={c?.city ?? ""} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Fakturamejl">
              <Input name="invoice_email" type="email" defaultValue={c?.invoice_email ?? ""} />
            </Field>
            <Field label="Er referens / kostnadsställe">
              <Input name="invoice_reference" defaultValue={c?.invoice_reference ?? ""} />
            </Field>
          </div>

          <Field label="Anteckningar">
            <Textarea name="notes" defaultValue={c?.notes ?? ""} placeholder="T.ex. önskemål, avtal, vem som brukar beställa" />
          </Field>
        </form>
      </Sheet>
    </>
  );
}
