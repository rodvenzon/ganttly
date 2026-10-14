import { describe, it, expect } from "vitest";
import {
  cascade,
  moveTask,
  resizeTask,
  drawRange,
} from "@/lib/scheduling/cascade";
import {
  endAfter,
  nextWorkday,
  onWorkdays,
  previousWorkday,
  workdaysIn,
} from "@/lib/scheduling/calendar";
import { applyCommand } from "@/lib/api/apply-command";
import { demoProject } from "@/server/seed-data";
import { parseISO } from "date-fns";
import type { Task, Dependency } from "@/lib/types";
// October 2026: Fri 16, Sat 17, Sun 18, Mon 19 ... Fri 23, Sat 24, Sun 25, Mon 26
const WD = { skipWeekends: true },
  CAL = { skipWeekends: false };
const task = (id: string, start: string, end: string, milestone = false) =>
  ({
    id,
    projectId: "p",
    groupId: null,
    name: id,
    startDate: start,
    endDate: end,
    percentComplete: 0,
    color: null,
    sortOrder: 0,
    isMilestone: milestone,
    assigneeIds: [],
  }) satisfies Task;
const link = (a: string, b: string): Dependency => ({
  id: `${a}-${b}`,
  predecessorTaskId: a,
  successorTaskId: b,
  type: "finish_to_start",
});
const isWeekend = (d: string) => [0, 6].includes(parseISO(d).getDay());
describe("working-day calendar", () => {
  it("finds the nearest weekdays and counts only weekdays", () => {
    expect(nextWorkday("2026-10-17", WD)).toBe("2026-10-19");
    expect(previousWorkday("2026-10-18", WD)).toBe("2026-10-16");
    expect(nextWorkday("2026-10-17", CAL)).toBe("2026-10-17");
    expect(workdaysIn("2026-10-16", "2026-10-19", WD)).toBe(2);
    expect(workdaysIn("2026-10-16", "2026-10-19", CAL)).toBe(4);
    expect(endAfter("2026-10-15", 3, WD)).toBe("2026-10-19");
    expect(endAfter("2026-10-15", 3, CAL)).toBe("2026-10-17");
  });
  it("pulls ranges onto weekdays, and a weekend-only range to Monday", () => {
    expect(onWorkdays("2026-10-17", "2026-10-21", WD)).toEqual({
      startDate: "2026-10-19",
      endDate: "2026-10-21",
    });
    expect(onWorkdays("2026-10-14", "2026-10-18", WD)).toEqual({
      startDate: "2026-10-14",
      endDate: "2026-10-16",
    });
    expect(onWorkdays("2026-10-17", "2026-10-18", WD)).toEqual({
      startDate: "2026-10-19",
      endDate: "2026-10-19",
    });
    expect(onWorkdays("2026-10-17", "2026-10-17", WD, true)).toEqual({
      startDate: "2026-10-19",
      endDate: "2026-10-19",
    });
  });
});
describe("scheduling on working days", () => {
  it("starts a successor on the next weekday and keeps its weekday length", () => {
    // A ends Friday; B was 3 working days (Mon-Wed) starting too early.
    const [, b] = cascade(
      [
        task("a", "2026-10-12", "2026-10-16"),
        task("b", "2026-10-14", "2026-10-16"),
      ],
      [link("a", "b")],
      WD,
    );
    expect(b).toMatchObject({ startDate: "2026-10-19", endDate: "2026-10-21" });
    // Calendar days: the same plan starts B on Saturday.
    const [, c] = cascade(
      [
        task("a", "2026-10-12", "2026-10-16"),
        task("b", "2026-10-14", "2026-10-16"),
      ],
      [link("a", "b")],
      CAL,
    );
    expect(c.startDate).toBe("2026-10-17");
  });
  it("stretches over a weekend when a task is pushed into it", () => {
    // B is 3 working days; pushed to start Thursday it ends Monday.
    const [, b] = cascade(
      [
        task("a", "2026-10-12", "2026-10-14"),
        task("b", "2026-10-12", "2026-10-14"),
      ],
      [link("a", "b")],
      WD,
    );
    expect(b).toMatchObject({ startDate: "2026-10-15", endDate: "2026-10-19" });
  });
  it("moves a bar dropped on a weekend to Monday, keeping its length", () => {
    const t = task("t", "2026-10-12", "2026-10-14"); // Mon-Wed, 3 days
    expect(moveTask(t, 5, WD)).toMatchObject({
      startDate: "2026-10-19",
      endDate: "2026-10-21",
    });
    expect(moveTask(t, 3, WD)).toMatchObject({
      startDate: "2026-10-15",
      endDate: "2026-10-19",
    });
    expect(moveTask(t, 5, CAL)).toMatchObject({
      startDate: "2026-10-17",
      endDate: "2026-10-19",
    });
  });
  it("snaps resized edges and drawn ranges off the weekend", () => {
    const t = task("t", "2026-10-12", "2026-10-14");
    expect(resizeTask(t, "end", 4, WD).endDate).toBe("2026-10-16"); // Sun -> Fri
    expect(resizeTask(t, "end", 4, CAL).endDate).toBe("2026-10-18");
    expect(drawRange("2026-10-24", "2026-10-28", false, WD)).toEqual({
      startDate: "2026-10-26",
      endDate: "2026-10-28",
    });
    expect(drawRange("2026-10-25", "2026-10-20", true, WD)).toEqual({
      startDate: "2026-10-20",
      endDate: "2026-10-20",
    });
  });
});
describe("switching a project to working days", () => {
  it("keeps the sample plan entirely on weekdays", () => {
    const p = demoProject();
    expect(p.skipWeekends).toBe(true);
    for (const t of p.tasks.filter((t) => t.startDate)) {
      expect(isWeekend(t.startDate!)).toBe(false);
      expect(isWeekend(t.endDate!)).toBe(false);
    }
  });
  it("moves weekend dates onto weekdays when switched on, and leaves them when off", () => {
    const calendar = demoProject(40, { skipWeekends: false });
    expect(
      calendar.tasks.some(
        (t) => t.startDate && (isWeekend(t.startDate) || isWeekend(t.endDate!)),
      ),
    ).toBe(true);
    const ctx = { authorName: "Guest", now: new Date().toISOString() };
    const on = applyCommand(
      calendar,
      { type: "project.update", skipWeekends: true },
      ctx,
    );
    expect(on.skipWeekends).toBe(true);
    for (const t of on.tasks.filter((t) => t.startDate)) {
      expect(isWeekend(t.startDate!)).toBe(false);
      expect(isWeekend(t.endDate!)).toBe(false);
    }
    // Every link still holds.
    for (const d of on.dependencies) {
      const a = on.tasks.find((t) => t.id === d.predecessorTaskId)!,
        b = on.tasks.find((t) => t.id === d.successorTaskId)!;
      if (a.endDate && b.startDate) expect(b.startDate > a.endDate).toBe(true);
    }
    const off = applyCommand(
      on,
      { type: "project.update", skipWeekends: false },
      ctx,
    );
    expect(off.skipWeekends).toBe(false);
    expect(off.tasks).toEqual(on.tasks);
  });
  it("lets a task typed onto a weekend land on the next weekday", () => {
    const p = demoProject();
    const t = p.tasks.find((t) => t.id === "task-0")!; // no predecessors
    const after = applyCommand(
      p,
      {
        type: "task.update",
        id: t.id,
        patch: { startDate: "2026-10-17", endDate: "2026-10-18" },
      },
      { authorName: "Guest", now: new Date().toISOString() },
    );
    const moved = after.tasks.find((x) => x.id === t.id)!;
    expect(moved.startDate).toBe("2026-10-19");
  });
});
