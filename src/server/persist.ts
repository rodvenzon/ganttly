import type {
  Comment,
  Dependency,
  ProjectDetail,
  Task,
  TaskGroup,
} from "@/lib/types";
import { json, type SqlDb, type SqlStatement } from "./sql";
/*
 * Every helper here is ONE statement however many rows it touches: rows are
 * bound as a single JSON array and expanded with json_each. That keeps a save
 * well under D1's per-request query limit and its 100-parameter limit.
 * Plain INSERTs fail on a duplicate id, which aborts the whole batch.
 */
const col = (name: string) => `json_extract(value, '$.${name}')`;
const TASK_COLUMNS = [
  "id",
  "projectId",
  "groupId",
  "name",
  "startDate",
  "endDate",
  "percentComplete",
  "color",
  "sortOrder",
  "isMilestone",
] as const;
const taskRow = (t: Task) => ({
  ...t,
  isMilestone: t.isMilestone ? 1 : 0,
});
export const insertGroups = (db: SqlDb, groups: TaskGroup[]) =>
  db
    .prepare(
      `INSERT INTO TaskGroup (id, projectId, name, sortOrder)
       SELECT ${["id", "projectId", "name", "sortOrder"].map(col).join(", ")}
       FROM json_each(?)`,
    )
    .bind(json(groups));
export const insertTasks = (db: SqlDb, tasks: Task[]) =>
  db
    .prepare(
      `INSERT INTO Task (${TASK_COLUMNS.join(", ")})
       SELECT ${TASK_COLUMNS.map(col).join(", ")} FROM json_each(?)`,
    )
    .bind(json(tasks.map(taskRow)));
export const insertAssignments = (db: SqlDb, tasks: Task[]) =>
  db
    .prepare(
      `INSERT INTO TaskAssignee (taskId, assigneeId)
       SELECT ${col("taskId")}, ${col("assigneeId")} FROM json_each(?)`,
    )
    .bind(
      json(
        tasks.flatMap((t) =>
          t.assigneeIds.map((assigneeId) => ({ taskId: t.id, assigneeId })),
        ),
      ),
    );
export const insertDependencies = (db: SqlDb, deps: Dependency[]) =>
  db
    .prepare(
      `INSERT INTO Dependency (id, predecessorTaskId, successorTaskId, type)
       SELECT ${["id", "predecessorTaskId", "successorTaskId", "type"].map(col).join(", ")}
       FROM json_each(?)`,
    )
    .bind(json(deps));
export const insertComments = (db: SqlDb, comments: Comment[]) =>
  db
    .prepare(
      `INSERT INTO Comment (id, taskId, authorName, body, createdAt)
       SELECT ${["id", "taskId", "authorName", "body", "createdAt"].map(col).join(", ")}
       FROM json_each(?)`,
    )
    .bind(json(comments));
/** Statements that turn the saved `before` state into `after`. */
export function persistStatements(
  db: SqlDb,
  before: ProjectDetail,
  after: ProjectDetail,
): SqlStatement[] {
  const out: SqlStatement[] = [];
  const ids = (list: { id: string }[]) => new Set(list.map((x) => x.id));
  const removed = <T extends { id: string }>(old: T[], next: T[]) => {
    const keep = ids(next);
    return old.filter((x) => !keep.has(x.id)).map((x) => x.id);
  };
  const added = <T extends { id: string }>(old: T[], next: T[]) => {
    const had = ids(old);
    return next.filter((x) => !had.has(x.id));
  };
  const goneDeps = removed(before.dependencies, after.dependencies);
  if (goneDeps.length)
    out.push(
      db
        .prepare(
          `DELETE FROM Dependency WHERE id IN (SELECT value FROM json_each(?))
           AND successorTaskId IN (SELECT id FROM Task WHERE projectId = ?)`,
        )
        .bind(json(goneDeps), before.id),
    );
  const goneTasks = removed(before.tasks, after.tasks);
  if (goneTasks.length)
    out.push(
      db
        .prepare(
          "DELETE FROM Task WHERE id IN (SELECT value FROM json_each(?)) AND projectId = ?",
        )
        .bind(json(goneTasks), before.id),
    );
  if (
    before.name !== after.name ||
    before.color !== after.color ||
    before.archived !== after.archived ||
    before.skipWeekends !== after.skipWeekends
  )
    out.push(
      db
        .prepare(
          "UPDATE Project SET name = ?, color = ?, archived = ?, skipWeekends = ? WHERE id = ?",
        )
        .bind(
          after.name,
          after.color,
          after.archived ? 1 : 0,
          after.skipWeekends ? 1 : 0,
          before.id,
        ),
    );
  const newGroups = added(before.groups, after.groups);
  if (newGroups.length) out.push(insertGroups(db, newGroups));
  const prior = new Map(before.tasks.map((t) => [t.id, t]));
  const newTasks = after.tasks.filter((t) => !prior.has(t.id));
  const changed = after.tasks.filter((t) => {
    const old = prior.get(t.id);
    return old && JSON.stringify(old) !== JSON.stringify(t);
  });
  if (newTasks.length) out.push(insertTasks(db, newTasks));
  if (changed.length)
    out.push(
      db
        .prepare(
          `UPDATE Task SET ${TASK_COLUMNS.filter(
            (c) => c !== "id" && c !== "projectId",
          )
            .map((c) => `${c} = ${col(c)}`)
            .join(", ")}
           FROM json_each(?) WHERE Task.id = ${col("id")} AND Task.projectId = ?`,
        )
        .bind(json(changed.map(taskRow)), before.id),
    );
  const reassigned = changed.filter(
    (t) =>
      JSON.stringify(prior.get(t.id)!.assigneeIds) !==
      JSON.stringify(t.assigneeIds),
  );
  if (reassigned.length)
    out.push(
      db
        .prepare(
          "DELETE FROM TaskAssignee WHERE taskId IN (SELECT value FROM json_each(?))",
        )
        .bind(json(reassigned.map((t) => t.id))),
    );
  const assign = [...newTasks, ...reassigned].filter(
    (t) => t.assigneeIds.length,
  );
  if (assign.length) out.push(insertAssignments(db, assign));
  const newDeps = added(before.dependencies, after.dependencies);
  if (newDeps.length) out.push(insertDependencies(db, newDeps));
  const newComments = added(before.comments, after.comments);
  if (newComments.length) out.push(insertComments(db, newComments));
  return out;
}
