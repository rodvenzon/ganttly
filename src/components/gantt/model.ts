import { addDays, startOfWeek, parseISO } from "date-fns";
import type { ProjectDetail, Task, TaskGroup } from "@/lib/types";
import { dateOnly, today, daysBetween } from "@/lib/scheduling/dates";
export type Row =
  | { type: "group"; group: TaskGroup; id: string }
  | { type: "task"; task: Task; id: string };
export function projectRows(
  project: ProjectDetail,
  collapsed: string[],
): Row[] {
  const rows: Row[] = [];
  for (const group of [...project.groups].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )) {
    rows.push({ type: "group", group, id: group.id });
    if (!collapsed.includes(group.id))
      for (const task of project.tasks
        .filter((t) => t.groupId === group.id)
        .sort((a, b) => a.sortOrder - b.sortOrder))
        rows.push({ type: "task", task, id: task.id });
  }
  for (const task of project.tasks
    .filter((t) => !t.groupId)
    .sort((a, b) => a.sortOrder - b.sortOrder))
    rows.push({ type: "task", task, id: task.id });
  return rows;
}
export function projectRange(project: ProjectDetail) {
  const dates = project.tasks.flatMap((t) =>
    t.startDate && t.endDate ? [t.startDate, t.endDate] : [],
  );
  const min = [today(), ...dates].sort()[0],
    max = [today(), ...dates].sort().at(-1)!;
  const origin = dateOnly(
    startOfWeek(addDays(parseISO(min), -7), { weekStartsOn: 1 }),
  );
  return { origin, days: Math.max(45, daysBetween(max, origin) + 15) };
}
