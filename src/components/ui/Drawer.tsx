"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-brand-ink/20 backdrop-blur-[1px]" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-brand-line bg-brand-stone shadow-2xl">
          <div className="border-b border-brand-line px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <Dialog.Title className="text-xl font-medium">
                {title}
              </Dialog.Title>
              <Dialog.Close
                aria-label="Close panel"
                className="rounded p-1 hover:bg-brand-offwhite"
              >
                <X size={20} />
              </Dialog.Close>
            </div>
            <Dialog.Description className="mt-2 text-xs text-brand-muted">
              {description}
            </Dialog.Description>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
