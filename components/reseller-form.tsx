"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Button, Field, Input, Textarea } from "@/components/ui";
import { Modal, Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { deleteResellerDelivery, saveResellerDelivery } from "@/lib/actions/resellers";
import { addMonthsISO } from "@/lib/format";
import type { ResellerDelivery } from "@/lib/types";

export function ResellerFormButton({
  delivery,
  suggestions,
  today,
}: {
  delivery?: ResellerDelivery;
  suggestions: string[];
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const uid = useId();
  const formId = `reseller-${uid}`;
  const listId = `reseller-names-${uid}`;

  const initialDelivered = delivery?.delivered_on ?? today;
  const [delivered, setDelivered] = useState(initialDelivered);
  const [followUp, setFollowUp] = useState(delivery?.follow_up_on ?? addMonthsISO(initialDelivered, 1));
  // Uppföljningsdatumet följer leveransdatumet (+1 månad) tills man ändrar det för hand
  const [followUpTouched, setFollowUpTouched] = useState(Boolean(delivery));

  function reset(next: boolean) {
    setOpen(next);
    if (next) {
      setError(null);
      setDelivered(initialDelivered);
      setFollowUp(delivery?.follow_up_on ?? addMonthsISO(initialDelivered, 1));
      setFollowUpTouched(Boolean(delivery));
    }
  }

  function onSubmit(formData: FormData) {
    setError(null);
    start(async () => {
      const res = await saveResellerDelivery(delivery?.id ?? null, formData);
      if (!res.ok) return setError(res.error);
      setOpen(false);
      toast({ kind: "ok", text: res.message ?? "Sparat" });
      router.refresh();
    });
  }

  function onDelete() {
    if (!delivery) return;
    start(async () => {
      const res = await deleteResellerDelivery(delivery.id);
      setConfirmDelete(false);
      if (!res.ok) return toast({ kind: "error", text: res.error });
      toast({ kind: "ok", text: `${delivery.name} togs bort` });
      router.refresh();
    });
  }

  return (
    <>
      {delivery ? (
        <button
          type="button"
          aria-label={`Redigera ${delivery.name}`}
          onClick={() => reset(true)}
          className="relative z-10 rounded-md p-1.5 text-muted hover:bg-hover hover:text-ink"
        >
          <Pencil className="size-3.5" />
        </button>
      ) : (
        <Button variant="primary" onClick={() => reset(true)}>
          <Plus className="size-4" /> Ny leverans
        </Button>
      )}

      <Sheet
        open={open}
        onOpenChange={reset}
        title={delivery ? `Redigera ${delivery.name}` : "Ny leverans till återförsäljare"}
        description={delivery ? undefined : "Uppföljningen sätts automatiskt till en månad efter leveransen."}
        width="max-w-[480px]"
        footer={
          <div className="flex items-center justify-between gap-2">
            {delivery ? (
              <Button
                variant="ghost"
                className="text-danger hover:text-danger"
                onClick={() => {
                  setOpen(false);
                  setConfirmDelete(true);
                }}
              >
                Ta bort
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Avbryt
              </Button>
              <Button variant="primary" type="submit" form={formId} disabled={pending}>
                {pending ? "Sparar…" : "Spara"}
              </Button>
            </div>
          </div>
        }
      >
        <form id={formId} action={onSubmit} className="flex flex-col gap-4">
          {error ? (
            <div role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">
              {error}
            </div>
          ) : null}

          <Field label="Återförsäljare" htmlFor={`${formId}-name`}>
            <Input
              id={`${formId}-name`}
              name="name"
              list={listId}
              defaultValue={delivery?.name}
              placeholder="T.ex. Naturbutiken i Lund"
              autoComplete="off"
              required
              autoFocus
            />
            <datalist id={listId}>
              {suggestions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </Field>

          <Field label="Antal kortlekar" htmlFor={`${formId}-qty`}>
            <Input
              id={`${formId}-qty`}
              name="quantity"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              defaultValue={delivery?.quantity}
              required
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Fick kortlekarna" htmlFor={`${formId}-delivered`}>
              <Input
                id={`${formId}-delivered`}
                name="delivered_on"
                type="date"
                value={delivered}
                onChange={(e) => {
                  const v = e.target.value;
                  setDelivered(v);
                  if (!followUpTouched && v) setFollowUp(addMonthsISO(v, 1));
                }}
                required
              />
            </Field>
            <Field label="Följ upp" htmlFor={`${formId}-followup`}>
              <Input
                id={`${formId}-followup`}
                name="follow_up_on"
                type="date"
                value={followUp}
                onChange={(e) => {
                  setFollowUp(e.target.value);
                  setFollowUpTouched(true);
                }}
                required
              />
            </Field>
          </div>

          <Field label="Anteckning" htmlFor={`${formId}-note`}>
            <Textarea
              id={`${formId}-note`}
              name="note"
              defaultValue={delivery?.note ?? ""}
              placeholder="Vem vi pratade med, vad vi kom överens om, hur det har sålt…"
              rows={5}
            />
          </Field>
        </form>
      </Sheet>

      {delivery ? (
        <Modal
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={`Ta bort ${delivery.name}?`}
          description="Leveransen och anteckningen tas bort permanent."
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Avbryt
              </Button>
              <Button variant="danger" disabled={pending} onClick={onDelete}>
                Ta bort
              </Button>
            </>
          }
        />
      ) : null}
    </>
  );
}
