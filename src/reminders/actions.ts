import { db } from '../db/db';
import type { Medicine, Reminder, ReminderStatus, VerificationStatus } from '../db/types';
import { newId } from '../utils/id';

export const SNOOZE_MINUTES = 5;

async function recordHistory(
  reminder: Reminder,
  medicine: Medicine,
  status: ReminderStatus,
  verificationStatus: VerificationStatus,
  action: string | null,
): Promise<void> {
  await db.history.add({
    id: newId(),
    medicineId: medicine.id,
    medicineName: medicine.name,
    scheduledTime: reminder.scheduledTime,
    completedAt: Date.now(),
    status,
    verificationStatus,
    action,
  });
}

async function resolveReminder(
  reminderId: string,
  status: ReminderStatus,
  verificationStatus: VerificationStatus,
  action: string,
): Promise<void> {
  const reminder = await db.reminders.get(reminderId);
  if (!reminder) return;
  const medicine = await db.medicines.get(reminder.medicineId);
  if (!medicine) return;
  const now = Date.now();
  await db.transaction('rw', db.reminders, db.history, async () => {
    await db.reminders.update(reminderId, {
      status,
      completedAt: now,
      action,
      verificationResult: verificationStatus,
    });
    await recordHistory(reminder, medicine, status, verificationStatus, action);
  });
}

/** Marks a reminder as taken after the user has explicitly confirmed. */
export async function markTaken(
  reminderId: string,
  verificationStatus: VerificationStatus = 'none',
): Promise<void> {
  await resolveReminder(reminderId, 'taken', verificationStatus, 'manual');
}

export async function skipReminder(reminderId: string): Promise<void> {
  await resolveReminder(reminderId, 'skipped', 'none', 'skip');
}

export async function dismissReminder(reminderId: string): Promise<void> {
  await resolveReminder(reminderId, 'dismissed', 'none', 'dismiss');
}

/** Re-arms a reminder at now + minutes and logs the snooze. */
export async function snoozeReminder(
  reminderId: string,
  minutes = SNOOZE_MINUTES,
): Promise<void> {
  const reminder = await db.reminders.get(reminderId);
  if (!reminder) return;
  const medicine = await db.medicines.get(reminder.medicineId);
  if (!medicine) return;
  const newTime = Date.now() + minutes * 60_000;
  await db.transaction('rw', db.reminders, db.history, async () => {
    await db.reminders.update(reminderId, {
      scheduledTime: newTime,
      status: 'snoozed',
      completedAt: null,
      action: 'snooze',
    });
    await recordHistory(reminder, medicine, 'snoozed', 'none', 'snooze');
  });
}
