import { memo, useMemo } from "react";
import { useDraggable } from "@dnd-kit/core";
import type { Task, ColorKey } from "@/lib/types";
import type { Zoom } from "@/lib/scheduling/constants";
import { barGeometry } from "@/lib/scheduling/geometry";
import { colorClasses } from "@/lib/colors";
import { useProjectActions } from "@/lib/api/use-project-actions";
export const TaskBar = memo(function TaskBar({
  task,
  row,
  origin,
  zoom,
  projectColor,
  select,
}: {
  task: Task;
  row: number;
  origin: string;
  zoom: Zoom;
  projectColor: ColorKey;
  select: (id: string) => void;
}) {
  const { busy } = useProjectActions();
  const move = useDraggable({
    id: "move-" + task.id,
    data: { taskId: task.id, kind: "move" },
    disabled: busy,
  });
  const start = useDraggable({
    id: "start-" + task.id,
    data: { taskId: task.id, kind: "start" },
    disabled: busy || task.isMilestone,
  });
  const end = useDraggable({
    id: "end-" + task.id,
    data: { taskId: task.id, kind: "end" },
    disabled: busy || task.isMilestone,
  });
  const g = useMemo(
    () => barGeometry(task, row, origin, zoom),
    [task, row, origin, zoom],
  );
  if (!g) return null;
  return (
    <div
      className="group absolute z-10 touch-none"
      data-connect-task={task.id}
      style={{ left: g.x, top: g.y, width: g.width, height: g.height }}
    >
      <button
        ref={move.setNodeRef}
        {...move.listeners}
        {...move.attributes}
        onClick={() => select(task.id)}
        title={`${task.name}: ${task.startDate} to ${task.endDate}. Drag to move.`}
        aria-label={`Move or edit ${task.name}`}
        className="absolute inset-0 cursor-grab rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent active:cursor-grabbing"
      >
        <svg
          width={g.width}
          height={g.height}
          className="overflow-visible"
          aria-hidden="true"
        >
          {task.isMilestone ? (
            <path
              d="M9 4 L18 14 L9 24 L0 14 Z"
              className={colorClasses[task.color ?? projectColor]}
            />
          ) : (
            <>
              <rect
                width={g.width}
                height={g.height}
                rx={5}
                className={colorClasses[task.color ?? projectColor]}
                strokeWidth={0.8}
              />
              <rect
                x={3}
                y={20}
                width={Math.max(
                  0,
                  ((g.width - 6) * task.percentComplete) / 100,
                )}
                height={5}
                rx={2}
                className="fill-brand-ink/25"
              />
              {g.width > 60 && (
                <text x={9} y={16} className="fill-brand-ink text-[11px]">
                  {task.name.length > g.width / 7
                    ? task.name.slice(
                        0,
                        Math.max(3, Math.floor(g.width / 7) - 2),
                      ) + "…"
                    : task.name}
                </text>
              )}
            </>
          )}
        </svg>
      </button>
      {!task.isMilestone && (
        <>
          <button
            ref={start.setNodeRef}
            {...start.listeners}
            {...start.attributes}
            aria-label={`Resize start of ${task.name}`}
            title="Drag start date"
            className="absolute -left-2 top-0 h-full w-2 cursor-ew-resize rounded-l border-r-2 border-brand-ink/30 opacity-0 focus:opacity-100 group-hover:opacity-100"
          />
          <button
            ref={end.setNodeRef}
            {...end.listeners}
            {...end.attributes}
            aria-label={`Resize end of ${task.name}`}
            title="Drag end date"
            className="absolute -right-2 top-0 h-full w-2 cursor-ew-resize rounded-r border-l-2 border-brand-ink/30 opacity-0 focus:opacity-100 group-hover:opacity-100"
          />
        </>
      )}
    </div>
  );
});
