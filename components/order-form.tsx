"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Search, X } from "lucide-react";
import { Button, Field, Input, Kbd, Textarea, cn, EditionTag } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { saveOrder } from "@/lib/actions/orders";
import { customerTypeLabel, orderRef, SHIPPED_STATUSES } from "@/lib/labels";
import { num, todayISO } from "@/lib/format";
import type { Customer, CustomerType, OrderLine, OrderRow, OrderSource, Product, StockLevel } from "@/lib/types";

export type EditPayload = { order: OrderRow; lines: OrderLine[] };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  stock: StockLevel[];
  customers: Customer[];
  edit: EditPayload | null;
  presetCustomerId?: string | null;
};

const SOURCES: { value: OrderSource; label: string }[] = [
  { value: "foretag", label: "Företag" },
  { value: "aterforsaljare", label: "Återförsäljare" },
  { value: "shopify", label: "Shopify" },
  { value: "annat", label: "Annat" },
];

const sourceForCustomer = (t: CustomerType): OrderSource =>
  t === "foretag" ? "foretag" : t === "aterforsaljare" ? "aterforsaljare" : "annat";

const RESERVED = ["bekraftad", "ska_packas"];

const EMPTY_FIELDS = {
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  shipName: "",
  shipAddress: "",
  shipPostalCode: "",
  shipCity: "",
  invoiceEmail: "",
  invoiceReference: "",
  trackingNumber: "",
  comment: "",
  orderDate: "",
};

function fieldsFromCustomer(c: Customer) {
  return {
    contactName: c.contact_name ?? "",
    contactEmail: c.email ?? "",
    contactPhone: c.phone ?? "",
    shipName: c.name,
    shipAddress: c.address ?? "",
    shipPostalCode: c.postal_code ?? "",
    shipCity: c.city ?? "",
    invoiceEmail: c.invoice_email ?? "",
    invoiceReference: c.invoice_reference ?? "",
  };
}

function initialState(edit: EditPayload | null, preset: Customer | null) {
  if (edit) {
    const o = edit.order;
    return {
      customerId: o.customer_id,
      source: o.source,
      qty: Object.fromEntries(edit.lines.map((l) => [l.product_id, String(l.quantity)])) as Record<number, string>,
      unitPrice: edit.lines[0]?.unit_price ? String(Number(edit.lines[0].unit_price)) : "",
      fields: {
        contactName: o.contact_name ?? "",
        contactEmail: o.contact_email ?? "",
        contactPhone: o.contact_phone ?? "",
        shipName: o.ship_name ?? "",
        shipAddress: o.ship_address ?? "",
        shipPostalCode: o.ship_postal_code ?? "",
        shipCity: o.ship_city ?? "",
        invoiceEmail: o.invoice_email ?? "",
        invoiceReference: o.invoice_reference ?? "",
        trackingNumber: o.tracking_number ?? "",
        comment: o.comment ?? "",
        orderDate: o.order_date,
      },
    };
  }
  return {
    customerId: preset?.id ?? null,
    source: preset ? sourceForCustomer(preset.type) : ("foretag" as OrderSource),
    qty: {} as Record<number, string>,
    unitPrice: "",
    fields: { ...EMPTY_FIELDS, ...(preset ? fieldsFromCustomer(preset) : {}), orderDate: todayISO() },
  };
}

