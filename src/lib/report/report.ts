import { workdaysIn } from "@/lib/scheduling/calendar";
import ExcelJS from "exceljs";
import type { Assignee, ProjectDetail, Task } from "@/lib/types";
/**
 * Builds the Excel report for one project or for several (the "All
 * projects" report). Sheets: Summary (live formulas over the Tasks sheet),
 * Tasks and Comments. Formulas carry their computed result too, so
 * previewers that don't recalculate still show the right numbers.
 */
export type ReportInput = {
  projects: ProjectDetail[];
  /** Report title: the project name, or "All projects". */
  title: string;
  generatedBy: string;
  /** yyyy-mm-dd in the viewer's local time; statuses are as of this day. */
  today: string;
  timeZone?: string;
};
export const STATUSES = [
  "Done",
  "In progress",
  "Not started",
  "Overdue",
  "Unscheduled",
] as const;
export type Status = (typeof STATUSES)[number];
export function taskStatus(t: Task, today: string): Status {
  if (t.percentComplete >= 100) return "Done";
  if (!t.startDate || !t.endDate) return "Unscheduled";
  if (t.endDate < today) return "Overdue";
  if (t.startDate <= today || t.percentComplete > 0) return "In progress";
  return "Not started";
}
const FONT = "Arial";
const GOLD = "FFE2CD97",
  INK = "FF1E1E1E",
  MUTED = "FF7A7268",
  LINE = "FFE4DED4";
