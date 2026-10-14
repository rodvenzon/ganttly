import { useRef, useEffect, type PointerEvent } from "react";
import type { ProjectDetail, Task } from "@/lib/types";
import { ROW_HEIGHT, type Zoom } from "@/lib/scheduling/constants";
import { xToDate } from "@/lib/scheduling/geometry";
import { drawRange, cascade } from "@/lib/scheduling/cascade";
import { useProjectActions } from "@/lib/api/use-project-actions";
import { useUI } from "@/store/ui";
export function UnscheduledRow({
  task,
  project,
  row,
  width,
  origin,
  zoom,
}: {
  task: Task;
  project: ProjectDetail;
  row: number;
  width: number;
  origin: string;
  zoom: Zoom;
}) {
  const first = useRef<string | null>(null),
    last = useRef<string | null>(null);
  const { commit, busy } = useProjectActions();
  const { setPreview, notify } = useUI();
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape" && first.current) {
        first.current = null;
        last.current = null;
        setPreview(null);
      }
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [setPreview]);
  const at = (event: PointerEvent<HTMLDivElement>) =>
    xToDate(
      event.clientX - event.currentTarget.getBoundingClientRect().left,
      origin,
      zoom,
    );
  function start(event: PointerEvent<HTMLDivElement>) {
    if (busy || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    first.current = at(event);
    update(event);
  }
  function update(event: PointerEvent<HTMLDivElement>) {
    if (!first.current) return;
    const next = at(event);
    if (last.current === next) return;
    last.current = next;
    try {
      const patch = drawRange(first.current, last.current, task.isMilestone);
      setPreview(
        cascade(
          project.tasks.map((t) => (t.id === task.id ? { ...t, ...patch } : t)),
          project.dependencies,
        ),
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "Invalid date");
    }
  }
  function finish() {
    if (first.current && last.current)
      void commit({
        type: "task.update",
        id: task.id,
        patch: drawRange(first.current, last.current, task.isMilestone),
      });
    first.current = null;
    last.current = null;
  }
  return (
    <div
      role="presentation"
      onPointerDown={start}
      onPointerMove={update}
      onPointerUp={finish}
      onPointerCancel={() => {
        first.current = null;
        last.current = null;
        setPreview(null);
      }}
      className="absolute z-[11] cursor-crosshair touch-none"
      style={{ top: row * ROW_HEIGHT, width, height: ROW_HEIGHT }}
    >
      {!task.startDate && (
        <span className="sticky left-3 inline-flex h-full items-center px-3 text-[11px] text-brand-muted/70">
          Drag across a date to schedule
        </span>
      )}
    </div>
  );
}
