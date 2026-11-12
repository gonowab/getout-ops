"use client";

import { useState, useTransition, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import {
  saveDelivery,
  saveReseller,
  saveResellerNote,
} from "@/lib/actions/resellers";
import { addDaysISO } from "@/lib/format";
import { shipmentWeight, type ResellerInput } from "@/lib/resellers";
import type {
  ActionResult,
  Product,
  Reseller,
  ResellerHistory,
  ResellerNote,
} from "@/lib/types";

// Behåll formulärvärden även när servervalideringen misslyckas.
function ClientForm({
  action,
  ...props
}: { action: (form: FormData) => void } & Omit<
  ComponentProps<"form">,
  "action"
>) {
  return (
    <form
      {...props}
      onSubmit={(event) => {
        event.preventDefault();
        action(new FormData(event.currentTarget));
      }}
    />
  );
}

function useSave() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  function run(work: () => Promise<ActionResult>, done?: () => void) {
    setError(null);
    start(async () => {
      try {
        const res = await work();
        if (!res.ok) {
          setError(res.error);
          return;
        }
        toast({ kind: "ok", text: res.message ?? "Sparat" });
        done?.();
        router.refresh();
      } catch {
        setError("Kunde inte spara. Försök igen.");
      }
    });
  }
  return { pending, error, run };
}
function SaveFooter({
  pending,
  error,
  label = "Spara",
}: {
  pending: boolean;
  error: string | null;
  label?: string;
}) {
  return (
    <div className="col-span-full flex flex-wrap items-center gap-3">
      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Sparar…" : label}
      </Button>
    </div>
  );
}
export function ResellerFields({
  reseller,
  prefix = "",
  contacts,
  setContacts,
}: {
  reseller?: Reseller;
  prefix?: string;
  contacts: { name: string; email: string }[];
  setContacts: (c: { name: string; email: string }[]) => void;
}) {
  return (
    <>
      {[
        ["name", "Namn"],
        ["address", "Adress"],
        ["postal_code", "Postnummer"],
        ["city", "Ort"],
        ["invoice_email", "Fakturamejl"],
        ["phone", "Telefon"],
        ["org_number", "Organisationsnummer"],
        ["invoice_reference", "Fakturareferens"],
      ].map(([key, label]) => (
        <Field key={key} label={label}>
          <Input
            aria-label={label}
            name={prefix + key}
            defaultValue={(reseller?.[key as keyof Reseller] as string) ?? ""}
          />
        </Field>
      ))}
      <div className="col-span-full space-y-2">
        <h4 className="text-[13px] font-medium">Kontaktpersoner</h4>
        {contacts.map((contact, i) => (
          <div key={i} className="flex flex-wrap gap-2">
            <Input
              className="min-w-40 flex-1"
              aria-label={`Kontaktperson ${i + 1}, namn`}
              placeholder="Namn"
              value={contact.name}
              onChange={(e) =>
                setContacts(
                  contacts.map((c, j) =>
                    j === i ? { ...c, name: e.target.value } : c,
                  ),
                )
              }
            />
            <Input
              className="min-w-40 flex-1"
              aria-label={`Kontaktperson ${i + 1}, mejladress`}
              placeholder="Mejladress"
              value={contact.email}
              onChange={(e) =>
                setContacts(
                  contacts.map((c, j) =>
                    j === i ? { ...c, email: e.target.value } : c,
                  ),
                )
              }
            />
            <Button
              variant="ghost"
              onClick={() => setContacts(contacts.filter((_, j) => j !== i))}
            >
              Ta bort
            </Button>
          </div>
        ))}
        <Button
          onClick={() => setContacts([...contacts, { name: "", email: "" }])}
        >
          Lägg till kontaktperson
        </Button>
      </div>
    </>
  );
}
function readReseller(
  form: FormData,
  contacts: { name: string; email: string }[],
  prefix = "",
): ResellerInput {
  const v = (key: string) => String(form.get(prefix + key) ?? "");
  return {
    name: v("name"),
    address: v("address"),
    postal_code: v("postal_code"),
    city: v("city"),
    invoice_email: v("invoice_email"),
    phone: v("phone"),
    org_number: v("org_number"),
    invoice_reference: v("invoice_reference"),
    contacts,
  };
}
export function ResellerEditor({
  reseller,
  onSaved,
}: {
  reseller?: Reseller;
  onSaved?: () => void;
}) {
  const [contacts, setContacts] = useState(reseller?.contacts ?? []);
  const save = useSave();
  return (
    <ClientForm
      action={(fd) =>
        save.run(
          () => saveReseller(reseller?.id ?? null, readReseller(fd, contacts)),
          onSaved,
        )
      }
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      <ResellerFields
        reseller={reseller}
        contacts={contacts}
        setContacts={setContacts}
      />
      <SaveFooter {...save} />
    </ClientForm>
  );
}
export function NewResellerButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Ny återförsäljare</Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Ny återförsäljare"
        description="Alla fält är frivilliga."
      >
        <ResellerEditor onSaved={() => setOpen(false)} />
      </Sheet>
    </>
  );
}
export function DeliveryEditor({
  delivery,
  resellers,
  products,
  customerId,
  onSaved,
}: {
  delivery?: ResellerHistory;
  resellers: Reseller[];
  products: Product[];
  customerId?: string;
  onSaved?: () => void;
}) {
  const [selected, setSelected] = useState(
    customerId ?? delivery?.customer_id ?? "",
  );
  const customer = resellers.find((c) => c.id === selected);
  const [contacts, setContacts] = useState<{ name: string; email: string }[]>(
    [],
  );
  const [delivered, setDelivered] = useState(delivery?.delivered_on ?? "");
  const [manual, setManual] = useState(delivery?.follow_up_manual ?? false);
  const [follow, setFollow] = useState(delivery?.follow_up_on ?? "");
  const [quantities, setQuantities] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      delivery?.lines.map((l) => [l.product_id, String(l.quantity)]) ?? [],
    ),
  );
  const [showOld, setShowOld] = useState(
    Boolean(
      delivery?.lines.some(
        (l) =>
          products.find((p) => p.id === l.product_id)?.edition === "gammal",
      ),
    ),
  );
  const save = useSave();
  const legacy = Boolean(delivery && !delivery.order_id);
  const lines = products.map((p) => ({
    productId: p.id,
    quantity: Number(quantities[p.id] || 0),
  }));
  const order = delivery?.order;
  const samePrices = new Set(
    delivery?.lines.map((l) => l.unit_price).filter((p) => p !== null),
  );
  return (
    <ClientForm
      action={(fd) => {
        const price = String(fd.get("unit_price") ?? "").trim();
        save.run(
          () =>
            saveDelivery({
              id: delivery?.id,
              customerId: selected || null,
              newReseller: !selected
                ? readReseller(fd, contacts, "new_")
                : undefined,
              deliveredOn: delivered,
              followUpOn: follow,
              followUpManual: manual,
              note: String(fd.get("note") ?? ""),
              shipName: String(fd.get("ship_name") ?? ""),
              shipAddress: String(fd.get("ship_address") ?? ""),
              shipPostalCode: String(fd.get("ship_postal_code") ?? ""),
              shipCity: String(fd.get("ship_city") ?? ""),
              unitPrice: price ? Number(price.replace(",", ".")) : null,
              lines,
              legacyQuantity: legacy
                ? Number(fd.get("legacy_quantity") ?? 0)
                : undefined,
            }),
          onSaved,
        );
      }}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      {!delivery && !customerId ? (
        <Field label="Återförsäljare" className="col-span-full">
          <Select
            aria-label="Välj återförsäljare"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Skapa ny återförsäljare</option>
            {resellers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || "Namnlös återförsäljare"}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      {!selected ? (
        <ResellerFields
          prefix="new_"
          contacts={contacts}
          setContacts={setContacts}
        />
      ) : null}
      {legacy ? (
        <>
          <p className="col-span-full text-muted">
            Äldre fristående leverans. Ursprungligt antal och anteckning är
            bevarade. Koppla till en befintlig order nedan för produkter, adress
            och faktura.
          </p>
          <Field label="Ursprungligt antal">
            <Input
              aria-label="Ursprungligt antal"
              type="number"
              min="0"
              step="1"
              name="legacy_quantity"
              defaultValue={delivery?.quantity}
            />
          </Field>
        </>
      ) : (
        <>
          <div className="col-span-full grid gap-3 sm:grid-cols-3">
            {products
              .filter((p) => p.edition !== "gammal" || showOld)
              .map((p) => (
                <Field
                  key={p.id}
                  label={`${p.name}${p.edition === "gammal" ? " (gammal ask)" : ""}`}
                >
                  <Input
                    aria-label={`Antal ${p.name} ${p.edition}`}
                    type="number"
                    min="0"
                    max="1000000"
                    step="1"
                    value={quantities[p.id] ?? ""}
                    onChange={(e) =>
                      setQuantities({ ...quantities, [p.id]: e.target.value })
                    }
                  />
                </Field>
              ))}
          </div>
          {products.some((p) => p.edition === "gammal") ? (
            <Button variant="ghost" onClick={() => setShowOld(!showOld)}>
              {showOld ? "Dölj äldre askar" : "Visa äldre askar"}
            </Button>
          ) : null}
          <Field
            label="Gemensamt styckpris, kr exkl. moms"
            hint={
              samePrices.size > 1
                ? "Tidigare order har olika priser. Vid sparande används det gemensamma priset för alla produkter."
                : undefined
            }
          >
            <Input
              aria-label="Styckpris exklusive moms"
              inputMode="decimal"
              name="unit_price"
              defaultValue={
                delivery?.lines.find((l) => l.unit_price !== null)
                  ?.unit_price ?? ""
              }
            />
          </Field>
          <p className="self-end py-2 text-muted" aria-live="polite">
            {lines.reduce((s, l) => s + l.quantity, 0)} kortlekar ·{" "}
            {shipmentWeight(lines) / 1000} kg
          </p>
          <div
            key={selected}
            className="col-span-full grid gap-3 sm:grid-cols-2"
          >
            {[
              ["ship_name", "Mottagare", order?.ship_name ?? customer?.name],
              [
                "ship_address",
                "Leveransadress",
                order?.ship_address ?? customer?.address,
              ],
              [
                "ship_postal_code",
                "Postnummer",
                order?.ship_postal_code ?? customer?.postal_code,
              ],
              ["ship_city", "Ort", order?.ship_city ?? customer?.city],
            ].map(([key, label, value]) => (
              <Field key={key} label={label ?? ""}>
                <Input
                  aria-label={label ?? ""}
                  name={key ?? undefined}
                  defaultValue={value ?? ""}
                />
              </Field>
            ))}
          </div>
        </>
      )}
      <Field label="Leveransdatum (kan vara uppskattat)">
        <Input
          aria-label="Leveransdatum"
          type="date"
          value={delivered}
          onChange={(e) => {
            const v = e.target.value;
            setDelivered(v);
            if (!manual) setFollow(v ? addDaysISO(v, 30) : "");
          }}
        />
      </Field>
      <Field label="Följ upp">
        <Input
          aria-label="Uppföljningsdatum"
          type="date"
          value={follow}
          onChange={(e) => {
            setFollow(e.target.value);
            setManual(true);
          }}
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setManual(false);
            setFollow(delivered ? addDaysISO(delivered, 30) : "");
          }}
        >
          Återställ till leveransdatum + 30 dagar
        </Button>
      </Field>
      <Field
        label="Anteckning om leveransen / överenskommelse"
        className="col-span-full"
      >
        <Textarea
          aria-label="Leveransanteckning"
          name="note"
          defaultValue={delivery?.note ?? ""}
        />
      </Field>
      <SaveFooter
        {...save}
        label={delivery ? "Spara leverans" : "Skapa leverans"}
      />
    </ClientForm>
  );
}
export function NewDeliveryButton({
  resellers,
  products,
  customerId,
}: {
  resellers: Reseller[];
  products: Product[];
  customerId?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        + Ny leverans
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Ny leverans"
        description="Alla fält är frivilliga. Leveransen visas också under Ordrar."
        width="max-w-[720px]"
      >
        <DeliveryEditor
          resellers={resellers}
          products={products}
          customerId={customerId}
          onSaved={() => setOpen(false)}
        />
      </Sheet>
    </>
  );
}
export function NoteEditor({
  customerId,
  note,
  today,
}: {
  customerId: string;
  note?: ResellerNote;
  today: string;
}) {
  const save = useSave();
  const [version, setVersion] = useState(0);
  return (
    <ClientForm
      key={version}
      action={(fd) =>
        save.run(
          () => saveResellerNote(customerId, note?.id ?? null, fd),
          () => {
            if (!note) setVersion((v) => v + 1);
          },
        )
      }
      className="flex flex-col gap-2"
    >
      <Input
        aria-label="Anteckningsdatum"
        className="max-w-44"
        type="date"
        name="noted_on"
        defaultValue={note ? (note.noted_on ?? "") : today}
      />
      <Textarea
        aria-label={note ? "Redigera anteckning" : "Ny anteckning"}
        name="body"
        defaultValue={note?.body ?? ""}
        placeholder="Skriv en anteckning…"
      />
      <SaveFooter
        {...save}
        label={note ? "Spara anteckning" : "Lägg till anteckning"}
      />
    </ClientForm>
  );
}
