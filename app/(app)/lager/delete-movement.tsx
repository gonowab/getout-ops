"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { deleteMovement } from "@/lib/actions/inventory";

export function DeleteMovementButton({ id }: { id: number }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  return (
    <>
      <button
        type="button"
        aria-label="Ta bort rörelse"
        onClick={() => setOpen(true)}
        className="rounded p-1 text-subtle opacity-0 hover:bg-hover hover:text-danger focus:opacity-100 group-hover:opacity-100"
      >
        <Trash2 className="size-3.5" />
      </button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Ta bort lagerrörelsen?"
        description="Saldot räknas om direkt. Använd det bara för felregistreringar."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await deleteMovement(id);
                  setOpen(false);
                  if (!res.ok) toast({ kind: "error", text: res.error });
                  else {
                    toast({ kind: "ok", text: "Rörelsen togs bort" });
                    router.refresh();
                  }
                })
              }
            >
              Ta bort
            </Button>
          </>
        }
      />
    </>
  );
}
