import { useState, useRef, useEffect } from "react";
import { GripVertical, Diamond, PanelRightOpen } from "lucide-react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { Task, ProjectDetail } from "@/lib/types";
import { useUI } from "@/store/ui";
import { useProjectActions } from "@/lib/api/use-project-actions";
import { Assignees } from "@/components/ui/Assignees";
import { ROW_HEIGHT } from "@/lib/scheduling/constants";
export function TaskTableRow({
  task,
  project,
  width,
  top,
}: {
  task: Task;
  project: ProjectDetail;
  width: number;
  top: number;
}) {
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (clickTimer.current) clearTimeout(clickTimer.current);
    },
    [],
  );
  const { commit, busy } = useProjectActions();
  const { selectTask, selectedTaskId } = useUI();
  const [editing, setEditing] = useState(false),
    [name, setName] = useState(task.name);
  const {
    setNodeRef: setDragRef,
    listeners,
    attributes,
  } = useDraggable({
    id: "row-" + task.id,
    data: { kind: "row", taskId: task.id },
    disabled: busy,
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: "drop-" + task.id,
    data: { taskId: task.id, groupId: task.groupId },
  });
  function save() {
    setEditing(false);
    if (name.trim() && name.trim() !== task.name)
      void commit({
        type: "task.update",
        id: task.id,
        patch: { name: name.trim() },
      });
    else setName(task.name);
  }
  return (
    <div
      ref={setDropRef}
      style={{ top, width, height: ROW_HEIGHT }}
      className={`absolute flex items-center border-b border-brand-line/70 px-2 text-xs ${selectedTaskId === task.id ? "bg-brand-soft" : "bg-white"} ${isOver ? "border-t-2 border-t-brand-accent" : ""}`}
    >
      <button
        ref={setDragRef}
        {...listeners}
        {...attributes}
        className="mr-1 cursor-grab touch-none text-brand-muted/50"
        aria-label={`Reorder ${task.name}`}
      >
        <GripVertical size={14} />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-1 pr-2">
        {task.isMilestone && <Diamond size={11} className="shrink-0" />}
        {editing ? (
          <input
            aria-label="Task name"
            autoFocus
            maxLength={160}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setEditing(false);
                setName(task.name);
              }
            }}
            className="min-w-0 flex-1 rounded border border-brand-accent px-1 py-1"
          />
        ) : (
          <span
            tabIndex={0}
            role="button"
            onClick={() => {
              if (clickTimer.current) clearTimeout(clickTimer.current);
              clickTimer.current = setTimeout(() => selectTask(task.id), 260);
            }}
            onDoubleClick={() => {
              if (clickTimer.current) clearTimeout(clickTimer.current);
              if (!busy) {
                setName(task.name);
                setEditing(true);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") selectTask(task.id);
              if (e.key === "F2") {
                setName(task.name);
                setEditing(true);
              }
            }}
            title="Double-click to rename. Enter opens details."
            className="min-w-0 flex-1 cursor-text truncate"
          >
            {task.name}
          </span>
        )}
        <button
          onClick={() => selectTask(task.id)}
          aria-label={`Details for ${task.name}`}
          className="text-brand-muted"
        >
          <PanelRightOpen size={13} />
        </button>
      </div>
      {width > 500 && (
        <>
          <span className="w-[72px] text-brand-muted">
            {task.startDate?.slice(5) ?? "—"}
          </span>
          <span className="w-[72px] text-brand-muted">
            {task.endDate?.slice(5) ?? "—"}
          </span>
          <span className="w-10 tabular-nums">{task.percentComplete}</span>
          <span className="w-16">
            <Assignees
              people={project.assignees.filter((p) =>
                task.assigneeIds.includes(p.id),
              )}
            />
          </span>
        </>
      )}
    </div>
  );
}
