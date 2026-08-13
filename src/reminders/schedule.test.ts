import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MEAL_WINDOWS,
  effectiveMealWindows,
  scheduledDates,
  scheduledMealWindows,
} from './schedule';
import type { Medicine } from '../db/types';
import { addDaysToDateStr, todayStr, toDateStr } from '../utils/time';

function makeMedicine(overrides: Partial<Medicine>): Medicine {
  return {
    id: '1',
    name: 'Test',
    dosage: '',
    frequency: 'daily',
    daysOfWeek: [],
    times: ['09:00'],
    meals: [],
    mealWindows: DEFAULT_MEAL_WINDOWS,
    startDate: todayStr(),
    endDate: null,
    durationDays: null,
    referenceImage: null,
    visualMetadata: null,
    active: true,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe('scheduledDates', () => {
  it('generates every day for daily frequency within the window', () => {
    const end = addDaysToDateStr(todayStr(), 2);
    const dates = scheduledDates(makeMedicine({ endDate: end }));
    expect(dates).toHaveLength(3);
    expect(dates[0]).toBe(todayStr());
    expect(dates[2]).toBe(end);
  });

  it('only includes selected weekdays for custom-days frequency', () => {
    const today = new Date();
    const end = addDaysToDateStr(todayStr(), 6);
    const onlyToday = makeMedicine({
      frequency: 'custom-days',
      daysOfWeek: [today.getDay()],
      endDate: end,
    });
    expect(scheduledDates(onlyToday)).toHaveLength(1);

    const everyDay = makeMedicine({
      frequency: 'custom-days',
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      endDate: end,
    });
    expect(scheduledDates(everyDay)).toHaveLength(7);
  });

  it('returns an empty list when no weekdays are selected', () => {
    const dates = scheduledDates(
      makeMedicine({ frequency: 'custom-days', daysOfWeek: [] }),
    );
    expect(dates).toHaveLength(0);
  });

  it('respects the end date', () => {
    const end = todayStr();
    const dates = scheduledDates(makeMedicine({ endDate: end }));
    expect(dates).toHaveLength(1);
    expect(dates[0]).toBe(end);
  });

  it('returns an empty list when the start date is beyond the generation window', () => {
    const future = addDaysToDateStr(todayStr(), 40);
    const dates = scheduledDates(makeMedicine({ startDate: future }));
    expect(dates).toHaveLength(0);
  });
});

describe('before-meal frequency', () => {
  it('treats empty daysOfWeek as every day', () => {
    const end = addDaysToDateStr(todayStr(), 2);
    const dates = scheduledDates(
      makeMedicine({ frequency: 'before-meal', daysOfWeek: [], meals: ['lunch'], endDate: end }),
    );
    expect(dates).toHaveLength(3);
  });

  it('honors selected weekdays when present', () => {
    const end = addDaysToDateStr(todayStr(), 6);
    const today = new Date();
    const dates = scheduledDates(
      makeMedicine({
        frequency: 'before-meal',
        daysOfWeek: [today.getDay()],
        meals: ['lunch'],
        endDate: end,
      }),
    );
    expect(dates).toHaveLength(1);
  });

  it('builds a lunch window on a date using the configured times', () => {
    const medicine = makeMedicine({ frequency: 'before-meal', meals: ['lunch'] });
    const windows = scheduledMealWindows(medicine, todayStr());
    expect(windows).toHaveLength(1);
    expect(windows[0].meal).toBe('lunch');
    expect(toDateStr(windows[0].start)).toBe(todayStr());
    expect(windows[0].start.getHours()).toBe(11);
    expect(windows[0].end.getHours()).toBe(14);
  });

  it('returns nothing for non-meal frequencies', () => {
    const windows = scheduledMealWindows(makeMedicine({ meals: ['dinner'] }), todayStr());
    expect(windows).toHaveLength(0);
  });

  it('applies defaults for meals without a stored window', () => {
    const windows = effectiveMealWindows(makeMedicine({}));
    expect(windows.breakfast.start).toBe('07:00');
    expect(windows.dinner.end).toBe('21:00');
  });
});
