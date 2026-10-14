import { memo } from "react";
import { format, isWeekend, parseISO } from "date-fns";
import { addWholeDays, today } from "@/lib/scheduling/dates";
import { dateToX } from "@/lib/scheduling/geometry";
import { ZOOMS, type Zoom, HEADER_HEIGHT } from "@/lib/scheduling/constants";
export const TimelineHeader = memo(function TimelineHeader({
  origin,
  zoom,
  first,
  last,
}: {
  origin: string;
  zoom: Zoom;
  first: number;
  last: number;
}) {
  return (
    <div className="relative bg-white" style={{ height: HEADER_HEIGHT }}>
      {Array.from(
        { length: Math.max(0, last - first) },
        (_, n) => n + first,
      ).map((i) => {
        const date = addWholeDays(origin, i),
          parsed = parseISO(date),
          weekend = isWeekend(parsed),
          weekStart = parsed.getDay() === 1,
          label = zoom === "month" ? parsed.getDate() === 1 : weekStart;
        return (
          <div
            key={date}
            className={`absolute top-0 h-full text-center text-xs ${weekend ? "text-brand-muted/60" : "text-brand-muted"}`}
            style={{ left: dateToX(date, origin, zoom), width: ZOOMS[zoom] }}
          >
            {(label || i === 0) && (
              <span className="absolute left-1 top-3 whitespace-nowrap font-medium text-brand-ink">
                {format(parsed, zoom === "month" ? "MMMM yyyy" : "MMM d")}
              </span>
            )}
            {(zoom !== "month" || weekStart) && (
              <span
                className={`absolute bottom-3 left-1/2 -translate-x-1/2 rounded px-1.5 py-0.5 ${date === today() ? "bg-brand-gold text-brand-ink" : ""}`}
              >
                {format(parsed, "d")}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
});
