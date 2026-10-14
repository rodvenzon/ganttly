import type { ReactNode } from "react";
export const inputClass =
  "w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-gold/25 disabled:opacity-50";
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2 text-xs font-medium text-brand-muted">
      {label}
      {children}
    </label>
  );
}
