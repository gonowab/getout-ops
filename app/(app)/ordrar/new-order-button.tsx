"use client";

import { Plus } from "lucide-react";
import { Button, Kbd } from "@/components/ui";
import { useOrderPanel } from "@/components/order-panel";

export function NewOrderButton() {
  const { openNew } = useOrderPanel();
  return (
    <Button variant="primary" onClick={() => openNew()}>
      <Plus className="size-4" /> Ny order <Kbd>N</Kbd>
    </Button>
  );
}