const STATUS_FILL: Record<Status, string> = {
  Done: "FFDCEBD9",
  "In progress": "FFF3E8C8",
  "Not started": "FFFFFFFF",
  Overdue: "FFF6D5D0",
  Unscheduled: "FFEFEDE8",
};
const dateOnly = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const pretty = (iso: string) =>
  dateOnly(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
/** A timestamp as wall-clock time in `timeZone`, for an Excel date cell. */
function localDateTime(iso: string, timeZone?: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return new Date(
    Date.UTC(
      +parts.year,
      +parts.month - 1,
      +parts.day,
      +parts.hour,
      +parts.minute,
    ),
  );
}
const DAY = 86400000;
type Row = {
  project: string;
  phase: string;
  task: Task;
  status: Status;
  assignees: string[];
  dependsOn: string[];
  comments: number;
  skipWeekends: boolean;
};
function collect(projects: ProjectDetail[], today: string) {
  const rows: Row[] = [];
  const people = new Map<string, Assignee>();
  for (const p of projects) {
    for (const a of p.assignees) people.set(a.id, a);
    const groupOrder = new Map(p.groups.map((g, i) => [g.id, i]));
    const groupName = new Map(p.groups.map((g) => [g.id, g.name]));
    const names = new Map(p.tasks.map((t) => [t.id, t.name]));
    const tasks = [...p.tasks].sort(
      (a, b) =>
        (groupOrder.get(a.groupId ?? "") ?? 1e9) -
          (groupOrder.get(b.groupId ?? "") ?? 1e9) || a.sortOrder - b.sortOrder,
    );
    for (const t of tasks)
      rows.push({
        project: p.name,
        phase: (t.groupId && groupName.get(t.groupId)) || "No phase",
        task: t,
        status: taskStatus(t, today),
        assignees: t.assigneeIds
          .map((id) => p.assignees.find((a) => a.id === id)?.name)
          .filter((n): n is string => Boolean(n)),
        dependsOn: p.dependencies
          .filter((d) => d.successorTaskId === t.id)
          .map((d) => names.get(d.predecessorTaskId) ?? "")
          .filter(Boolean),
        comments: p.comments.filter((c) => c.taskId === t.id).length,
        skipWeekends: Boolean(p.skipWeekends),
      });
  }
  return { rows, people: [...people.values()] };
}
export async function buildReport(input: ReportInput): Promise<ArrayBuffer> {
  const { projects, today, timeZone } = input;
  const portfolio = projects.length !== 1;
  const { rows, people } = collect(projects, today);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Ganttly";
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;
  const summary = wb.addWorksheet("Summary", {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });
  const tasks = wb.addWorksheet("Tasks", {
    views: [{ state: "frozen", ySplit: 1 }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });
  const notes = wb.addWorksheet("Comments", {
    views: [{ state: "frozen", ySplit: 1 }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });
  // ---------- Tasks ----------
  const cols = [
    ...(portfolio ? [{ key: "project", header: "Project", width: 26 }] : []),
    { key: "phase", header: "Phase", width: 24 },
    { key: "task", header: "Task", width: 36 },
    { key: "type", header: "Type", width: 11 },
    { key: "start", header: "Start", width: 13 },
    { key: "end", header: "End", width: 13 },
    { key: "days", header: "Days", width: 7 },
    { key: "progress", header: "Progress", width: 10 },
    { key: "status", header: "Status", width: 14 },
    { key: "assignees", header: "Assignees", width: 30 },
    { key: "depends", header: "Depends on", width: 30 },
    { key: "comments", header: "Comments", width: 11 },
  ];
  tasks.columns = cols.map((c) => ({
    key: c.key,
    header: c.header,
    width: c.width,
  }));
  const L = Object.fromEntries(
    cols.map((c, i) => [c.key, String.fromCharCode(65 + i)]),
  ) as Record<string, string>;
  rows.forEach((r, i) => {
    const n = i + 2,
      t = r.task;
    const row = tasks.addRow({
      project: r.project,
      phase: r.phase,
      task: t.name,
      type: t.isMilestone ? "Milestone" : "Task",
      start: t.startDate ? dateOnly(t.startDate) : null,
      end: t.endDate ? dateOnly(t.endDate) : null,
      days:
        t.startDate && t.endDate
          ? r.skipWeekends
            ? {
                formula: `NETWORKDAYS(${L.start}${n},${L.end}${n})`,
                result: workdaysIn(t.startDate, t.endDate, {
                  skipWeekends: true,
                }),
              }
            : {
                formula: `${L.end}${n}-${L.start}${n}+1`,
                result:
                  (dateOnly(t.endDate).getTime() -
                    dateOnly(t.startDate).getTime()) /
                    DAY +
                  1,
              }
          : null,
      progress: t.percentComplete / 100,
      status: r.status,
      assignees: r.assignees.join(", "),
      depends: r.dependsOn.join(", "),
      comments: r.comments,
    });
    row.getCell("status").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: STATUS_FILL[r.status] },
    };
  });
  const last = Math.max(2, rows.length + 1);
  const range = (key: string) => `Tasks!$${L[key]}$2:$${L[key]}$${last}`;
  tasks.getColumn("start").numFmt = "dd mmm yyyy";
  tasks.getColumn("end").numFmt = "dd mmm yyyy";
  tasks.getColumn("progress").numFmt = "0%";
  tasks.autoFilter = {
    from: "A1",
    to: `${String.fromCharCode(64 + cols.length)}1`,
  };
  tasks.pageSetup.printTitlesRow = "1:1";
  styleTable(
    tasks,
    cols.length,
    ["task", "assignees", "depends", "phase", "project"]
      .filter((k) => L[k])
      .map((k) => L[k]),
    ["start", "end", "days", "progress", "comments"].map((k) => L[k]),
    [L.status],
  );
  // ---------- Comments ----------
  const noteCols = [
    ...(portfolio ? [{ key: "project", header: "Project", width: 26 }] : []),
    { key: "task", header: "Task", width: 34 },
    { key: "author", header: "Author", width: 22 },
    { key: "date", header: "Date", width: 18 },
    { key: "body", header: "Comment", width: 70 },
  ];
  notes.columns = noteCols.map((c) => ({
    key: c.key,
    header: c.header,
    width: c.width,
  }));
  for (const p of projects) {
    const names = new Map(p.tasks.map((t) => [t.id, t.name]));
    for (const c of [...p.comments].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    ))
      notes.addRow({
        project: p.name,
        task: names.get(c.taskId) ?? "",
        author: c.authorName,
        date: localDateTime(c.createdAt, timeZone),
        body: c.body,
      });
  }
  notes.getColumn("date").numFmt = "dd mmm yyyy hh:mm";
  notes.pageSetup.printTitlesRow = "1:1";
  styleTable(
    notes,
    noteCols.length,
    noteCols.flatMap((c, i) =>
      ["task", "body", "project"].includes(c.key)
        ? [String.fromCharCode(65 + i)]
        : [],
    ),
  );
  // ---------- Summary ----------
  summary.columns = [
    { width: 34 },
    { width: 20 },
    { width: 11 },
    { width: 11 },
    { width: 13 },
    { width: 14 },
    { width: 14 },
  ];
  const put = (
    ref: string,
    value: ExcelJS.CellValue,
    font: Partial<ExcelJS.Font> = {},
  ) => {
    const c = summary.getCell(ref);
    c.value = value;
    c.font = { name: FONT, size: 10, color: { argb: INK }, ...font };
    return c;
  };
  put("A1", "GANTTLY  ·  PROJECT REPORT", {
    size: 9,
    bold: true,
    color: { argb: MUTED },
  });
  put("A2", input.title, { size: 18, bold: true });
  summary.getRow(2).height = 28;
  put(
    "A3",
    `Generated ${pretty(today)} by ${input.generatedBy}. Statuses are as of this date.`,
    { size: 9, color: { argb: MUTED } },
  );
  const count = (s: Status) => rows.filter((r) => r.status === s).length;
  const starts = rows
    .map((r) => r.task.startDate)
    .filter((d): d is string => !!d)
    .sort();
  const ends = rows
    .map((r) => r.task.endDate)
    .filter((d): d is string => !!d)
    .sort();
  const avg = rows.length
    ? rows.reduce((s, r) => s + r.task.percentComplete, 0) / rows.length / 100
    : 0;
  section(summary, 5, "KEY FIGURES", 2);
  const figures: [string, ExcelJS.CellValue, string?][] = [
    [
      portfolio ? "Projects" : "Phases",
      portfolio ? projects.length : projects[0].groups.length,
    ],
    [
      "Tasks and milestones",
      { formula: `COUNTA(${range("task")})`, result: rows.length },
    ],
    [
      "Milestones",
      {
        formula: `COUNTIF(${range("type")},"Milestone")`,
        result: rows.filter((r) => r.task.isMilestone).length,
      },
    ],
    ...STATUSES.map((s): [string, ExcelJS.CellValue] => [
      s,
      { formula: `COUNTIF(${range("status")},"${s}")`, result: count(s) },
    ]),
    [
      "Average progress",
      { formula: `IFERROR(AVERAGE(${range("progress")}),0)`, result: avg },
      "0%",
    ],
    [
      "Starts",
      {
        formula: `IF(COUNT(${range("start")})=0,"",MIN(${range("start")}))`,
        result: starts[0] ? dateOnly(starts[0]) : "",
      },
      "dd mmm yyyy",
    ],
    [
      "Ends",
      {
        formula: `IF(COUNT(${range("end")})=0,"",MAX(${range("end")}))`,
        result: ends.at(-1) ? dateOnly(ends.at(-1)!) : "",
      },
      "dd mmm yyyy",
    ],
  ];
  let r = 6;
  for (const [label, value, fmt] of figures) {
    put(`A${r}`, label);
    const c = put(`B${r}`, value, { bold: true });
    c.alignment = { horizontal: "left" };
    if (fmt) c.numFmt = fmt;
    if (STATUSES.includes(label as Status) && label !== "Not started")
      put(`A${r}`, label).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: STATUS_FILL[label as Status] },
      };
    underline(summary, r, 2);
    r++;
  }
  // By phase (one project) or by project (all projects)
  r += 1;
  const groupKey = portfolio ? "project" : "phase";
  const groups = [
    ...new Set(rows.map((x) => (portfolio ? x.project : x.phase))),
  ];
  if (portfolio)
    for (const p of projects) if (!groups.includes(p.name)) groups.push(p.name);
  section(summary, r, portfolio ? "BY PROJECT" : "BY PHASE", 7);
  r++;
  header(
    summary,
    r,
    [
      portfolio ? "Project" : "Phase",
      "Items",
      "Done",
      "Overdue",
      "Avg progress",
      "Start",
      "End",
    ],
    [2, 3, 4, 5, 6, 7],
  );
  r++;
  for (const g of groups) {
    const mine = rows.filter((x) => (portfolio ? x.project : x.phase) === g);
    const k = `$A${r}`,
      gr = range(groupKey);
    const s = mine
      .map((x) => x.task.startDate)
      .filter((d): d is string => !!d)
      .sort();
    const e = mine
      .map((x) => x.task.endDate)
      .filter((d): d is string => !!d)
      .sort();
    put(`A${r}`, g);
    put(`B${r}`, { formula: `COUNTIF(${gr},${k})`, result: mine.length });
    put(`C${r}`, {
      formula: `COUNTIFS(${gr},${k},${range("status")},"Done")`,
      result: mine.filter((x) => x.status === "Done").length,
    });
    put(`D${r}`, {
      formula: `COUNTIFS(${gr},${k},${range("status")},"Overdue")`,
      result: mine.filter((x) => x.status === "Overdue").length,
    });
    put(`E${r}`, {
      formula: `IFERROR(AVERAGEIF(${gr},${k},${range("progress")}),0)`,
      result: mine.length
        ? mine.reduce((a, x) => a + x.task.percentComplete, 0) /
          mine.length /
          100
        : 0,
    }).numFmt = "0%";
    put(`F${r}`, {
      formula: `IF(COUNTIFS(${gr},${k},${range("start")},"<>")=0,"",_xlfn.MINIFS(${range("start")},${gr},${k}))`,
      result: s[0] ? dateOnly(s[0]) : "",
    }).numFmt = "dd mmm yyyy";
    put(`G${r}`, {
      formula: `IF(COUNTIFS(${gr},${k},${range("end")},"<>")=0,"",_xlfn.MAXIFS(${range("end")},${gr},${k}))`,
      result: e.at(-1) ? dateOnly(e.at(-1)!) : "",
    }).numFmt = "dd mmm yyyy";
    underline(summary, r, 7);
    r++;
  }
  // By person: everyone with work, plus active people with none
  r += 1;
  section(summary, r, "BY PERSON", 5);
  r++;
  header(
    summary,
    r,
    ["Person", "Title", "Assigned", "Done", "Overdue"],
    [3, 4, 5],
  );
  r++;
  const shown = people
    .filter((p) => p.active || rows.some((x) => x.assignees.includes(p.name)))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const p of shown) {
    const mine = rows.filter((x) => x.assignees.includes(p.name));
    const k = `"*"&$A${r}&"*"`;
    put(`A${r}`, p.name);
    put(`B${r}`, p.title, { color: { argb: MUTED } });
    put(`C${r}`, {
      formula: `COUNTIF(${range("assignees")},${k})`,
      result: mine.length,
    });
    put(`D${r}`, {
      formula: `COUNTIFS(${range("assignees")},${k},${range("status")},"Done")`,
      result: mine.filter((x) => x.status === "Done").length,
    });
    put(`E${r}`, {
      formula: `COUNTIFS(${range("assignees")},${k},${range("status")},"Overdue")`,
      result: mine.filter((x) => x.status === "Overdue").length,
    });
    underline(summary, r, 5);
    r++;
  }
  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}
