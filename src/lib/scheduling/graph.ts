import type { Dependency, Task } from "@/lib/types";
export function topological(
  tasks: Pick<Task, "id">[],
  dependencies: Dependency[],
) {
  const ids = new Set(tasks.map((t) => t.id)),
    degree = new Map(tasks.map((t) => [t.id, 0])),
    children = new Map<string, string[]>();
  for (const dep of dependencies) {
    if (!ids.has(dep.predecessorTaskId) || !ids.has(dep.successorTaskId))
      throw Error("A dependency refers to a missing task.");
    degree.set(dep.successorTaskId, degree.get(dep.successorTaskId)! + 1);
    children.set(dep.predecessorTaskId, [
      ...(children.get(dep.predecessorTaskId) ?? []),
      dep.successorTaskId,
    ]);
  }
  const queue = tasks.filter((t) => degree.get(t.id) === 0).map((t) => t.id);
  for (let i = 0; i < queue.length; i++)
    for (const child of children.get(queue[i]) ?? []) {
      degree.set(child, degree.get(child)! - 1);
      if (degree.get(child) === 0) queue.push(child);
    }
  if (queue.length !== tasks.length)
    throw Error("This dependency creates a circular chain.");
  return queue;
}
export function detectCycle(
  tasks: Pick<Task, "id">[],
  dependencies: Dependency[],
) {
  try {
    topological(tasks, dependencies);
    return false;
  } catch (e) {
    if (e instanceof Error && e.message.includes("circular")) return true;
    throw e;
  }
}
