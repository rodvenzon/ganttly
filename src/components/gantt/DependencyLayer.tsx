import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { ProjectDetail } from "@/lib/types";
import type { Row } from "./model";
import { barGeometry } from "@/lib/scheduling/geometry";
import { ROW_HEIGHT, type Zoom } from "@/lib/scheduling/constants";
import { DependencyArrow, type Anchor } from "./DependencyArrow";
import { useProjectActions } from "@/lib/api/use-project-actions";
import { useUI } from "@/store/ui";
export function DependencyLayer({
  project,
  rows,
  origin,
  zoom,
  width,
  height,
  start,
  end,
}: {
  project: ProjectDetail;
  rows: Row[];
  origin: string;
  zoom: Zoom;
  width: number;
  height: number;
  start: number;
  end: number;
}) {
  const root = useRef<HTMLDivElement>(null),
    { commit, busy } = useProjectActions(),
    notify = useUI((s) => s.notify);
  const [draft, setDraft] = useState<{ id: string; point: Anchor } | null>(
    null,
  );
  const geometry = useMemo(
    () =>
      new Map(
        rows.flatMap((row, i) => {
          if (row.type !== "task") return [];
          const g = barGeometry(row.task, i, origin, zoom);
          return g ? [[row.id, g] as const] : [];
        }),
      ),
    [rows, origin, zoom],
  );
  useEffect(() => {
    if (!draft) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDraft(null);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [draft]);
  function point(event: PointerEvent) {
    const rect = root.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  function begin(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (busy || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraft({ id, point: point(event) });
  }
  function finish(event: PointerEvent<HTMLButtonElement>) {
    if (!draft) return;
    const p = point(event);
    const row = rows[Math.floor(p.y / ROW_HEIGHT)],
      g = row && geometry.get(row.id);
    if (row?.type === "task" && g && p.x >= g.startX - 15 && p.x <= g.endX + 15)
      void commit({
        type: "dependency.add",
        id: crypto.randomUUID(),
        predecessorTaskId: draft.id,
        successorTaskId: row.id,
      });
    else notify("Drop the connector onto a scheduled task bar.");
    setDraft(null);
  }
  const source = draft ? geometry.get(draft.id) : null;
  return (
    <div
      ref={root}
      className="pointer-events-none absolute inset-0"
      style={{ width, height }}
    >
      <svg
        className="absolute inset-0 z-[1] overflow-visible"
        width={width}
        height={height}
        aria-hidden="true"
      >
        {project.dependencies.map((d) => {
          const a = geometry.get(d.predecessorTaskId),
            b = geometry.get(d.successorTaskId);
          if (
            !a ||
            !b ||
            Math.max(a.centerY, b.centerY) < start * ROW_HEIGHT ||
            Math.min(a.centerY, b.centerY) > end * ROW_HEIGHT
          )
            return null;
          return (
            <DependencyArrow
              key={d.id}
              from={{ x: a.endX, y: a.centerY }}
              to={{ x: b.startX, y: b.centerY }}
            />
          );
        })}
        {draft && source && (
          <DependencyArrow
            from={{ x: source.endX, y: source.centerY }}
            to={draft.point}
            draft
          />
        )}
      </svg>
      {rows.slice(start, end).map((row) => {
        const g = geometry.get(row.id);
        return (
          row.type === "task" &&
          g && (
            <button
              key={row.id}
              aria-label={`Connect a successor to ${row.task.name}`}
              title="Drag to a successor task"
              disabled={busy}
              onPointerDown={(e) => begin(e, row.id)}
              onPointerMove={(e) => {
                if (draft) setDraft({ ...draft, point: point(e) });
              }}
              onPointerUp={finish}
              onPointerCancel={() => setDraft(null)}
              className="pointer-events-auto absolute z-[12] h-3 w-3 touch-none rounded-full border border-brand-accent bg-white hover:bg-brand-gold disabled:opacity-30"
              style={{ left: g.endX + 6, top: g.centerY - 6 }}
            />
          )
        );
      })}
    </div>
  );
}
