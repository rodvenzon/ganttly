import { ChevronDown, ChevronRight } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import { ROW_HEIGHT, HEADER_HEIGHT } from "@/lib/scheduling/constants";
import type { ProjectDetail, TaskGroup } from "@/lib/types";
import type { Row } from "./model";
import { useUI } from "@/store/ui";
import { TaskTableRow } from "./TaskTableRow";
export function ListHeader({ width }: { width: number }) {
  return (
    <div
      className="sticky left-0 z-40 flex shrink-0 items-center border-b border-r border-brand-line bg-white px-4 text-[11px] font-semibold uppercase tracking-wider text-brand-muted"
      style={{ width, height: HEADER_HEIGHT }}
    >
      <span className="flex-1">Task name</span>
      {width > 500 && (
        <>
          <span className="w-[72px]">Start</span>
          <span className="w-[72px]">End</span>
          <span className="w-10">%</span>
          <span className="w-16">Owner</span>
        </>
      )}
    </div>
  );
}
function GroupRow({
  group,
  top,
  width,
  count,
}: {
  group: TaskGroup;
  top: number;
  width: number;
  count: number;
}) {
  const { collapsed, toggleGroup } = useUI(),
    { setNodeRef, isOver } = useDroppable({
      id: "group-" + group.id,
      data: { groupId: group.id },
    });
  return (
    <div
      ref={setNodeRef}
      style={{ top, width, height: ROW_HEIGHT }}
      className={`absolute flex items-center border-b border-brand-line bg-brand-stone px-4 text-xs font-semibold ${isOver ? "ring-2 ring-inset ring-brand-accent" : ""}`}
    >
      <button
        className="flex w-full items-center gap-2 text-left"
        aria-expanded={!collapsed.includes(group.id)}
        onClick={() => toggleGroup(group.id)}
      >
        {collapsed.includes(group.id) ? (
          <ChevronRight size={14} />
        ) : (
          <ChevronDown size={14} />
        )}
        <span className="flex-1 truncate">{group.name}</span>
        <span className="text-brand-muted">{count}</span>
      </button>
    </div>
  );
}
export function TaskListPane({
  rows,
  offset,
  width,
  height,
  project,
}: {
  rows: Row[];
  offset: number;
  width: number;
  height: number;
  project: ProjectDetail;
}) {
  return (
    <div
      className="sticky left-0 z-20 border-r border-brand-line bg-white"
      style={{ width, height }}
    >
      {rows.map((row, i) =>
        row.type === "group" ? (
          <GroupRow
            key={row.id}
            group={row.group}
            top={(offset + i) * ROW_HEIGHT}
            width={width}
            count={project.tasks.filter((t) => t.groupId === row.id).length}
          />
        ) : (
          <TaskTableRow
            key={row.id}
            task={row.task}
            project={project}
            width={width}
            top={(offset + i) * ROW_HEIGHT}
          />
        ),
      )}
    </div>
  );
}
