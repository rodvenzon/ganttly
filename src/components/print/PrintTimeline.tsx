"use client";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import type { ProjectDetail, Task, TaskGroup } from "@/lib/types";
import { colorClasses } from "@/lib/colors";
import { addWholeDays, daysBetween, today } from "@/lib/scheduling/dates";
import { workdaysIn, calendarOf } from "@/lib/scheduling/calendar";
/*
 * The printed plan. Hidden on screen; when printing it replaces the app.
 * Every task is shown (collapsed phases too), the whole date range is
 * scaled to the page width, and rows are split into landscape pages that
 * each repeat the date header.
 */
const PAGE_W = 1040, // ~A4 landscape at 10 mm margins, in CSS px
  NAME_W = 236,
  DATE_W = 54,
  DAYS_W = 34,
  CHART_X = NAME_W + DATE_W * 2 + DAYS_W,
  CHART_W = PAGE_W - CHART_X,
  HEAD_H = 40,
  ROW_H = 20,
  FIRST_PAGE_ROWS = 25, // leaves room for the title block
  ROWS_PER_PAGE = 30;
type PrintRow =
  | { kind: "group"; group: TaskGroup; start?: string; end?: string }
  | { kind: "task"; task: Task };
function rowsOf(p: ProjectDetail): PrintRow[] {
  const rows: PrintRow[] = [];
  const sorted = (tasks: Task[]) =>
    [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const group of [...p.groups].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const tasks = sorted(p.tasks.filter((t) => t.groupId === group.id));
    const dated = tasks.filter((t) => t.startDate && t.endDate);
    rows.push({
      kind: "group",
      group,
      start: dated.map((t) => t.startDate!).sort()[0],
      end: dated
        .map((t) => t.endDate!)
        .sort()
        .at(-1),
    });
    for (const task of tasks) rows.push({ kind: "task", task });
  }
  for (const task of sorted(p.tasks.filter((t) => !t.groupId)))
    rows.push({ kind: "task", task });
  return rows;
}
function rangeOf(p: ProjectDetail) {
  const dates = p.tasks.flatMap((t) =>
    t.startDate && t.endDate ? [t.startDate, t.endDate] : [],
  );
  const first = dates.length ? dates.sort()[0] : today();
  const last = dates.length ? dates.at(-1)! : addWholeDays(today(), 27);
  const origin = format(
    startOfWeek(parseISO(first), { weekStartsOn: 1 }),
    "yyyy-MM-dd",
  );
  const end = format(
    addDays(startOfWeek(parseISO(last), { weekStartsOn: 1 }), 6),
    "yyyy-MM-dd",
  );
  return { origin, days: daysBetween(end, origin) + 1 };
}
const fit = (text: string, px: number, charPx = 5.6) => {
  const max = Math.floor(px / charPx);
  return text.length > max ? text.slice(0, Math.max(1, max - 1)) + "…" : text;
};
const short = (d: string | null) => (d ? format(parseISO(d), "d MMM") : "—");
export function PrintTimeline({ project }: { project: ProjectDetail }) {
  const rows = rowsOf(project),
    { origin, days } = rangeOf(project),
    dayW = CHART_W / days,
    cal = calendarOf(project),
    x = (date: string) => CHART_X + daysBetween(date, origin) * dayW,
    now = today(),
    pages: PrintRow[][] = [];
  for (let i = 0; i < rows.length;) {
    const size = pages.length ? ROWS_PER_PAGE : FIRST_PAGE_ROWS;
    pages.push(rows.slice(i, i + size));
    i += size;
  }
  if (!pages.length) pages.push([]);
  const dates = Array.from({ length: days }, (_, i) => addWholeDays(origin, i));
  const done = project.tasks.filter((t) => t.percentComplete === 100).length;
  return (
    <div className="print-timeline hidden text-brand-ink print:block">
      {pages.map((page, n) => {
        const height = HEAD_H + page.length * ROW_H + 1;
        return (
          <section key={n} className="print-page">
            {n === 0 && (
              <header className="mb-3 flex items-end justify-between gap-6 border-b border-brand-line pb-2">
                <div>
                  <h1 className="text-xl font-semibold leading-tight">
                    {project.name}
                  </h1>
                  <p className="mt-0.5 text-[10px] text-brand-muted">
                    {short(origin)} – {short(addWholeDays(origin, days - 1))}{" "}
                    {format(parseISO(addWholeDays(origin, days - 1)), "yyyy")} ·{" "}
                    {project.tasks.length} tasks · {done} complete ·{" "}
                    {project.skipWeekends
                      ? "Working days (weekends skipped)"
                      : "Calendar days"}
                  </p>
                </div>
                <p className="text-right text-[10px] text-brand-muted">
                  Printed {format(new Date(), "d MMM yyyy")}
                  <br />
                  Ganttly
                </p>
              </header>
            )}
            <svg
              viewBox={`0 0 ${PAGE_W} ${height}`}
              width="100%"
              className="block"
              style={{ fontFamily: "Inter, ui-sans-serif, system-ui" }}
            >
              {/* Weekends and month/week grid */}
              {dates.map((d) => {
                const day = parseISO(d).getDay(),
                  left = x(d);
                return (
                  <g key={d}>
                    {(day === 0 || day === 6) && dayW >= 3 && (
                      <rect
                        x={left}
                        y={HEAD_H}
                        width={dayW}
                        height={height - HEAD_H}
                        className="fill-brand-offwhite"
                      />
                    )}
                    {day === 1 && (
                      <line
                        x1={left}
                        x2={left}
                        y1={20}
                        y2={height}
                        className="stroke-brand-line"
                        strokeWidth={0.6}
                      />
                    )}
                  </g>
                );
              })}
              {/* Header: months on top, week starts below */}
              <rect
                width={PAGE_W}
                height={HEAD_H}
                className="fill-brand-stone"
              />
              {dates
                .filter((d, i) => i === 0 || d.endsWith("-01"))
                .map((d) => (
                  <text
                    key={"m" + d}
                    x={x(d) + 3}
                    y={14}
                    fontSize={10}
                    fontWeight={600}
                    className="fill-brand-ink"
                  >
                    {format(parseISO(d), "MMM yyyy")}
                  </text>
                ))}
              {dates
                .filter((d) => parseISO(d).getDay() === 1)
                .map((d) =>
                  dayW * 7 >= 22 ? (
                    <text
                      key={"w" + d}
                      x={x(d) + 2}
                      y={33}
                      fontSize={8.5}
                      className="fill-brand-muted"
                    >
                      {format(parseISO(d), "d")}
                    </text>
                  ) : null,
                )}
              {[
                ["Task", 8],
                ["Start", NAME_W + 4],
                ["End", NAME_W + DATE_W + 4],
                ["Days", NAME_W + DATE_W * 2 + 4],
              ].map(([label, lx]) => (
                <text
                  key={label}
                  x={lx}
                  y={33}
                  fontSize={8.5}
                  fontWeight={600}
                  className="fill-brand-muted"
                >
                  {String(label).toUpperCase()}
                </text>
              ))}
              {now >= origin && now <= addWholeDays(origin, days - 1) && (
                <line
                  x1={x(now) + dayW / 2}
                  x2={x(now) + dayW / 2}
                  y1={HEAD_H}
                  y2={height}
                  className="stroke-brand-accent"
                  strokeWidth={1}
                  strokeDasharray="3 2"
                />
              )}
              {/* Rows */}
              {page.map((row, i) => {
                const y = HEAD_H + i * ROW_H;
                if (row.kind === "group")
                  return (
                    <g key={row.group.id}>
                      <rect
                        y={y}
                        width={PAGE_W}
                        height={ROW_H}
                        className="fill-brand-stone"
                        opacity={0.85}
                      />
                      <text
                        x={8}
                        y={y + 13.5}
                        fontSize={10}
                        fontWeight={600}
                        className="fill-brand-ink"
                      >
                        {fit(row.group.name, NAME_W + DATE_W * 2 - 12, 6.2)}
                      </text>
                      {row.start && row.end && (
                        <rect
                          x={x(row.start)}
                          y={y + 8}
                          width={Math.max(
                            2,
                            x(addWholeDays(row.end, 1)) - x(row.start),
                          )}
                          height={4}
                          rx={2}
                          className="fill-brand-ink"
                          opacity={0.55}
                        />
                      )}
                      <line
                        x2={PAGE_W}
                        y1={y + ROW_H}
                        y2={y + ROW_H}
                        className="stroke-brand-line"
                        strokeWidth={0.6}
                      />
                    </g>
                  );
                const t = row.task,
                  color = colorClasses[t.color ?? project.color];
                return (
                  <g key={t.id}>
                    <text
                      x={18}
                      y={y + 13.5}
                      fontSize={9.5}
                      className="fill-brand-ink"
                    >
                      {t.isMilestone ? "◆ " : ""}
                      {fit(t.name, NAME_W - 24)}
                    </text>
                    {[
                      [short(t.startDate), NAME_W + 4],
                      [
                        short(t.isMilestone ? null : t.endDate),
                        NAME_W + DATE_W + 4,
                      ],
                      [
                        t.startDate && t.endDate && !t.isMilestone
                          ? String(workdaysIn(t.startDate, t.endDate, cal))
                          : "",
                        NAME_W + DATE_W * 2 + 4,
                      ],
                    ].map(([label, lx], k) => (
                      <text
                        key={k}
                        x={lx}
                        y={y + 13.5}
                        fontSize={9}
                        className="fill-brand-muted"
                      >
                        {label}
                      </text>
                    ))}
                    {t.startDate &&
                      t.endDate &&
                      (t.isMilestone ? (
                        <rect
                          x={x(t.startDate) + dayW / 2 - 4.5}
                          y={y + 5.5}
                          width={9}
                          height={9}
                          transform={`rotate(45 ${x(t.startDate) + dayW / 2} ${y + 10})`}
                          className={color}
                          strokeWidth={1}
                        />
                      ) : (
                        <g>
                          <rect
                            x={x(t.startDate) + 0.5}
                            y={y + 4}
                            width={Math.max(
                              2,
                              x(addWholeDays(t.endDate, 1)) -
                                x(t.startDate) -
                                1,
                            )}
                            height={12}
                            rx={3}
                            className={color}
                            strokeWidth={0.8}
                          />
                          {t.percentComplete > 0 && (
                            <rect
                              x={x(t.startDate) + 0.5}
                              y={y + 13}
                              width={
                                Math.max(
                                  2,
                                  x(addWholeDays(t.endDate, 1)) -
                                    x(t.startDate) -
                                    1,
                                ) *
                                (t.percentComplete / 100)
                              }
                              height={3}
                              className="fill-brand-ink"
                              opacity={0.45}
                            />
                          )}
                        </g>
                      ))}
                    <line
                      x2={PAGE_W}
                      y1={y + ROW_H}
                      y2={y + ROW_H}
                      className="stroke-brand-line"
                      strokeWidth={0.4}
                    />
                  </g>
                );
              })}
              <line
                x1={CHART_X}
                x2={CHART_X}
                y2={height}
                className="stroke-brand-line"
              />
            </svg>
            <p className="mt-1 text-right text-[9px] text-brand-muted">
              Page {n + 1} of {pages.length}
            </p>
          </section>
        );
      })}
    </div>
  );
}