export function OrderForm({ open, onOpenChange, products, stock, customers, edit, presetCustomerId }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Formuläret monteras om varje gång panelen öppnas (key i OrderPanelProvider),
  // så startvärdena räknas fram här i stället för i en effekt.
  const [init] = useState(() => initialState(edit, customers.find((c) => c.id === presetCustomerId) ?? null));
  const [customerId, setCustomerId] = useState<string | null>(init.customerId);
  const [newCustomer, setNewCustomer] = useState<{ name: string; type: CustomerType } | null>(null);
  const [source, setSource] = useState<OrderSource>(init.source);
  const [qty, setQty] = useState<Record<number, string>>(init.qty);
  const [unitPrice, setUnitPrice] = useState(init.unitPrice);
  const [f, setF] = useState(init.fields);
  const [confirmNow, setConfirmNow] = useState(false);
  const [saveToCustomer, setSaveToCustomer] = useState(!edit);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  function pickCustomer(c: Customer) {
    setCustomerId(c.id);
    setNewCustomer(null);
    setSource(sourceForCustomer(c.type));
    setF((prev) => ({ ...prev, ...fieldsFromCustomer(c) }));
  }

  function startNewCustomer(name: string) {
    setCustomerId(null);
    setNewCustomer({ name, type: "foretag" });
    setSource("foretag");
    setF((prev) => ({ ...EMPTY_FIELDS, comment: prev.comment, orderDate: prev.orderDate, shipName: name }));
  }

  const locked = edit ? SHIPPED_STATUSES.includes(edit.order.status) : false;
  const selectedCustomer = customers.find((c) => c.id === customerId) ?? null;

  const regions = useMemo(() => {
    const order: string[] = [];
    for (const p of products) if (!order.includes(p.region)) order.push(p.region);
    return order.map((r) => ({
      region: r,
      gammal: products.find((p) => p.region === r && p.edition === "gammal"),
      ny: products.find((p) => p.region === r && p.edition === "ny"),
    }));
  }, [products]);

  function available(productId: number) {
    const s = stock.find((x) => x.product_id === productId);
    let a = s?.tillgangligt ?? 0;
    if (edit && RESERVED.includes(edit.order.status)) {
      a += edit.lines.find((l) => l.product_id === productId)?.quantity ?? 0;
    }
    return a;
  }

  const total = products.reduce((s, p) => s + (parseInt(qty[p.id] || "0", 10) || 0), 0);
  const price = parseFloat(unitPrice.replace(",", "."));
  const value = !isNaN(price) && total > 0 ? price * total : null;

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await saveOrder({
        id: edit?.order.id,
        customerId,
        newCustomer,
        source,
        orderDate: f.orderDate,
        contactName: f.contactName,
        contactEmail: f.contactEmail,
        contactPhone: f.contactPhone,
        shipName: f.shipName,
        shipAddress: f.shipAddress,
        shipPostalCode: f.shipPostalCode,
        shipCity: f.shipCity,
        trackingNumber: f.trackingNumber,
        invoiceEmail: f.invoiceEmail,
        invoiceReference: f.invoiceReference,
        comment: f.comment,
        initialStatus: edit ? undefined : confirmNow ? "bekraftad" : "ny",
        saveToCustomer: Boolean(customerId && saveToCustomer),
        lines: products.map((p) => ({
          productId: p.id,
          quantity: parseInt(qty[p.id] || "0", 10) || 0,
          unitPrice: isNaN(price) ? null : price,
        })),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onOpenChange(false);
      const ref = res.orderNumber ? orderRef(res.orderNumber) : "Ordern";
      toast({
        kind: "ok",
        text: edit ? `${ref} sparad` : `${ref} skapad`,
        href: !edit && res.orderNumber ? `/ordrar/${res.orderNumber}` : undefined,
      });
      router.refresh();
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={edit ? `Redigera ${orderRef(edit.order.order_number)}` : "Ny order"}
      description={edit ? edit.order.customer_name ?? undefined : "Kund, kortlekar, klart. Resten går att fylla i senare."}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[13px] text-muted tabular">
            {total > 0 ? (
              <>
                <span className="font-medium text-ink">{num(total)} st</span>
                {value !== null ? <> totalt {num(Math.round(value))} kr ex moms</> : null}
              </>
            ) : (
              "Inga kortlekar valda"
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Avbryt
            </Button>
            <Button variant="primary" onClick={submit} disabled={pending}>
              {pending ? "Sparar…" : edit ? "Spara ändringar" : "Skapa order"}
              <Kbd>⌘↵</Kbd>
            </Button>
          </div>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        className="flex flex-col gap-7"
      >
        {error ? (
          <div role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">
            {error}
          </div>
        ) : null}

        {/* Kund */}
        <section className="flex flex-col gap-3">
          <h3 className="text-[13px] font-semibold text-ink">Kund</h3>
          {selectedCustomer ? (
            <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
              <div>
                <div className="font-medium text-ink">{selectedCustomer.name}</div>
                <div className="text-[12px] text-muted">
                  {customerTypeLabel[selectedCustomer.type]}
                  {selectedCustomer.city ? `, ${selectedCustomer.city}` : ""}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setCustomerId(null)}>
                Byt kund
              </Button>
            </div>
          ) : newCustomer ? (
            <div className="flex flex-col gap-3 rounded-lg border border-brand/40 bg-brand-soft/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-medium text-brand-strong">Ny kund</span>
                <Button size="sm" variant="ghost" onClick={() => setNewCustomer(null)}>
                  <X className="size-3.5" /> Ångra
                </Button>
              </div>
              <Input
                aria-label="Kundens namn"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
              />
              <Segmented
                value={newCustomer.type}
                onChange={(t) => {
                  setNewCustomer({ ...newCustomer, type: t as CustomerType });
                  setSource(sourceForCustomer(t as CustomerType));
                }}
                options={[
                  { value: "foretag", label: "Företag" },
                  { value: "aterforsaljare", label: "Återförsäljare" },
                  { value: "privat", label: "Privatperson" },
                ]}
              />
            </div>
          ) : (
            <CustomerPicker customers={customers} onPick={pickCustomer} onCreate={startNewCustomer} />
          )}

          <Field label="Kanal">
            <Segmented value={source} onChange={(v) => setSource(v as OrderSource)} options={SOURCES} />
          </Field>
        </section>

        {/* Kortlekar */}
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[13px] font-semibold text-ink">Kortlekar</h3>
            {locked ? (
              <span className="text-[12px] text-muted">Skickad – antalet är låst</span>
            ) : (
              <span className="text-[12px] text-muted">Sälj gamla askar först</span>
            )}
          </div>
          <div className="overflow-hidden rounded-lg border border-line">
            <div className="grid grid-cols-[1fr_1fr_1fr] border-b border-line bg-canvas text-[12px] text-muted">
              <div className="px-3 py-2" />
              <div className="px-3 py-2">
                <EditionTag edition="gammal" />
              </div>
              <div className="px-3 py-2">Ny ask</div>
            </div>
            {regions.map((r, i) => (
              <div
                key={r.region}
                className={cn("grid grid-cols-[1fr_1fr_1fr] items-center", i > 0 && "border-t border-line")}
              >
                <div className="px-3 py-2.5 font-medium text-ink">{r.region}</div>
                {[r.gammal, r.ny].map((p, j) =>
                  p ? (
                    <QtyCell
                      key={p.id}
                      value={qty[p.id] ?? ""}
                      onChange={(v) => setQty((prev) => ({ ...prev, [p.id]: v }))}
                      available={available(p.id)}
                      disabled={locked}
                      label={`${r.region}, ${p.edition === "gammal" ? "gammal ask" : "ny ask"}`}
                      autoFocus={false}
                    />
                  ) : (
                    <div key={j} />
                  ),
                )}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pris per kortlek (valfritt)" hint="Kronor ex moms">
              <Input
                inputMode="decimal"
                placeholder="t.ex. 223"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
            </Field>
            <Field label="Orderdatum">
              <Input type="date" value={f.orderDate} onChange={set("orderDate")} />
            </Field>
          </div>
        </section>

        {/* Kontakt */}
        <section className="flex flex-col gap-3">
          <h3 className="text-[13px] font-semibold text-ink">Kontaktperson</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Namn">
              <Input value={f.contactName} onChange={set("contactName")} autoComplete="off" />
            </Field>
            <Field label="E-post">
              <Input type="email" value={f.contactEmail} onChange={set("contactEmail")} autoComplete="off" />
            </Field>
            <Field label="Telefon">
              <Input type="tel" value={f.contactPhone} onChange={set("contactPhone")} autoComplete="off" />
            </Field>
          </div>
        </section>

        {/* Leverans */}
        <section className="flex flex-col gap-3">
          <h3 className="text-[13px] font-semibold text-ink">Leveransadress</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Mottagare">
              <Input value={f.shipName} onChange={set("shipName")} />
            </Field>
            <Field label="Adress">
              <Input value={f.shipAddress} onChange={set("shipAddress")} />
            </Field>
            <Field label="Postnummer">
              <Input value={f.shipPostalCode} onChange={set("shipPostalCode")} />
            </Field>
            <Field label="Ort">
              <Input value={f.shipCity} onChange={set("shipCity")} />
            </Field>
            {edit ? (
              <Field label="Kolli-ID / spårningsnummer" className="sm:col-span-2">
                <Input value={f.trackingNumber} onChange={set("trackingNumber")} />
              </Field>
            ) : null}
          </div>
        </section>

        {/* Faktura */}
        <section className="flex flex-col gap-3">
          <h3 className="text-[13px] font-semibold text-ink">Fakturauppgifter</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Fakturamejl">
              <Input type="email" value={f.invoiceEmail} onChange={set("invoiceEmail")} />
            </Field>
            <Field label="Er referens / kostnadsställe">
              <Input value={f.invoiceReference} onChange={set("invoiceReference")} />
            </Field>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <Field label="Kommentar">
            <Textarea
              value={f.comment}
              onChange={set("comment")}
              placeholder="T.ex. leveransönskemål eller vad ni kom överens om"
            />
          </Field>
        </section>

        <section className="flex flex-col gap-2 border-t border-line pt-5">
          {!edit ? (
            <Checkbox checked={confirmNow} onChange={setConfirmNow}>
              Bekräfta direkt <span className="text-muted">(reserverar lagret)</span>
            </Checkbox>
          ) : null}
          {customerId && !edit ? (
            <Checkbox checked={saveToCustomer} onChange={setSaveToCustomer}>
              Spara nya uppgifter på kunden <span className="text-muted">(fyller bara i det som saknas)</span>
            </Checkbox>
          ) : null}
        </section>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Sheet>
  );
}

function QtyCell({
  value,
  onChange,
  available,
  disabled,
  label,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  available: number;
  disabled?: boolean;
  label: string;
  autoFocus?: boolean;
}) {
  const n = parseInt(value || "0", 10) || 0;
  const over = n > available;
  return (
    <div className="px-2 py-1.5">
      <Input
        aria-label={`Antal ${label}`}
        inputMode="numeric"
        placeholder="0"
        autoFocus={autoFocus}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
        onFocus={(e) => e.target.select()}
        className={cn("tabular h-9 text-[15px]", over && "border-warn focus:border-warn focus:ring-warn/15")}
      />
      <div className={cn("mt-1 px-0.5 text-[11px] tabular", over ? "text-warn" : "text-subtle")}>
        {over ? `Bara ${num(available)} tillgängliga` : `${num(available)} tillgängliga`}
      </div>
    </div>
  );
}

export function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div role="radiogroup" className="inline-flex w-fit flex-wrap gap-1 rounded-lg bg-canvas p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-7 rounded-md px-3 text-[13px] transition-colors",
            value === o.value
              ? "bg-surface font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
              : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink">
      <span
        className={cn(
          "flex size-4 items-center justify-center rounded border transition-colors",
          checked ? "border-brand bg-brand text-white" : "border-line-strong bg-surface",
        )}
      >
        {checked ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

function CustomerPicker({
  customers,
  onPick,
  onCreate,
}: {
  customers: Customer[];
  onPick: (c: Customer) => void;
  onCreate: (name: string) => void;
}) {
  const [q, setQ] = useState("");
  const [openList, setOpenList] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  const term = q.trim().toLowerCase();
  const matches = term
    ? customers
        .filter((c) =>
          [c.name, c.contact_name, c.email, c.city].some((v) => v?.toLowerCase().includes(term)),
        )
        .slice(0, 6)
    : customers.slice(0, 6);
  const options = [...matches.map((c) => ({ kind: "c" as const, c })), ...(term ? [{ kind: "new" as const }] : [])];

  function choose(i: number) {
    const o = options[i];
    if (!o) return;
    if (o.kind === "c") onPick(o.c);
    else onCreate(q.trim());
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-subtle" />
      <Input
        ref={inputRef}
        role="combobox"
        aria-expanded={openList}
        aria-label="Sök kund"
        placeholder="Sök kund eller skriv ett nytt namn"
        className="h-9 pl-8"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpenList(true);
          setActive(0);
        }}
        onFocus={() => setOpenList(true)}
        onBlur={() => setTimeout(() => setOpenList(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, options.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && openList && options.length) {
            e.preventDefault();
            e.stopPropagation();
            choose(active);
          }
        }}
      />
      {openList && options.length > 0 ? (
        <ul
          role="listbox"
          className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg"
        >
          {options.map((o, i) => (
            <li
              key={o.kind === "c" ? o.c.id : "new"}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(i);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-[13px]",
                i === active && "bg-hover",
              )}
            >
              {o.kind === "c" ? (
                <>
                  <span className="truncate font-medium text-ink">{o.c.name}</span>
                  <span className="shrink-0 text-[12px] text-muted">
                    {customerTypeLabel[o.c.type]}
                    {o.c.city ? `, ${o.c.city}` : ""}
                  </span>
                </>
              ) : (
                <span className="flex items-center gap-1.5 text-brand-strong">
                  <Plus className="size-3.5" /> Ny kund: <span className="font-medium">{q.trim()}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
