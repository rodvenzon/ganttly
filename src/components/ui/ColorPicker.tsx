import { Check } from "lucide-react";
import { COLOR_KEYS, type ColorKey } from "@/lib/types";
import { avatarClasses, colorLabels } from "@/lib/colors";
/**
 * A row of colour swatches. With `allowNone`, the first swatch means
 * "no colour of its own" (a task then uses its project's colour).
 */
export function ColorPicker({
  value,
  onChange,
  allowNone,
  noneLabel = "Project colour",
  disabled,
}: {
  value: ColorKey | null;
  onChange: (c: ColorKey | null) => void;
  allowNone?: boolean;
  noneLabel?: string;
  disabled?: boolean;
}) {
  const options: (ColorKey | null)[] = [
    ...(allowNone ? [null] : []),
    ...COLOR_KEYS,
  ];
  return (
    <div role="radiogroup" className="flex flex-wrap gap-2">
      {options.map((c) => {
        const selected = c === value,
          label = c ? colorLabels[c] : noneLabel;
        return (
          <button
            key={c ?? "none"}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={() => onChange(c)}
            className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border transition disabled:opacity-50 ${c ? avatarClasses[c] : "bg-white"} ${selected ? "border-brand-ink ring-2 ring-brand-gold ring-offset-1" : "border-brand-line hover:border-brand-muted"}`}
          >
            {selected ? (
              <Check size={12} className="text-brand-ink" />
            ) : !c ? (
              <span className="h-px w-3.5 rotate-45 bg-brand-muted" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
