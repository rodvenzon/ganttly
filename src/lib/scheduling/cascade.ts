import type { Task, Dependency } from "@/lib/types";
import { addWholeDays, daysBetween, assertRange } from "./dates";
import { topological } from "./graph";
import {
  CALENDAR_DAYS,
  endAfter,
  nextWorkday,
  onWorkdays,
  workdaysIn,
  type WorkCalendar,
} from "./calendar";
/** Moves a task to start on `start`, keeping its length in (working) days. */
function shiftTo(task: Task, start: string, cal: WorkCalendar) {
  const days = workdaysIn(task.startDate!, task.endDate!, cal);
  return { ...task, startDate: start, endDate: endAfter(start, days, cal) };
}
/** With skipWeekends, also pulls every task onto weekdays. */
export function cascade(
  tasks: Task[],
  dependencies: Dependency[],
  cal: WorkCalendar = CALENDAR_DAYS,
): Task[] {
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
    Object.assign(
      task,
      onWorkdays(task.startDate, task.endDate, cal, task.isMilestone),
    );
    let earliest = task.startDate!;
    for (const parentId of predecessors.get(id) ?? []) {
      const end = byId.get(parentId)?.endDate;
      const after = end && nextWorkday(addWholeDays(end, 1), cal);
      if (after && after > earliest) earliest = after;
    }
    if (earliest > task.startDate!) {
      if (cal.skipWeekends) Object.assign(task, shiftTo(task, earliest, cal));
      else {
        task.endDate = addWholeDays(
          task.endDate!,
          daysBetween(earliest, task.startDate!),
        );
        task.startDate = earliest;
      }
      assertRange(task.startDate, task.endDate, task.isMilestone);
    }
  }
  return tasks.map((t) => byId.get(t.id)!);
}
export function moveTask(
  task: Task,
  days: number,
  cal: WorkCalendar = CALENDAR_DAYS,
): Task {
  if (!task.startDate || !task.endDate) return task;
  if (cal.skipWeekends) {
    const start = nextWorkday(addWholeDays(task.startDate, days), cal);
    const next = shiftTo(task, start, cal);
    assertRange(next.startDate, next.endDate, next.isMilestone);
    return next;
  }
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
  cal: WorkCalendar = CALENDAR_DAYS,
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
  if (cal.skipWeekends)
    Object.assign(next, onWorkdays(next.startDate!, next.endDate!, cal));
  assertRange(next.startDate, next.endDate);
  return next;
}
export function drawRange(
  first: string,
  last: string,
  isMilestone: boolean,
  cal: WorkCalendar = CALENDAR_DAYS,
) {
  const range = {
    startDate: first < last ? first : last,
    endDate: isMilestone
      ? first < last
        ? first
        : last
      : first > last
        ? first
        : last,
  };
  return onWorkdays(range.startDate, range.endDate, cal, isMilestone);
}
