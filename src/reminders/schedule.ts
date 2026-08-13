import type { Medicine } from '../db/types';
import { addDaysToDateStr, dateStrToDate, timeStrToDate, todayStr } from '../utils/time';

export const GENERATION_WINDOW_DAYS = 30;

function scheduleWindowStart(medicine: Medicine): string {
  const today = todayStr();
  return medicine.startDate > today ? medicine.startDate : today;
}

function scheduleWindowEnd(medicine: Medicine): string {
  const horizon = addDaysToDateStr(todayStr(), GENERATION_WINDOW_DAYS);
  if (medicine.endDate && medicine.endDate < horizon) return medicine.endDate;
  return horizon;
}

/** All scheduled dates (as "YYYY-MM-DD") for a medicine within the generation window. */
export function scheduledDates(medicine: Medicine): string[] {
  const start = scheduleWindowStart(medicine);
  const end = scheduleWindowEnd(medicine);
  if (end < start) return [];

  const dates: string[] = [];
  let d = start;
  while (d <= end) {
    const day = dateStrToDate(d).getDay();
    if (medicine.frequency === 'daily' || medicine.daysOfWeek.includes(day)) {
      dates.push(d);
    }
    d = addDaysToDateStr(d, 1);
  }
  return dates;
}

/** The scheduled Date instances for a medicine on a given "YYYY-MM-DD" date. */
export function scheduledTimes(medicine: Medicine, dateStr: string): Date[] {
  return medicine.times.map((t) => timeStrToDate(dateStr, t));
}

/** True when a medicine has at least one scheduled date within the window. */
export function isActiveInWindow(medicine: Medicine): boolean {
  return scheduledDates(medicine).length > 0;
}
