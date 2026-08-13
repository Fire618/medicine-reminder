import { db } from '../db/db';
import type { HistoryEntry, Medicine, Reminder, ReminderStatus } from '../db/types';
import { addDaysToDateStr, dateStrToDate, todayStr } from '../utils/time';

export type JoinedReminder = {
  reminder: Reminder;
  medicine: Medicine;
};

const DAY_MS = 86_400_000;

async function join(
  reminders: Reminder[],
  statuses: ReminderStatus[] = [],
): Promise<JoinedReminder[]> {
  if (reminders.length === 0) return [];
  const meds = await db.medicines.toArray();
  const byId = new Map(meds.map((m) => [m.id, m]));
  return reminders
    .filter((r) => byId.has(r.medicineId))
    .map((reminder) => ({
      reminder,
      medicine: byId.get(reminder.medicineId)!,
    }))
    .filter(
      (jr) =>
        statuses.length === 0 || statuses.includes(jr.reminder.status),
    )
    .sort((a, b) => a.reminder.scheduledTime - b.reminder.scheduledTime);
}

function todayRange(): { start: number; end: number } {
  const start = dateStrToDate(todayStr()).getTime();
  return { start, end: start + DAY_MS - 1 };
}

/** Reminders scheduled for today, any status. */
export async function getTodayReminders(): Promise<JoinedReminder[]> {
  const { start, end } = todayRange();
  const reminders = await db.reminders
    .where('scheduledTime')
    .between(start, end)
    .toArray();
  return join(reminders);
}

/** Upcoming (future) pending/snoozed reminders. */
export async function getUpcomingReminders(limit = 8): Promise<JoinedReminder[]> {
  const reminders = await db.reminders
    .where('scheduledTime')
    .above(Date.now())
    .filter((r) => r.status === 'pending' || r.status === 'snoozed')
    .limit(limit)
    .toArray();
  return join(reminders);
}

/** The next scheduled dose, or null when there is none. */
export async function getNextReminder(): Promise<JoinedReminder | null> {
  const upcoming = await getUpcomingReminders(1);
  return upcoming[0] ?? null;
}

/** Reminders marked missed today. */
export async function getMissedReminders(): Promise<JoinedReminder[]> {
  const { start, end } = todayRange();
  const reminders = await db.reminders
    .where('status')
    .equals('missed')
    .filter((r) => r.scheduledTime >= start && r.scheduledTime <= end)
    .toArray();
  return join(reminders);
}

/** Recent medication history, newest first. */
export async function getHistoryEntries(limit = 500): Promise<HistoryEntry[]> {
  return db.history.orderBy('scheduledTime').reverse().limit(limit).toArray();
}

export type DayAdherence = {
  date: string;
  taken: number;
  total: number;
};

/**
 * Taken/total adherence for each of the last `days` days.
 * 'snoozed' history entries are excluded so a dose is only counted once
 * (its final outcome is recorded separately).
 */
export async function getDailyAdherence(days = 7): Promise<DayAdherence[]> {
  const startStr = addDaysToDateStr(todayStr(), -(days - 1));
  const start = dateStrToDate(startStr).getTime();
  const entries = await db.history
    .where('scheduledTime')
    .aboveOrEqual(start)
    .toArray();

  const result: DayAdherence[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDaysToDateStr(startStr, i);
    const dayStart = dateStrToDate(d).getTime();
    const dayEnd = dayStart + DAY_MS - 1;
    const dayEntries = entries.filter(
      (e) => e.scheduledTime >= dayStart && e.scheduledTime <= dayEnd,
    );
    result.push({
      date: d,
      taken: dayEntries.filter((e) => e.status === 'taken').length,
      total: dayEntries.filter((e) => e.status !== 'snoozed').length,
    });
  }
  return result;
}
