import type { Assignee } from "@/lib/types";
import { avatarClasses } from "@/lib/colors";
export function Assignees({ people }: { people: Assignee[] }) {
  return (
    <span className="flex -space-x-1">
      {people.slice(0, 3).map((p) => (
        <span
          key={p.id}
          title={p.title ? `${p.name} · ${p.title}` : p.name}
          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-white text-[9px] font-semibold text-brand-ink ${avatarClasses[p.avatarColor]}`}
        >
          {p.name
            .split(" ")
            .map((n) => n[0])
            .join("")}
        </span>
      ))}
      {people.length > 3 && (
        <span className="text-xs">+{people.length - 3}</span>
      )}
    </span>
  );
}
