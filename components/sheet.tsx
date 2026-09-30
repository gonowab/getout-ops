"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/components/ui";

/** Panel som glider in från höger – används för Ny order och redigering */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = "max-w-[640px]",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 animate-fade-in bg-black/20" />
        <Dialog.Content
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full animate-panel-in flex-col border-l border-line bg-surface shadow-2xl focus:outline-none sm:inset-y-2 sm:right-2 sm:rounded-xl sm:border",
            width,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <Dialog.Title className="text-[16px] font-semibold text-ink">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-[13px] text-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">Formulär</Dialog.Description>
              )}
            </div>
            <Dialog.Close className="rounded-md p-1 text-muted hover:bg-hover hover:text-ink" aria-label="Stäng">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer ? <div className="border-t border-line px-5 py-3">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Centrerad dialog för mindre formulär och bekräftelser */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = "max-w-[460px]",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 animate-fade-in bg-black/20" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-[12vh] z-50 w-[calc(100%-32px)] -translate-x-1/2 animate-fade-in rounded-xl border border-line bg-surface shadow-2xl focus:outline-none",
            width,
          )}
        >
          <div className="px-5 pt-5">
            <Dialog.Title className="text-[16px] font-semibold text-ink">{title}</Dialog.Title>
            {description ? (
              <Dialog.Description className="mt-1 text-[13px] text-muted">{description}</Dialog.Description>
            ) : (
              <Dialog.Description className="sr-only">Dialog</Dialog.Description>
            )}
          </div>
          {children ? <div className="px-5 pt-4">{children}</div> : null}
          <div className="flex justify-end gap-2 px-5 pb-5 pt-5">{footer}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
