import type { ButtonHTMLAttributes } from "react";
export function Button({
  className = "",
  variant = "default",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "ghost";
}) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variant === "primary" ? "border-brand-accent bg-brand-accent font-medium text-white hover:bg-brand-accent/90" : variant === "ghost" ? "border-transparent hover:bg-brand-offwhite" : "border-brand-line bg-white hover:bg-brand-stone"} ${className}`}
    />
  );
}
