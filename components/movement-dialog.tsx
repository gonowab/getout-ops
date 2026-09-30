"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, EditionTag, Field, Input, cn } from "@/components/ui";
import { Modal } from "@/components/sheet";
import { Segmented } from "@/components/order-form";
import { useToast } from "@/components/toast";
import { registerMovements } from "@/lib/actions/inventory";
import { num, todayISO } from "@/lib/format";
import type { Product } from "@/lib/types";

type Kind = "inleverans" | "justering" | "retur";

const COPY: Record<Kind, { hint: string; placeholder: string }> = {
  inleverans: { hint: "Nya kortlekar in i lagret, t.ex. en produktion.", placeholder: "t.ex. Produktion K-Print" },
  justering: {
    hint: "Rätta saldot efter inventering. Minus för att ta bort, t.ex. −4.",
    placeholder: "t.ex. Inventering, skadade askar",
  },
  retur: { hint: "Kortlekar som kommit tillbaka och kan säljas igen.", placeholder: "t.ex. Retur från Bokhandeln Ystad" },
};

export function MovementButton({ products }: { products: Product[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("inleverans");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [qty, setQty] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const regions: string[] = [];
  for (const p of products) if (!regions.includes(p.region)) regions.push(p.region);

  const parse = (v: string | undefined) => {
    const n = parseInt((v ?? "").replace("−", "-"), 10);
    return isNaN(n) ? 0 : n;
  };
  const total = products.reduce((s, p) => s + parse(qty[p.id]), 0);

  function reset() {
    setKind("inleverans");
    setDate(todayISO());
    setNote("");
    setQty({});
    setError(null);
  }

  function submit() {
    setError(null);
    start(async () => {
      const res = await registerMovements({
        type: kind,
        date,
        note,
        rows: products.map((p) => ({ productId: p.id, quantity: parse(qty[p.id]) })),
      });
      if (!res.ok) return setError(res.error);
      setOpen(false);
      reset();
      toast({ kind: "ok", text: res.message ?? "Registrerat" });
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Registrera
      </Button>
      <Modal
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
        title="Registrera lagerrörelse"
        description={COPY[kind].hint}
        width="max-w-[520px]"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
            <Button variant="primary" onClick={submit} disabled={pending}>
              {pending ? "Sparar…" : `Registrera ${total > 0 ? "+" : ""}${num(total)} st`}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Segmented
            value={kind}
            onChange={(v) => setKind(v as Kind)}
            options={[
              { value: "inleverans", label: "Inleverans" },
              { value: "justering", label: "Justering" },
              { value: "retur", label: "Retur" },
            ]}
          />
          <div className="overflow-hidden rounded-lg border border-line">
            <div className="grid grid-cols-3 border-b border-line bg-canvas text-[12px] text-muted">
              <div className="px-3 py-2" />
              <div className="px-3 py-2">
                <EditionTag edition="gammal" />
              </div>
              <div className="px-3 py-2">Ny ask</div>
            </div>
            {regions.map((r, i) => (
              <div key={r} className={cn("grid grid-cols-3 items-center", i > 0 && "border-t border-line")}>
                <div className="px-3 py-2 font-medium">{r}</div>
                {(["gammal", "ny"] as const).map((ed) => {
                  const p = products.find((x) => x.region === r && x.edition === ed);
                  if (!p) return <div key={ed} />;
                  return (
                    <div key={ed} className="px-2 py-1.5">
                      <Input
                        aria-label={`${r}, ${ed === "gammal" ? "gammal ask" : "ny ask"}`}
                        inputMode={kind === "justering" ? "text" : "numeric"}
                        placeholder="0"
                        value={qty[p.id] ?? ""}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) =>
                          setQty((prev) => ({
                            ...prev,
                            [p.id]:
                              kind === "justering"
                                ? e.target.value.replace(/[^\d\-−]/g, "")
                                : e.target.value.replace(/[^\d]/g, ""),
                          }))
                        }
                        className="tabular"
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[1fr_150px] gap-3">
            <Field label={kind === "justering" ? "Anledning" : "Notering"}>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={COPY[kind].placeholder} />
            </Field>
            <Field label="Datum">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          {error ? (
            <p role="alert" className="text-[13px] text-danger">
              {error}
            </p>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
