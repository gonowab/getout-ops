"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Modal } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { deleteCustomer } from "@/lib/actions/customers";

export function DeleteCustomerButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Ta bort kund
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={`Ta bort ${name}?`}
        description="Kunden tas bort permanent. Det går bara för kunder utan ordrar."
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
                  const res = await deleteCustomer(id);
                  setOpen(false);
                  if (!res.ok) return toast({ kind: "error", text: res.error });
                  toast({ kind: "ok", text: `${name} togs bort` });
                  router.push("/kunder");
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
