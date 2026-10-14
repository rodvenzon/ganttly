"use client";
import { useEffect } from "react";
import { X } from "lucide-react";
import { useUI } from "@/store/ui";
export function Toast() {
  const message = useUI((s) => s.toast),
    notify = useUI((s) => s.notify);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => notify(""), 7000);
    return () => clearTimeout(timer);
  }, [message, notify]);
  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-[80] flex max-w-[90vw] -translate-x-1/2 items-center gap-4 rounded-lg bg-brand-ink px-5 py-3 text-sm text-white shadow-xl"
    >
      <span>{message}</span>
      <button aria-label="Dismiss notification" onClick={() => notify("")}>
        <X size={16} />
      </button>
    </div>
  );
}
