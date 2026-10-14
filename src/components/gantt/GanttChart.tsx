"use client";
import { DependencyLayer } from "./DependencyLayer";
import { useMemo } from "react";
import { DndContext, DragOverlay, closestCenter } from "@dnd-kit/core";
import type { ProjectDetail } from "@/lib/types";
import { useUI } from "@/store/ui";
import { projectRows, projectRange } from "./model";
import { ZOOMS, ROW_HEIGHT } from "@/lib/scheduling/constants";
import { TimelineHeader } from "./TimelineHeader";
import { TimelineGrid } from "./TimelineGrid";
import { TaskBar } from "./TaskBar";
import { ListHeader, TaskListPane } from "./TaskListPane";
import { useRowVirtualizer } from "./RowVirtualizer";
import { useChartDrag } from "./useChartDrag";
import { UnscheduledRow } from "./UnscheduledRow";
export function GanttChart({ project }: { project: ProjectDetail }) {
  const { zoom, collapsed, selectTask, preview } = useUI();
  const shown = useMemo(
    () => (preview ? { ...project, tasks: preview } : project),
    [project, preview],
  );
  const rows = useMemo(() => projectRows(shown, collapsed), [shown, collapsed]);
  const { origin, days } = useMemo(() => projectRange(project), [project]);
  const { ref, onScroll, range, listWidth, first, last } = useRowVirtualizer(
    rows.length,
    days,
    zoom,
  );
  const drag = useChartDrag(project, zoom);
  const width = days * ZOOMS[zoom],
    height = Math.max(ROW_HEIGHT, rows.length * ROW_HEIGHT),
    visible = rows.slice(range.start, range.end);
  const unscheduled = useMemo(
    () => new Set(project.tasks.filter((t) => !t.startDate).map((t) => t.id)),
    [project.tasks],
  );
  return (
    <DndContext
      sensors={drag.sensors}
      collisionDetection={closestCenter}
      // No horizontal auto-scroll: dnd-kit adds the scrolled distance to
      // event.delta.x, so a bar dragged near the right edge kept scrolling
      // the timeline and jumped weeks ahead. Vertical auto-scroll stays for
      // reordering rows in long plans.
      autoScroll={{ threshold: { x: 0, y: 0.15 } }}
      onDragStart={drag.onDragStart}
      onDragMove={drag.onDragMove}
      onDragEnd={drag.onDragEnd}
      onDragCancel={drag.onDragCancel}
    >
      <div
        ref={ref}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-auto rounded-lg border border-brand-line bg-white"
        aria-label="Project timeline"
      >
        <div style={{ width: listWidth + width }}>
          <div className="sticky top-0 z-30 flex">
            <ListHeader width={listWidth} />
            <div style={{ width }}>
              <TimelineHeader
                origin={origin}
                zoom={zoom}
                first={first}
                last={last}
              />
            </div>
          </div>
          <div className="relative" style={{ height }}>
            <TaskListPane
              rows={visible}
              offset={range.start}
              width={listWidth}
              height={height}
              project={shown}
            />
            <div
              className="absolute top-0"
              style={{ left: listWidth, width, height }}
            >
              <DependencyLayer
                project={shown}
                rows={rows}
                origin={origin}
                zoom={zoom}
                width={width}
                height={height}
                start={range.start}
                end={range.end}
              />
              <TimelineGrid
                origin={origin}
                zoom={zoom}
                first={first}
                last={last}
                height={height}
                width={width}
                rows={visible}
                offset={range.start}
              />
              {visible.map(
                (row, i) =>
                  row.type === "task" && (
                    <TaskBar
                      key={row.id}
                      task={row.task}
                      row={i + range.start}
                      origin={origin}
                      zoom={zoom}
                      projectColor={project.color}
                      select={selectTask}
                    />
                  ),
              )}
              {visible.map(
                (row, i) =>
                  row.type === "task" &&
                  unscheduled.has(row.id) && (
                    <UnscheduledRow
                      key={row.id}
                      task={row.task}
                      project={project}
                      row={i + range.start}
                      width={width}
                      origin={origin}
                      zoom={zoom}
                    />
                  ),
              )}
            </div>
          </div>
        </div>
      </div>
      <DragOverlay>
        {drag.label && (
          <div className="rounded border border-brand-accent bg-brand-soft px-5 py-3 text-sm shadow-lg">
            {drag.label}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
