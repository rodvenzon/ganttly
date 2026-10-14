import { useRef, useState } from "react";
import {
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragMoveEvent,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import type { ProjectDetail, Task } from "@/lib/types";
import type { Zoom } from "@/lib/scheduling/constants";
import { ZOOMS, ROW_HEIGHT } from "@/lib/scheduling/constants";
import { snapToDay } from "@/lib/scheduling/geometry";
import { moveTask, resizeTask, cascade } from "@/lib/scheduling/cascade";
import { calendarOf } from "@/lib/scheduling/calendar";
import { useUI } from "@/store/ui";
import { useProjectActions } from "@/lib/api/use-project-actions";
type DragKind = "move" | "start" | "end" | "row";
export function useChartDrag(project: ProjectDetail, zoom: Zoom) {
  const { commit, busy } = useProjectActions(),
    { setPreview, notify } = useUI();
  const active = useRef<{ task: Task; kind: DragKind; days: number } | null>(
    null,
  );
  const [label, setLabel] = useState<string | null>(null);
  const coordinates: KeyboardCoordinateGetter = (
    event,
    { currentCoordinates },
  ) => {
    const { x, y } = currentCoordinates;
    switch (event.code) {
      case "ArrowRight":
        return { x: x + ZOOMS[zoom], y };
      case "ArrowLeft":
        return { x: x - ZOOMS[zoom], y };
      case "ArrowDown":
        return { x, y: y + ROW_HEIGHT };
      case "ArrowUp":
        return { x, y: y - ROW_HEIGHT };
    }
  };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: coordinates }),
  );
  function onDragStart(event: DragStartEvent) {
    if (busy) return;
    const data = event.active.data.current;
    const task = project.tasks.find((t) => t.id === data?.taskId);
    if (!task) return;
    active.current = { task, kind: data?.kind, days: 0 };
    if (data?.kind === "row") setLabel(task.name);
  }
  function changed(delta: number) {
    const a = active.current;
    if (!a || a.kind === "row") return null;
    const cal = calendarOf(project);
    return a.kind === "move"
      ? moveTask(a.task, delta, cal)
      : resizeTask(a.task, a.kind, delta, cal);
  }
  function onDragMove(event: DragMoveEvent) {
    const a = active.current;
    if (!a || a.kind === "row") return;
    const days = snapToDay(event.delta.x, zoom);
    if (days === a.days) return;
    try {
      const task = changed(days);
      if (task) {
        setPreview(
          cascade(
            project.tasks.map((t) => (t.id === task.id ? task : t)),
            project.dependencies,
            calendarOf(project),
          ),
        );
        a.days = days;
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "Invalid schedule");
    }
  }
  function reset() {
    active.current = null;
    setLabel(null);
    setPreview(null);
  }
  function onDragEnd(event: DragEndEvent) {
    const a = active.current;
    if (!a) {
      reset();
      return;
    }
    if (a.kind === "row") {
      const target = event.over?.data.current;
      if (target && target.taskId !== a.task.id)
        void commit({
          type: "task.reorder",
          id: a.task.id,
          groupId: target.groupId ?? null,
          beforeId: target.taskId ?? null,
        });
      reset();
      return;
    }
    try {
      const task = changed(snapToDay(event.delta.x, zoom));
      if (
        task &&
        (task.startDate !== a.task.startDate || task.endDate !== a.task.endDate)
      ) {
        void commit({
          type: "task.update",
          id: task.id,
          patch: { startDate: task.startDate, endDate: task.endDate },
        });
        active.current = null;
        setLabel(null);
      } else reset();
    } catch (error) {
      reset();
      notify(error instanceof Error ? error.message : "Invalid dates");
    }
  }
  return {
    sensors,
    onDragStart,
    onDragMove,
    onDragEnd,
    onDragCancel: reset,
    label,
  };
}
