import type { Task, Dependency } from "@/lib/types";
import { addWholeDays, daysBetween, assertRange } from "./dates";
import { topological } from "./graph";
export function cascade(tasks: Task[], dependencies: Dependency[]): Task[] {
  const byId = new Map(tasks.map((t) => [t.id, { ...t }])),
    predecessors = new Map<string, string[]>();
  for (const d of dependencies)
    predecessors.set(d.successorTaskId, [
      ...(predecessors.get(d.successorTaskId) ?? []),
      d.predecessorTaskId,
    ]);
  for (const id of topological(tasks, dependencies)) {
    const task = byId.get(id)!;
    assertRange(task.startDate, task.endDate, task.isMilestone);
    if (!task.startDate || !task.endDate) continue;
    let earliest = task.startDate;
    for (const parentId of predecessors.get(id) ?? []) {
      const end = byId.get(parentId)?.endDate;
      if (end && addWholeDays(end, 1) > earliest)
        earliest = addWholeDays(end, 1);
    }
    if (earliest > task.startDate) {
      task.endDate = addWholeDays(
        task.endDate,
        daysBetween(earliest, task.startDate),
      );
      task.startDate = earliest;
      assertRange(task.startDate, task.endDate, task.isMilestone);
    }
  }
  return tasks.map((t) => byId.get(t.id)!);
}
export function moveTask(task: Task, days: number): Task {
  if (!task.startDate || !task.endDate) return task;
  const next = {
    ...task,
    startDate: addWholeDays(task.startDate, days),
    endDate: addWholeDays(task.endDate, days),
  };
  assertRange(next.startDate, next.endDate, next.isMilestone);
  return next;
}
export function resizeTask(
  task: Task,
  edge: "start" | "end",
  days: number,
): Task {
  if (!task.startDate || !task.endDate || task.isMilestone) return task;
  const start =
      edge === "start" ? addWholeDays(task.startDate, days) : task.startDate,
    end = edge === "end" ? addWholeDays(task.endDate, days) : task.endDate;
  const next = {
    ...task,
    startDate: start > end ? end : start,
    endDate: end < start ? start : end,
  };
  if (edge === "start") next.endDate = task.endDate;
  else next.startDate = task.startDate;
  assertRange(next.startDate, next.endDate);
  return next;
}
export function drawRange(first: string, last: string, isMilestone: boolean) {
  return {
    startDate: first < last ? first : last,
    endDate: isMilestone
      ? first < last
        ? first
        : last
      : first > last
        ? first
        : last,
  };
}
