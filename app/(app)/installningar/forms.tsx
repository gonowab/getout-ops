"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, EditionTag, Field, Input } from "@/components/ui";
import { useToast } from "@/components/toast";
import { changePassword } from "@/lib/actions/auth";
import { updateThreshold } from "@/lib/actions/inventory";
import { setShopifyEdition } from "@/lib/actions/shopify";
import { Segmented } from "@/components/order-form";
import type { Product } from "@/lib/types";

export function ThresholdForm({ products }: { products: Product[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState<Record<number, string>>(
    Object.fromEntries(products.map((p) => [p.id, String(p.low_stock_threshold)])),
  );
  const [pending, start] = useTransition();
  const dirty = products.some((p) => String(p.low_stock_threshold) !== values[p.id]);

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-xl border border-line">
        {products.map((p, i) => (
          <div key={p.id} className={`flex items-center justify-between gap-4 px-4 py-2 ${i > 0 ? "border-t border-line" : ""}`}>
            <span className="flex items-center gap-2 text-[13px]">
              {p.region} <EditionTag edition={p.edition} />
            </span>
            <Input
              aria-label={`Gräns för ${p.region} ${p.edition}`}
              inputMode="numeric"
              className="w-24 text-right tabular"
              value={values[p.id]}
              onChange={(e) => setValues((v) => ({ ...v, [p.id]: e.target.value.replace(/\D/g, "") }))}
            />
          </div>
        ))}
      </div>
      <div>
        <Button
          variant="primary"
          disabled={!dirty || pending}
          onClick={() =>
            start(async () => {
              for (const p of products) {
                if (String(p.low_stock_threshold) === values[p.id]) continue;
                const res = await updateThreshold(p.id, parseInt(values[p.id] || "0", 10));
                if (!res.ok) return toast({ kind: "error", text: res.error });
              }
              toast({ kind: "ok", text: "Gränserna sparades" });
              router.refresh();
            })
          }
        >
          Spara gränser
        </Button>
      </div>
    </div>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field label="Nytt lösenord" hint="Minst 10 tecken">
        <Input name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Upprepa lösenordet">
        <Input name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      {state ? (
        <p role="status" className={`text-[13px] ${state.ok ? "text-brand-strong" : "text-danger"}`}>
          {state.ok ? state.message : state.error}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Sparar…" : "Byt lösenord"}
        </Button>
      </div>
    </form>
  );
}

export function ShopifyEditionForm({ mapping }: { mapping: { region: string; edition: "gammal" | "ny" | null }[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      {mapping.map((m, i) => (
        <div
          key={m.region}
          className={`flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 ${i > 0 ? "border-t border-line" : ""}`}
        >
          <span className="text-[13px] font-medium">{m.region}</span>
          {m.edition ? (
            <Segmented
              value={m.edition}
              onChange={(v) =>
                start(async () => {
                  if (pending) return;
                  const res = await setShopifyEdition(m.region, v as "gammal" | "ny");
                  if (!res.ok) return toast({ kind: "error", text: res.error });
                  toast({ kind: "ok", text: res.message ?? "Sparat" });
                  router.refresh();
                })
              }
              options={[
                { value: "gammal", label: "Gammal ask" },
                { value: "ny", label: "Ny ask" },
              ]}
            />
          ) : (
            <span className="text-[12px] text-warn">Inte kopplad</span>
          )}
        </div>
      ))}
    </div>
  );
}
