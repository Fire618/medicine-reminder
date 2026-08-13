import type { Meal, MealWindows, Medicine } from '../db/types';
import { addDaysToDateStr, dateStrToDate, timeStrToDate, todayStr } from '../utils/time';

export const GENERATION_WINDOW_DAYS = 30;

export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

export const MEAL_ORDER: Meal[] = ['breakfast', 'lunch', 'dinner'];

export const DEFAULT_MEAL_WINDOWS: MealWindows = {
  breakfast: { start: '07:00', end: '10:00' },
  lunch: { start: '11:00', end: '14:00' },
  dinner: { start: '18:00', end: '21:00' },
};

/** Effective meal windows for a medicine, defaults applied. */
export function effectiveMealWindows(medicine: Medicine): MealWindows {
  return {
    breakfast: medicine.mealWindows?.breakfast ?? DEFAULT_MEAL_WINDOWS.breakfast,
    lunch: medicine.mealWindows?.lunch ?? DEFAULT_MEAL_WINDOWS.lunch,
    dinner: medicine.mealWindows?.dinner ?? DEFAULT_MEAL_WINDOWS.dinner,
  };
}

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
    const isBeforeMeal =
      medicine.frequency === 'before-meal' && medicine.daysOfWeek.length === 0;
    if (medicine.frequency === 'daily' || isBeforeMeal || medicine.daysOfWeek.includes(day)) {
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

export type ScheduledMealWindow = {
  meal: Meal;
  start: Date;
  end: Date;
};

/** Meal-window start/end for a medicine on a given date (empty unless before-meal). */
export function scheduledMealWindows(medicine: Medicine, dateStr: string): ScheduledMealWindow[] {
  if (medicine.frequency !== 'before-meal') return [];
  const windows = effectiveMealWindows(medicine);
  return (medicine.meals ?? []).map((meal) => {
    const w = windows[meal] ?? DEFAULT_MEAL_WINDOWS[meal];
    return { meal, start: timeStrToDate(dateStr, w.start), end: timeStrToDate(dateStr, w.end) };
  });
}

/** True when a medicine has at least one scheduled date within the window. */
export function isActiveInWindow(medicine: Medicine): boolean {
  return scheduledDates(medicine).length > 0;
}
