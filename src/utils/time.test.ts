import { describe, expect, it } from 'vitest';
import {
  addDaysToDateStr,
  dateStrToDate,
  timeStrToDate,
  toDateStr,
  toHHMM,
  todayStr,
} from './time';

describe('time utils', () => {
  it('formats dates as YYYY-MM-DD', () => {
    expect(toDateStr(new Date(2024, 0, 5))).toBe('2024-01-05');
    expect(toDateStr(new Date(2024, 11, 31))).toBe('2024-12-31');
  });

  it('parses YYYY-MM-DD into a local date', () => {
    const d = dateStrToDate('2024-03-10');
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(10);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDaysToDateStr('2024-01-30', 3)).toBe('2024-02-02');
    expect(addDaysToDateStr('2024-12-30', 5)).toBe('2025-01-04');
    expect(addDaysToDateStr('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('parses HH:mm into a local date', () => {
    const d = timeStrToDate('2024-03-10', '14:30');
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(30);
    expect(d.getDate()).toBe(10);
  });

  it('formats a Date as HH:mm', () => {
    expect(toHHMM(new Date(2024, 0, 1, 9, 5))).toBe('09:05');
  });

  it('returns the current date as YYYY-MM-DD', () => {
    const expected = toDateStr(new Date());
    expect(todayStr()).toBe(expected);
  });
});
