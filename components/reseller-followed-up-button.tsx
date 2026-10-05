"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Undo2 } from "lucide-react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/toast";
import { setResellerFollowedUp } from "@/lib/actions/resellers";

export function FollowedUpButton({ id, name, done }: { id: string; name: string; done: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  return (
    <Button
      size="sm"
      variant={done ? "ghost" : "secondary"}
      disabled={pending}
      className="relative z-10"
      onClick={() =>
        start(async () => {
          const res = await setResellerFollowedUp(id, !done);
          if (!res.ok) return toast({ kind: "error", text: res.error });
          toast({ kind: "ok", text: done ? `${name} är åter att följa upp` : `${name} markerades som uppföljd` });
          router.refresh();
        })
      }
    >
      {done ? (
        <>
          <Undo2 className="size-3.5" /> Ångra
        </>
      ) : (
        <>
          <Check className="size-3.5" /> Uppföljd
        </>
      )}
    </Button>
  );
}