/** A gold header row; columns in `right` (1-based) are numbers, right-aligned. */
function header(
  ws: ExcelJS.Worksheet,
  r: number,
  labels: string[],
  right: number[] = [],
) {
  labels.forEach((label, i) => {
    const c = ws.getRow(r).getCell(i + 1);
    c.value = label;
    c.font = { name: FONT, size: 10, bold: true, color: { argb: INK } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GOLD } };
    c.alignment = {
      vertical: "middle",
      horizontal: right.includes(i + 1) ? "right" : "left",
    };
  });
  ws.getRow(r).height = 20;
}
function section(
  ws: ExcelJS.Worksheet,
  r: number,
  label: string,
  span: number,
) {
  const c = ws.getCell(`A${r}`);
  c.value = label;
  c.font = { name: FONT, size: 9, bold: true, color: { argb: MUTED } };
  for (let i = 1; i <= span; i++)
    ws.getRow(r).getCell(i).border = {
      bottom: { style: "medium", color: { argb: GOLD } },
    };
}
function underline(ws: ExcelJS.Worksheet, r: number, span: number) {
  for (let i = 1; i <= span; i++)
    ws.getRow(r).getCell(i).border = {
      bottom: { style: "thin", color: { argb: LINE } },
    };
}
/**
 * Header row in the accent colour, Arial throughout. Long-text columns wrap,
 * number and date columns align right (header too), and `indentCols` get
 * a little padding so neighbouring values never touch.
 */
function styleTable(
  ws: ExcelJS.Worksheet,
  width: number,
  wrapCols: string[],
  rightCols: string[] = [],
  indentCols: string[] = [],
) {
  ws.eachRow((row, n) => {
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      if (col > width) return;
      const letter = String.fromCharCode(64 + col);
      cell.font = { name: FONT, size: 10, bold: n === 1, color: { argb: INK } };
      cell.alignment = {
        vertical: n === 1 ? "middle" : "top",
        wrapText: n > 1 && wrapCols.includes(letter),
        horizontal: rightCols.includes(letter) ? "right" : "left",
        indent: indentCols.includes(letter) ? 1 : 0,
      };
      cell.border = { bottom: { style: "thin", color: { argb: LINE } } };
      if (n === 1)
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: GOLD },
        };
    });
  });
  ws.getRow(1).height = 22;
}
/** "Ganttly Report - Website relaunch - 2026-10-14.xlsx" */
export function reportFileName(title: string, today: string) {
  const safe = title
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `Ganttly Report - ${safe} - ${today}.xlsx`;
}
