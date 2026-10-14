import { memo } from "react";
import { isWeekend, parseISO } from "date-fns";
import { addWholeDays, today } from "@/lib/scheduling/dates";
import { dateToX } from "@/lib/scheduling/geometry";
import { ZOOMS, type Zoom, ROW_HEIGHT } from "@/lib/scheduling/constants";
import type { Row } from "./model";
export const TimelineGrid = memo(function TimelineGrid({
  origin,
  zoom,
  first,
  last,
  height,
  width,
  rows,
  offset,
}: {
  origin: string;
  zoom: Zoom;
  first: number;
  last: number;
  height: number;
  width: number;
  rows: Row[];
  offset: number;
}) {
  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width={width}
      height={height}
      aria-hidden="true"
    >
      {Array.from(
        { length: Math.max(0, last - first) },
        (_, n) => n + first,
      ).map((i) => {
        const date = addWholeDays(origin, i),
          x = dateToX(date, origin, zoom);
        return (
          <g key={date}>
            {isWeekend(parseISO(date)) && (
              <rect
                x={x}
                width={ZOOMS[zoom]}
                height={height}
                className="fill-brand-stone"
              />
            )}
            <line x1={x} x2={x} y2={height} className="stroke-brand-line/50" />
          </g>
        );
      })}
      {rows.map((row, i) => (
        <g key={row.id}>
          {row.type === "group" && (
            <rect
              y={(i + offset) * ROW_HEIGHT}
              height={ROW_HEIGHT}
              width={width}
              className="fill-brand-stone"
            />
          )}
          <line
            y1={(i + offset + 1) * ROW_HEIGHT}
            y2={(i + offset + 1) * ROW_HEIGHT}
            x2={width}
            className="stroke-brand-line/60"
          />
        </g>
      ))}
      <line
        x1={dateToX(today(), origin, zoom) + ZOOMS[zoom] / 2}
        x2={dateToX(today(), origin, zoom) + ZOOMS[zoom] / 2}
        y2={height}
        className="stroke-brand-accent"
        strokeDasharray="4 4"
      />
    </svg>
  );
});
