import { db } from '../db/db';
import type { Medicine, Reminder } from '../db/types';
import { newId } from '../utils/id';
import { scheduledDates, scheduledMealWindows, scheduledTimes } from './schedule';

/**
 * Regenerates the materialized future reminders for a single medicine.
 *
 * Future reminders in 'pending' or 'snoozed' state are rebuilt from the
 * current schedule. Historical records ('taken'/'skipped'/'missed'/
 * 'dismissed') are left untouched. An inactive medicine gets no future
 * reminders.
 */
export async function syncRemindersForMedicine(medicine: Medicine): Promise<void> {
  await db.transaction('rw', db.reminders, async () => {
    const stale = await db.reminders
      .where('medicineId')
      .equals(medicine.id)
      .filter(
        (r) =>
          (r.status === 'pending' || r.status === 'snoozed') &&
          r.scheduledTime >= Date.now(),
      )
      .toArray();
    if (stale.length > 0) {
      await db.reminders.bulkDelete(stale.map((r) => r.id));
    }

    if (!medicine.active) return;

    const now = Date.now();
    const dates = scheduledDates(medicine);
    const created: Reminder[] = [];

    if (medicine.frequency === 'before-meal') {
      for (const dateStr of dates) {
        for (const { meal, start, end } of scheduledMealWindows(medicine, dateStr)) {
          if (end.getTime() < now) continue;
          created.push({
            id: newId(),
            medicineId: medicine.id,
            scheduledTime: start.getTime(),
            status: 'pending',
            triggeredAt: null,
            completedAt: null,
            action: null,
            verificationResult: null,
            gentle: true,
            windowEnd: end.getTime(),
            meal,
          });
        }
      }
    } else {
      for (const dateStr of dates) {
        for (const dt of scheduledTimes(medicine, dateStr)) {
          if (dt.getTime() < now) continue;
          created.push({
            id: newId(),
            medicineId: medicine.id,
            scheduledTime: dt.getTime(),
            status: 'pending',
            triggeredAt: null,
            completedAt: null,
            action: null,
            verificationResult: null,
            gentle: false,
            windowEnd: null,
            meal: null,
          });
        }
      }
    }

    if (created.length > 0) {
      await db.reminders.bulkAdd(created);
    }
  });
}

/**
 * Marks overdue reminders as 'missed' and returns how many were updated.
 * Gentle reminders are missed when their window has closed; others when the
 * scheduled time has passed.
 */
export async function markMissedReminders(): Promise<number> {
  const now = Date.now();
  const overdue = await db.reminders
    .where('status')
    .equals('pending')
    .filter((r) => (r.gentle ? (r.windowEnd ?? r.scheduledTime) < now : r.scheduledTime < now))
    .toArray();
  if (overdue.length === 0) return 0;
  await db.reminders.bulkUpdate(
    overdue.map((r) => ({ key: r.id, changes: { status: 'missed' } })),
  );
  return overdue.length;
}

/** Syncs every medicine once and marks anything already overdue as missed. */
export async function runReminderMaintenance(): Promise<void> {
  const medicines = await db.medicines.toArray();
  for (const medicine of medicines) {
    try {
      await syncRemindersForMedicine(medicine);
    } catch (err) {
      console.error('Failed to sync reminders for medicine', medicine.id, err);
    }
  }
  await markMissedReminders();
}
