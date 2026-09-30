"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { OrderForm, type EditPayload } from "@/components/order-form";
import type { Customer, Product, StockLevel } from "@/lib/types";

type Ctx = {
  openNew: (opts?: { customerId?: string }) => void;
  openEdit: (payload: EditPayload) => void;
};

const OrderPanelContext = createContext<Ctx>({ openNew: () => {}, openEdit: () => {} });
export const useOrderPanel = () => useContext(OrderPanelContext);

export function OrderPanelProvider({
  children,
  products,
  stock,
  customers,
}: {
  children: ReactNode;
  products: Product[];
  stock: StockLevel[];
  customers: Customer[];
}) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<EditPayload | null>(null);
  const [presetCustomerId, setPresetCustomerId] = useState<string | null>(null);
  const [openCount, setOpenCount] = useState(0);

  const openNew = useCallback((opts?: { customerId?: string }) => {
    setEdit(null);
    setPresetCustomerId(opts?.customerId ?? null);
    setOpenCount((n) => n + 1);
    setOpen(true);
  }, []);

  const openEdit = useCallback((payload: EditPayload) => {
    setEdit(payload);
    setPresetCustomerId(null);
    setOpenCount((n) => n + 1);
    setOpen(true);
  }, []);

  // Kortkommando N = ny order (när man inte skriver i ett fält)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "n" && e.key !== "N") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      e.preventDefault();
      openNew();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openNew]);

  return (
    <OrderPanelContext.Provider value={{ openNew, openEdit }}>
      {children}
      <OrderForm
        key={openCount}
        open={open}
        onOpenChange={setOpen}
        products={products}
        stock={stock}
        customers={customers}
        edit={edit}
        presetCustomerId={presetCustomerId}
      />
    </OrderPanelContext.Provider>
  );
}
