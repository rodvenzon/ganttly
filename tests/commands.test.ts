import { describe, it, expect } from "vitest";
import { demoProject } from "@/server/seed-data";
import { applyCommand } from "@/lib/api/apply-command";
import { commandSchema } from "@/lib/api/commands";
const context = { authorName: "Alex Morgan", now: "2026-10-08T12:00:00.000Z" };
describe("project commands", () => {
  it("rejects cross-project references and cycles before changing source", () => {
    const p = demoProject(),
      original = JSON.stringify(p);
    expect(() =>
      applyCommand(
        p,
        {
          type: "dependency.add",
          id: "reverse",
          predecessorTaskId: "task-2",
          successorTaskId: "task-0",
        },
        context,
      ),
    ).toThrow("circular");
    expect(() =>
      applyCommand(
        p,
        { type: "task.update", id: "missing", patch: { name: "test" } },
        context,
      ),
    ).toThrow("not found");
    expect(JSON.stringify(p)).toBe(original);
  });
  it("reorders within a group and moves between groups without duplicate positions", () => {
    let p = demoProject();
    p = applyCommand(
      p,
      {
        type: "task.reorder",
        id: "task-4",
        groupId: "group-0",
        beforeId: "task-1",
      },
      context,
    );
    expect(
      p.tasks
        .filter((t) => t.groupId === "group-0")
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .slice(0, 3)
        .map((t) => t.id),
    ).toEqual(["task-0", "task-4", "task-1"]);
    p = applyCommand(
      p,
      {
        type: "task.reorder",
        id: "task-4",
        groupId: "group-1",
        beforeId: null,
      },
      context,
    );
    const target = p.tasks
      .filter((t) => t.groupId === "group-1")
      .sort((a, b) => a.sortOrder - b.sortOrder);
    expect(target.at(-1)?.id).toBe("task-4");
    expect(new Set(target.map((t) => t.sortOrder)).size).toBe(target.length);
  });
  it("cleans dependencies and comments when deleting a task", () => {
    const p = applyCommand(
      demoProject(),
      { type: "task.delete", id: "task-0" },
      context,
    );
    expect(p.dependencies.some((d) => d.predecessorTaskId === "task-0")).toBe(
      false,
    );
    expect(p.comments.some((c) => c.taskId === "task-0")).toBe(false);
  });
  it("allows multiple assignees, rejects unknown ones, and validates milestones", () => {
    const p = demoProject();
    expect(
      applyCommand(
        p,
        {
          type: "task.update",
          id: "task-0",
          patch: { assigneeIds: ["person-1", "person-2"] },
        },
        context,
      ).tasks[0].assigneeIds,
    ).toEqual(["person-1", "person-2"]);
    expect(() =>
      applyCommand(
        p,
        {
          type: "task.update",
          id: "task-0",
          patch: { assigneeIds: ["stranger"] },
        },
        context,
      ),
    ).toThrow("Assignee");
    expect(() =>
      applyCommand(
        p,
        { type: "task.update", id: "task-0", patch: { isMilestone: true } },
        context,
      ),
    ).toThrow();
  });
  it("validates request shapes, progress limits and date pairs", () => {
    expect(
      commandSchema.safeParse({
        type: "task.update",
        id: "a",
        patch: { percentComplete: 101 },
      }).success,
    ).toBe(false);
    expect(
      commandSchema.safeParse({
        type: "task.update",
        id: "a",
        patch: { startDate: "2026-02-30" },
      }).success,
    ).toBe(false);
    expect(
      commandSchema.safeParse({
        type: "task.delete",
        id: "a",
        projectId: "other",
      }).success,
    ).toBe(false);
  });
  it("prevents edits to archived projects but supports restoring", () => {
    const p = { ...demoProject(), archived: true };
    expect(() =>
      applyCommand(p, { type: "task.delete", id: "task-0" }, context),
    ).toThrow("Restore");
    expect(
      applyCommand(p, { type: "project.update", archived: false }, context)
        .archived,
    ).toBe(false);
  });
});

it("appends new tasks after sparse sort positions, including seeded later groups", () => {
  let p = demoProject();
  p = applyCommand(p, { type: "task.delete", id: "task-13" }, context);
  p = applyCommand(
    p,
    {
      type: "task.create",
      id: "appended",
      name: "Last task",
      groupId: "group-1",
    },
    context,
  );
  const group = p.tasks
    .filter((t) => t.groupId === "group-1")
    .sort((a, b) => a.sortOrder - b.sortOrder);
  expect(group.at(-1)?.id).toBe("appended");
  expect(new Set(group.map((t) => t.sortOrder)).size).toBe(group.length);
});
