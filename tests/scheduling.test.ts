import { describe, it, expect } from "vitest";
import {
  cascade,
  moveTask,
  resizeTask,
  drawRange,
} from "@/lib/scheduling/cascade";
import { detectCycle } from "@/lib/scheduling/graph";
import {
  dateToX,
  xToDate,
  snapToDay,
  barGeometry,
  visibleRange,
} from "@/lib/scheduling/geometry";
import { addWholeDays, assertRange } from "@/lib/scheduling/dates";
import { ZOOMS } from "@/lib/scheduling/constants";
import type { Task, Dependency } from "@/lib/types";
const task = (id: string, start = "2026-03-06", end = "2026-03-08"): Task => ({
  id,
  projectId: "p",
  groupId: null,
  name: id,
  startDate: start,
  endDate: end,
  percentComplete: 0,
  color: null,
  sortOrder: 0,
  isMilestone: false,
  assigneeIds: [],
});
const dep = (a: string, b: string): Dependency => ({
  id: a + b,
  predecessorTaskId: a,
  successorTaskId: b,
  type: "finish_to_start",
});
describe("cascade", () => {
  it("pushes a chain, retaining duration and input immutability", () => {
    const tasks = [task("a"), task("b"), task("c")];
    const out = cascade(tasks, [dep("a", "b"), dep("b", "c")]);
    expect(out.map((t) => t.startDate)).toEqual([
      "2026-03-06",
      "2026-03-09",
      "2026-03-12",
    ]);
    expect(out[2].endDate).toBe("2026-03-14");
    expect(tasks[1].startDate).toBe("2026-03-06");
  });
  it("uses the latest predecessor and never pulls earlier", () => {
    expect(
      cascade(
        [task("a"), task("b", "2026-04-01", "2026-04-03"), task("c")],
        [dep("a", "c"), dep("b", "c")],
      )[2].startDate,
    ).toBe("2026-04-04");
    expect(
      cascade(
        [task("a"), task("b", "2026-05-01", "2026-05-03")],
        [dep("a", "b")],
      )[1].startDate,
    ).toBe("2026-05-01");
  });
  it("keeps unscheduled rows unscheduled and moves milestones as a single date", () => {
    const unscheduled = { ...task("u"), startDate: null, endDate: null },
      milestone = {
        ...task("m", "2026-03-07", "2026-03-07"),
        isMilestone: true,
      };
    const out = cascade(
      [task("a"), unscheduled, milestone],
      [dep("a", "u"), dep("a", "m")],
    );
    expect(out[1].startDate).toBeNull();
    expect(out[2].startDate).toBe("2026-03-09");
    expect(out[2].endDate).toBe("2026-03-09");
  });
  it("rejects cycles, self links and missing tasks", () => {
    expect(
      detectCycle([task("a"), task("b")], [dep("a", "b"), dep("b", "a")]),
    ).toBe(true);
    expect(detectCycle([task("a")], [dep("a", "a")])).toBe(true);
    expect(detectCycle([task("a")], [])).toBe(false);
    expect(() => cascade([task("a")], [dep("a", "missing")])).toThrow(
      "missing",
    );
  });
  it("handles 500 tasks without recursion", () => {
    const tasks = Array.from({ length: 500 }, (_, i) =>
      task(String(i), "2026-01-01", "2026-01-01"),
    );
    const deps = tasks.slice(1).map((t, i) => dep(String(i), t.id));
    expect(cascade(tasks, deps).at(-1)?.startDate).toBe(
      addWholeDays("2026-01-01", 499),
    );
  });
});
describe("geometry", () => {
  for (const zoom of Object.keys(ZOOMS) as (keyof typeof ZOOMS)[]) {
    it(`round-trips dates at ${zoom} zoom, including negatives and leap day`, () => {
      for (const date of ["2028-02-27", "2028-02-29", "2028-03-04"])
        expect(
          xToDate(dateToX(date, "2028-02-29", zoom), "2028-02-29", zoom),
        ).toBe(date);
      expect(snapToDay(ZOOMS[zoom] * 2.1, zoom)).toBe(2);
      expect(snapToDay(-ZOOMS[zoom] * 1.8, zoom)).toBe(-2);
    });
  }
  it("aligns bars to 48-pixel rows and clamps the virtual window", () => {
    expect(barGeometry(task("a"), 3, "2026-03-01", "week")?.centerY).toBe(168);
    expect(visibleRange(4800, 480, 500)).toEqual({ start: 94, end: 116 });
  });
});
describe("move, resize and date boundaries", () => {
  it("clamps both resize edges and refuses milestone resizing", () => {
    expect(resizeTask(task("a"), "start", 20).startDate).toBe("2026-03-08");
    expect(resizeTask(task("a"), "end", -20).endDate).toBe("2026-03-06");
    const m = { ...task("m", "2026-03-06", "2026-03-06"), isMilestone: true };
    expect(resizeTask(m, "end", 4)).toEqual(m);
  });
  it("preserves whole days across DST and year transitions", () => {
    expect(moveTask(task("a", "2026-03-07", "2026-03-09"), 1).endDate).toBe(
      "2026-03-10",
    );
    expect(addWholeDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("normalizes drawing backwards and validates date-only values", () => {
    expect(drawRange("2026-03-09", "2026-03-06", false)).toEqual({
      startDate: "2026-03-06",
      endDate: "2026-03-09",
    });
    expect(() => assertRange("2026-02-30", "2026-03-03")).toThrow();
    expect(() => assertRange("2026-03-06", null)).toThrow();
    expect(() => assertRange(null, null)).not.toThrow();
  });
});
