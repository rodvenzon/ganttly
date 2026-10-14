"use client";
import { useProjectActions } from "@/lib/api/use-project-actions";
/** Footer switch between calendar days and working days for one project. */
export function WorkdaysToggle({
  skipWeekends,
  archived,
}: {
  skipWeekends: boolean;
  archived: boolean;
}) {
  const { commit, busy } = useProjectActions();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs text-brand-muted">
      <span>
        {skipWeekends
          ? "Working days only · Weekends skipped · Linked tasks move to the next weekday"
          : "Calendar days · Weekends shaded · Dates snap to whole days"}
      </span>
      <label
        className={`flex items-center gap-2 ${archived ? "opacity-50" : "cursor-pointer"}`}
      >
        <span className="font-medium text-brand-ink">Skip weekends</span>
        <button
          type="button"
          role="switch"
          aria-checked={skipWeekends}
          aria-label="Skip weekends"
          disabled={busy || archived}
          onClick={() =>
            void commit({
              type: "project.update",
              skipWeekends: !skipWeekends,
            })
          }
          className={`relative h-5 w-9 rounded-full transition-colors disabled:cursor-not-allowed ${skipWeekends ? "bg-brand-accent" : "bg-brand-line"}`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${skipWeekends ? "left-[18px]" : "left-0.5"}`}
          />
        </button>
      </label>
    </div>
  );
}
