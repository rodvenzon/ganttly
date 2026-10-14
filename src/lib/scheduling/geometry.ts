import type { Task } from "@/lib/types";
import { addWholeDays, daysBetween } from "./dates";
import { BAR_PADDING, ROW_HEIGHT, ZOOMS, type Zoom } from "./constants";
export const snapToDay = (deltaX: number, zoom: Zoom) =>
  Math.round(deltaX / ZOOMS[zoom]);
export const dateToX = (date: string, origin: string, zoom: Zoom) =>
  daysBetween(date, origin) * ZOOMS[zoom];
export const xToDate = (x: number, origin: string, zoom: Zoom) =>
  addWholeDays(origin, Math.floor(x / ZOOMS[zoom]));
export const rowToY = (row: number) => row * ROW_HEIGHT;
export function barGeometry(
  task: Task,
  row: number,
  origin: string,
  zoom: Zoom,
) {
  if (!task.startDate || !task.endDate) return null;
  const column = dateToX(task.startDate, origin, zoom),
    y = rowToY(row) + 10;
  const x = task.isMilestone
    ? column + ZOOMS[zoom] / 2 - 9
    : column + BAR_PADDING;
  const width = task.isMilestone
    ? 18
    : Math.max(
        4,
        dateToX(addWholeDays(task.endDate, 1), origin, zoom) -
          column -
          BAR_PADDING * 2,
      );
  return {
    x,
    y,
    width,
    height: 28,
    startX: x,
    endX: x + width,
    centerY: rowToY(row) + ROW_HEIGHT / 2,
  };
}
export function elbowPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const exit = from.x + 12,
    entry = to.x - 12;
  if (entry >= exit) {
    const middle = (exit + entry) / 2;
    return `M${from.x},${from.y} H${middle} V${to.y} H${to.x}`;
  }
  const between = from.y + (to.y > from.y ? ROW_HEIGHT / 2 : -ROW_HEIGHT / 2);
  return `M${from.x},${from.y} H${exit} V${between} H${entry} V${to.y} H${to.x}`;
}
export function visibleRange(
  scrollTop: number,
  height: number,
  count: number,
  overscan = 6,
) {
  return {
    start: Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - overscan),
    end: Math.min(
      count,
      Math.ceil((scrollTop + height) / ROW_HEIGHT) + overscan,
    ),
  };
}
