import type { ProjectDetail, Task } from "@/lib/types";
import { cascade } from "@/lib/scheduling/cascade";
import { calendarOf } from "@/lib/scheduling/calendar";
import type { Command } from "./commands";
function requireTask(p: ProjectDetail, id: string) {
  const task = p.tasks.find((t) => t.id === id);
  if (!task) throw Error("Task not found");
  return task;
}
function groupExists(p: ProjectDetail, id: string | null) {
  if (id && !p.groups.some((g) => g.id === id)) throw Error("Group not found");
}
function reorder(
  p: ProjectDetail,
  id: string,
  groupId: string | null,
  beforeId: string | null,
) {
  const task = requireTask(p, id);
  groupExists(p, groupId);
  if (beforeId === id) return;
  const oldGroup = task.groupId;
  const destination = p.tasks
    .filter((t) => t.groupId === groupId && t.id !== id)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const index =
    beforeId === null
      ? destination.length
      : destination.findIndex((t) => t.id === beforeId);
  if (index < 0) throw Error("Drop target not found in this group");
  task.groupId = groupId;
  destination.splice(index, 0, task);
  destination.forEach((t, i) => (t.sortOrder = i));
  if (oldGroup !== groupId)
    p.tasks
      .filter((t) => t.groupId === oldGroup)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach((t, i) => (t.sortOrder = i));
}
export function applyCommand(
  source: ProjectDetail,
  command: Command,
  context: { authorName: string; now: string },
): ProjectDetail {
  const p: ProjectDetail = {
    ...source,
    tasks: source.tasks.map((t) => ({ ...t, assigneeIds: [...t.assigneeIds] })),
    groups: [...source.groups],
    dependencies: [...source.dependencies],
    comments: [...source.comments],
  };
  if (p.archived && command.type !== "project.update")
    throw Error("Restore this project before editing it");
  switch (command.type) {
    case "task.update": {
      const t = requireTask(p, command.id);
      Object.assign(t, command.patch);
      if (t.assigneeIds.some((id) => !p.assignees.some((a) => a.id === id)))
        throw Error("Assignee not found");
      t.assigneeIds = [...new Set(t.assigneeIds)].sort();
      break;
    }
    case "task.create": {
      groupExists(p, command.groupId);
      if (p.tasks.some((t) => t.id === command.id))
        throw Error("Task already exists");
      const task: Task = {
        id: command.id,
        name: command.name,
        groupId: command.groupId,
        projectId: p.id,
        startDate: null,
        endDate: null,
        percentComplete: 0,
        color: null,
        sortOrder:
          Math.max(
            -1,
            ...p.tasks
              .filter((t) => t.groupId === command.groupId)
              .map((t) => t.sortOrder),
          ) + 1,
        isMilestone: command.isMilestone ?? false,
        assigneeIds: [],
      };
      p.tasks.push(task);
      break;
    }
    case "task.delete":
      requireTask(p, command.id);
      p.tasks = p.tasks.filter((t) => t.id !== command.id);
      p.dependencies = p.dependencies.filter(
        (d) =>
          d.predecessorTaskId !== command.id &&
          d.successorTaskId !== command.id,
      );
      p.comments = p.comments.filter((c) => c.taskId !== command.id);
      break;
    case "task.reorder":
      reorder(p, command.id, command.groupId, command.beforeId);
      break;
    case "group.create":
      if (p.groups.some((g) => g.id === command.id))
        throw Error("Group already exists");
      p.groups.push({
        id: command.id,
        name: command.name,
        projectId: p.id,
        sortOrder: p.groups.length,
      });
      break;
    case "dependency.add":
      requireTask(p, command.predecessorTaskId);
      requireTask(p, command.successorTaskId);
      if (
        p.dependencies.some(
          (d) =>
            d.id === command.id ||
            (d.predecessorTaskId === command.predecessorTaskId &&
              d.successorTaskId === command.successorTaskId),
        )
      )
        throw Error("Dependency already exists");
      p.dependencies.push({ ...command, type: "finish_to_start" });
      break;
    case "dependency.remove":
      if (!p.dependencies.some((d) => d.id === command.id))
        throw Error("Dependency not found");
      p.dependencies = p.dependencies.filter((d) => d.id !== command.id);
      break;
    case "comment.add":
      requireTask(p, command.taskId);
      if (p.comments.some((c) => c.id === command.id))
        throw Error("Comment already exists");
      p.comments.push({
        id: command.id,
        taskId: command.taskId,
        body: command.body,
        authorName: context.authorName,
        createdAt: context.now,
      });
      break;
    case "project.update":
      if (command.name !== undefined) p.name = command.name;
      if (command.color !== undefined) p.color = command.color;
      if (command.archived !== undefined) p.archived = command.archived;
      if (command.skipWeekends !== undefined)
        p.skipWeekends = command.skipWeekends;
      break;
  }
  p.tasks = cascade(p.tasks, p.dependencies, calendarOf(p));
  return p;
}
