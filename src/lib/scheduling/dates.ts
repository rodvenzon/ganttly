import {
  addDays,
  differenceInCalendarDays,
  format,
  isValid,
  parseISO,
} from "date-fns";
export const dateOnly = (date: Date) => format(date, "yyyy-MM-dd");
export const today = () => dateOnly(new Date());
export const isDateOnly = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  isValid(parseISO(value)) &&
  dateOnly(parseISO(value)) === value &&
  value >= "2000-01-01" &&
  value <= "2100-12-31";
export const addWholeDays = (date: string, days: number) =>
  dateOnly(addDays(parseISO(date), Math.trunc(days)));
export const daysBetween = (date: string, origin: string) =>
  differenceInCalendarDays(parseISO(date), parseISO(origin));
export function assertRange(
  start: string | null,
  end: string | null,
  milestone = false,
) {
  if (start === null && end === null) return;
  if (!start || !end || !isDateOnly(start) || !isDateOnly(end) || end < start)
    throw Error(
      "Choose valid start and end dates (2000–2100), with end on or after start.",
    );
  if (milestone && start !== end)
    throw Error("A milestone must have one date.");
}
