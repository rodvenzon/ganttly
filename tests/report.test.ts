import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { writeFileSync } from "node:fs";
import { buildReport, reportFileName, taskStatus } from "@/lib/report/report";
import { demoProject } from "@/server/seed-data";
import type { Task } from "@/lib/types";
const today = "2026-10-14";
const load = async (buf: ArrayBuffer) => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb;
};
describe("Excel report", () => {
  it("classifies task status as of today", () => {
    const t = (p: Partial<Task>): Task => ({
      id: "x",
      projectId: "p",
      groupId: null,
      name: "x",
      startDate: "2026-10-10",
      endDate: "2026-10-20",
      percentComplete: 0,
      color: null,
      sortOrder: 0,
      isMilestone: false,
      assigneeIds: [],
      ...p,
    });
    expect(
      taskStatus(t({ percentComplete: 100, endDate: "2026-01-01" }), today),
    ).toBe("Done");
    expect(taskStatus(t({ startDate: null, endDate: null }), today)).toBe(
      "Unscheduled",
    );
    expect(taskStatus(t({ endDate: "2026-10-13" }), today)).toBe("Overdue");
    expect(taskStatus(t({}), today)).toBe("In progress");
    expect(
      taskStatus(t({ startDate: "2026-11-01", endDate: "2026-11-05" }), today),
    ).toBe("Not started");
  });
  it("builds a one-project report with summary, tasks and comments", async () => {
    const p = demoProject();
    const buf = await buildReport({
      projects: [p],
      title: p.name,
      generatedBy: "Alex Morgan",
      today,
      timeZone: "Asia/Dubai",
    });
    writeFileSync("/tmp/claude-0/rep/one.xlsx", Buffer.from(buf));
    const wb = await load(buf);
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      "Summary",
      "Tasks",
      "Comments",
    ]);
    const tasks = wb.getWorksheet("Tasks")!;
    expect(tasks.getRow(1).values).toContain("Phase");
    expect(tasks.getRow(1).values).not.toContain("Project");
    expect(tasks.rowCount).toBe(41);
    const first = tasks.getRow(2);
    expect(first.getCell(1).value).toBe("Discovery & strategy");
    expect(first.getCell(4).value).toBeInstanceOf(Date);
    const summary = wb.getWorksheet("Summary")!;
    expect(summary.getCell("A2").value).toBe("Website relaunch");
    const total = summary.getCell("B7").value as {
      formula: string;
      result: number;
    };
    expect(total.formula).toMatch(/^COUNTA\(Tasks!\$B\$2:\$B\$41\)$/);
    expect(total.result).toBe(40);
    expect(wb.getWorksheet("Comments")!.rowCount).toBe(2);
  });
  it("builds an all-projects report with a Project column", async () => {
    const a = demoProject(),
      b = {
        ...demoProject(),
        id: "b",
        name: "Second plan",
        tasks: [],
        dependencies: [],
        comments: [],
      };
    const buf = await buildReport({
      projects: [a, b],
      title: "All projects",
      generatedBy: "Alex Morgan",
      today,
    });
    writeFileSync("/tmp/claude-0/rep/all.xlsx", Buffer.from(buf));
    const wb = await load(buf);
    expect(wb.getWorksheet("Tasks")!.getRow(1).getCell(1).value).toBe(
      "Project",
    );
    const summary = wb.getWorksheet("Summary")!;
    const names: unknown[] = [];
    summary.eachRow((row) => names.push(row.getCell(1).value));
    expect(names).toContain("Second plan");
    expect(names).toContain("BY PROJECT");
  });
  it("handles an empty project and makes a safe file name", async () => {
    const empty = {
      ...demoProject(),
      name: "Empty",
      tasks: [],
      dependencies: [],
      comments: [],
    };
    const buf = await buildReport({
      projects: [empty],
      title: "Empty",
      generatedBy: "R",
      today,
    });
    writeFileSync("/tmp/claude-0/rep/empty.xlsx", Buffer.from(buf));
    expect((await load(buf)).getWorksheet("Tasks")!.rowCount).toBe(1);
    expect(reportFileName("Agent Briefing / Schedule", today)).toBe(
      "Ganttly Report - Agent Briefing Schedule - 2026-10-14.xlsx",
    );
  });
});
