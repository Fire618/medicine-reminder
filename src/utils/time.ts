export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Current local date as "YYYY-MM-DD". */
export function todayStr(): string {
  return toDateStr(new Date());
}

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dateStrToDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Parse "HH:mm" into a Date on the given local date. */
export function timeStrToDate(dateStr: string, time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const d = dateStrToDate(dateStr);
  d.setHours(h, m, 0, 0);
  return d;
}

export function toHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatDateStr(s: string): string {
  return dateStrToDate(s).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Adds days to a "YYYY-MM-DD" string. */
export function addDaysToDateStr(s: string, days: number): string {
  const d = dateStrToDate(s);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}
