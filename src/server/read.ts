import type {
  Assignee,
  ColorKey,
  Comment,
  Dependency,
  ProjectDetail,
  ProjectSummary,
  Task,
  TaskGroup,
} from "@/lib/types";
import type { SqlDb } from "./sql";
type ProjectRow = {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  archived: number;
  revision: number;
};
type TaskRow = Omit<Task, "isMilestone" | "assigneeIds"> & {
  isMilestone: number;
};
/** A project with everything the client needs, plus its saved revision. */
export async function readProjectWithRevision(
  db: SqlDb,
  id: string,
): Promise<{ project: ProjectDetail; revision: number }> {
  const one = (sql: string) => db.prepare(sql).bind(id);
  const [p, groups, tasks, assigned, deps, comments, people] =
    await Promise.all([
      one("SELECT * FROM Project WHERE id = ?").first<ProjectRow>(),
      one(
        "SELECT id, projectId, name, sortOrder FROM TaskGroup WHERE projectId = ? ORDER BY sortOrder, id",
      ).all<TaskGroup>(),
      one(
        `SELECT id, projectId, groupId, name, startDate, endDate, percentComplete,
                color, sortOrder, isMilestone
         FROM Task WHERE projectId = ? ORDER BY sortOrder, id`,
      ).all<TaskRow>(),
      one(
        `SELECT a.taskId, a.assigneeId FROM TaskAssignee a
         JOIN Task t ON t.id = a.taskId WHERE t.projectId = ?
         ORDER BY a.assigneeId`,
      ).all<{ taskId: string; assigneeId: string }>(),
      one(
        `SELECT d.id, d.predecessorTaskId, d.successorTaskId, d.type
         FROM Dependency d JOIN Task t ON t.id = d.predecessorTaskId
         WHERE t.projectId = ? ORDER BY t.sortOrder, t.id, d.id`,
      ).all<Dependency>(),
      one(
        `SELECT c.id, c.taskId, c.authorName, c.body, c.createdAt
         FROM Comment c JOIN Task t ON t.id = c.taskId
         WHERE t.projectId = ? ORDER BY t.sortOrder, t.id, c.createdAt, c.id`,
      ).all<Comment>(),
      db
        .prepare(
          "SELECT id, name, avatarColor, title, active FROM Assignee ORDER BY id",
        )
        .all<Omit<Assignee, "active"> & { active: number }>(),
    ]);
  if (!p) throw Error("Project not found");
  const byTask = new Map<string, string[]>();
  for (const a of assigned.results)
    byTask.set(a.taskId, [...(byTask.get(a.taskId) ?? []), a.assigneeId]);
  const project: ProjectDetail = {
    id: p.id,
    name: p.name,
    color: p.color as ColorKey,
    createdAt: p.createdAt,
    archived: Boolean(p.archived),
    groups: groups.results.map((g) => ({ ...g })),
    tasks: tasks.results.map((t) => ({
      id: t.id,
      projectId: t.projectId,
      groupId: t.groupId,
      name: t.name,
      startDate: t.startDate,
      endDate: t.endDate,
      percentComplete: t.percentComplete,
      color: t.color as ColorKey | null,
      sortOrder: t.sortOrder,
      isMilestone: Boolean(t.isMilestone),
      assigneeIds: (byTask.get(t.id) ?? []).sort(),
    })),
    dependencies: deps.results.map((d) => ({
      ...d,
      type: "finish_to_start" as const,
    })),
    assignees: people.results.map((a) => ({
      id: a.id,
      name: a.name,
      avatarColor: a.avatarColor,
      title: a.title,
      active: Boolean(a.active),
    })),
    comments: comments.results.map((c) => ({ ...c })),
  };
  return { project, revision: p.revision };
}
export async function readProject(db: SqlDb, id: string) {
  return (await readProjectWithRevision(db, id)).project;
}
/** Projects belonging to `ownerKey` (a demo visitor), or shared ones if null. */
export async function listProjects(
  db: SqlDb,
  ownerKey: string | null = null,
): Promise<ProjectSummary[]> {
  const { results } = await db
    .prepare(
      `SELECT p.id, p.name, p.color, p.createdAt, p.archived,
         (SELECT COUNT(*) FROM Task t WHERE t.projectId = p.id) AS taskCount,
         (SELECT COUNT(*) FROM Task t WHERE t.projectId = p.id AND t.percentComplete = 100) AS completedCount
       FROM Project p WHERE p.ownerKey IS ? ORDER BY p.createdAt DESC, p.id`,
    )
    .bind(ownerKey)
    .all<ProjectRow & { taskCount: number; completedCount: number }>();
  return results.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color as ColorKey,
    createdAt: p.createdAt,
    archived: Boolean(p.archived),
    taskCount: Number(p.taskCount),
    completedCount: Number(p.completedCount),
  }));
}
