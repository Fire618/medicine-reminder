import { describe, expect, it } from 'vitest';
import { scheduledDates } from './schedule';
import type { Medicine } from '../db/types';
import { addDaysToDateStr, todayStr } from '../utils/time';

function makeMedicine(overrides: Partial<Medicine>): Medicine {
  return {
    id: '1',
    name: 'Test',
    dosage: '',
    frequency: 'daily',
    daysOfWeek: [],
    times: ['09:00'],
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
