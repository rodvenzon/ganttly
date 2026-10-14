import { parseISO } from "date-fns";
import { addWholeDays } from "./dates";
/**
 * How a project counts days. With skipWeekends, Saturdays and Sundays are
 * not working days: tasks start and end on weekdays, durations count
 * weekdays only, and successors start on the next weekday.
 */
export interface WorkCalendar {
  skipWeekends: boolean;
}
export const CALENDAR_DAYS: WorkCalendar = { skipWeekends: false };
export const calendarOf = (p: { skipWeekends?: boolean }): WorkCalendar => ({
  skipWeekends: Boolean(p.skipWeekends),
});
const weekend = (date: string) => {
  const day = parseISO(date).getDay();
  return day === 0 || day === 6;
};
export const isWorkday = (date: string, cal: WorkCalendar) =>
  !cal.skipWeekends || !weekend(date);
/** `date` if it is a working day, otherwise the next one. */
export function nextWorkday(date: string, cal: WorkCalendar) {
  let d = date;
  while (!isWorkday(d, cal)) d = addWholeDays(d, 1);
  return d;
}
/** `date` if it is a working day, otherwise the one before. */
export function previousWorkday(date: string, cal: WorkCalendar) {
  let d = date;
  while (!isWorkday(d, cal)) d = addWholeDays(d, -1);
  return d;
}
/** Working days from start to end, both included (at least 1). */
export function workdaysIn(start: string, end: string, cal: WorkCalendar) {
  if (!cal.skipWeekends)
    return (
      Math.round(
        (parseISO(end).getTime() - parseISO(start).getTime()) / 86400000,
      ) + 1
    );
  let count = 0;
  for (let d = start; d <= end; d = addWholeDays(d, 1))
    if (isWorkday(d, cal)) count++;
  return Math.max(1, count);
}
/** The last day of a task that starts on `start` and lasts `days` working days. */
export function endAfter(start: string, days: number, cal: WorkCalendar) {
  if (!cal.skipWeekends) return addWholeDays(start, Math.max(1, days) - 1);
  let d = nextWorkday(start, cal);
  for (let left = Math.max(1, days) - 1; left > 0; left--)
    d = nextWorkday(addWholeDays(d, 1), cal);
  return d;
}
/**
 * Pulls a date range onto working days: the start moves forward and the end
 * back to the nearest weekday. A range that holds no weekday at all (a task
 * on a Saturday and Sunday) becomes the following Monday.
 */
export function onWorkdays(
  start: string,
  end: string,
  cal: WorkCalendar,
  milestone = false,
) {
  if (!cal.skipWeekends) return { startDate: start, endDate: end };
  const s = nextWorkday(start, cal);
  if (milestone) return { startDate: s, endDate: s };
  const e = previousWorkday(end, cal);
  return { startDate: s, endDate: e < s ? s : e };
}
