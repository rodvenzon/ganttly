import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localDb } from "@/server/sql-local";
import { ensureSchema, resetSchemaCache } from "@/server/schema";
import { readProject, readProjectWithRevision } from "@/server/read";
import { executeCommand } from "@/server/mutate";
import { versionFor } from "@/server/version";
import { seedProject } from "@/server/seed";
import { demoProject } from "@/server/seed-data";
import { addWholeDays, daysBetween } from "@/lib/scheduling/dates";
import type { Command } from "@/lib/api/commands";
const dir = mkdtempSync(join(tmpdir(), "ganttly-tests-")),
  url = "file:" + join(dir, "test.db"),
  db = localDb(url);
beforeAll(async () => {
  resetSchemaCache();
  await ensureSchema(db, { seed: false });
  await seedProject(db, demoProject());
}, 30000);
afterAll(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
const versionOf = async (id: string) =>
  versionFor(id, (await readProjectWithRevision(db, id)).revision);
const exists = async (table: string, id: string) =>
  Boolean(
    await db.prepare(`SELECT id FROM ${table} WHERE id = ?`).bind(id).first(),
  );
async function run(command: Command) {
  return executeCommand(
    db,
    "demo-project",
    await versionOf("demo-project"),
    command,
  );
}
describe("transactional SQLite persistence", () => {
  it("saves date changes and the entire dependency cascade across a new connection", async () => {
    const original = await readProject(db, "demo-project"),
      a = original.tasks.find((t) => t.id === "task-0")!,
      b = original.tasks.find((t) => t.id === "task-2")!;
    const result = await run({
      type: "task.update",
      id: a.id,
      patch: {
        startDate: addWholeDays(a.startDate!, 10),
        endDate: addWholeDays(a.endDate!, 10),
      },
    });
    const connection = localDb(url);
    try {
      const persisted = await readProject(connection, "demo-project");
      expect(persisted).toEqual(result.project);
      const child = persisted.tasks.find((t) => t.id === b.id)!;
      expect(child.startDate).toBe(addWholeDays(a.endDate!, 11));
      expect(daysBetween(child.endDate!, child.startDate!)).toBe(
        daysBetween(b.endDate!, b.startDate!),
      );
    } finally {
      connection.close();
    }
  });
  it("rejects stale versions without losing the previous saved edit", async () => {
    const before = await readProject(db, "demo-project"),
      version = await versionOf("demo-project");
    await executeCommand(db, before.id, version, {
      type: "task.update",
      id: "task-1",
      patch: { name: "Persisted rename" },
    });
    await expect(
      executeCommand(db, before.id, version, {
        type: "task.update",
        id: "task-1",
        patch: { name: "Stale overwrite" },
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (await readProject(db, before.id)).tasks.find((t) => t.id === "task-1")
        ?.name,
    ).toBe("Persisted rename");
  });
  it("rejects a cycle atomically", async () => {
    const before = await readProject(db, "demo-project");
    await expect(
      run({
        type: "dependency.add",
        id: "cycle",
        predecessorTaskId: "task-2",
        successorTaskId: "task-0",
      }),
    ).rejects.toThrow("circular");
    expect(await readProject(db, "demo-project")).toEqual(before);
  });
  it("rolls back a database failure after an earlier task write", async () => {
    await db.batch([
      db.prepare(
        "INSERT INTO Project (id, name, color, createdAt) VALUES ('other-project', 'Other', 'gold', '2026-01-01T00:00:00.000Z')",
      ),
      db.prepare(
        "INSERT INTO Task (id, projectId, name, sortOrder) VALUES ('other-a', 'other-project', 'A', 0), ('other-b', 'other-project', 'B', 1)",
      ),
      db.prepare(
        "INSERT INTO Dependency (id, predecessorTaskId, successorTaskId) VALUES ('duplicate-id', 'other-a', 'other-b')",
      ),
    ]);
    const before = await readProject(db, "demo-project");
    await expect(
      run({
        type: "dependency.add",
        id: "duplicate-id",
        predecessorTaskId: "task-19",
        successorTaskId: "task-1",
      }),
    ).rejects.toThrow();
    expect(await readProject(db, "demo-project")).toEqual(before);
  });
  it("persists progress, multiple assignees, comments, and reorder", async () => {
    await run({
      type: "task.update",
      id: "task-3",
      patch: { percentComplete: 67, assigneeIds: ["person-0", "person-4"] },
    });
    await run({
      type: "comment.add",
      id: "comment-test",
      taskId: "task-3",
      body: "Saved comment",
    });
    await run({
      type: "task.reorder",
      id: "task-3",
      groupId: "group-2",
      beforeId: "task-20",
    });
    const p = await readProject(db, "demo-project"),
      task = p.tasks.find((t) => t.id === "task-3")!;
    expect(task).toMatchObject({
      percentComplete: 67,
      assigneeIds: ["person-0", "person-4"],
      groupId: "group-2",
      sortOrder: 0,
    });
    expect(p.comments.find((c) => c.id === "comment-test")).toMatchObject({
      body: "Saved comment",
      authorName: "Guest",
    });
  });
  it("creates unscheduled tasks, schedules milestones, and removes related data", async () => {
    await run({
      type: "task.create",
      id: "new-task",
      name: "New milestone",
      groupId: null,
      isMilestone: true,
    });
    await run({
      type: "task.update",
      id: "new-task",
      patch: { startDate: "2026-12-01", endDate: "2026-12-01" },
    });
    await run({
      type: "comment.add",
      id: "new-comment",
      taskId: "new-task",
      body: "A note",
    });
    await run({
      type: "dependency.add",
      id: "new-link",
      predecessorTaskId: "task-0",
      successorTaskId: "new-task",
    });
    await run({ type: "task.delete", id: "new-task" });
    expect(await exists("Task", "new-task")).toBe(false);
    expect(await exists("Comment", "new-comment")).toBe(false);
    expect(await exists("Dependency", "new-link")).toBe(false);
  });
});
