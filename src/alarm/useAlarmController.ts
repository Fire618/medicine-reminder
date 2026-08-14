import { useEffect } from 'react';
import { getActiveAlarm, setActiveAlarm, type ActiveAlarm } from './alarmStore';
import { startAlarmSound, stopAlarmSound, unlockAudio } from './sound';
import {
  isNotificationSupported,
  requestNotificationPermission,
  showDueAlarmNotification,
  showGentleReminderNotification,
} from './notifications';
import { db } from '../db/db';

const TICK_MS = 10_000;

/**
 * A reminder more than this old when detected is treated as "stale": it came
 * due while the app was closed/away, so it gets a quiet nudge instead of a
 * loud alarm or blocking screen. Fresh doses (due while the app is awake)
 * ring normally.
 */
const STALE_MS = 60_000;

/**
 * Checks whether any reminder is due and, if so, starts the persistent alarm.
 * Safe to call repeatedly; it is a no-op while an alarm is already active.
 * Gentle (meal-window) reminders only send one notification and never start
 * the loud alarm. Overdue-but-stale doses get a quiet notification rather
 * than ringing, so opening the app never blasts an alarm for a late dose.
 */
export async function checkDueAlarm(): Promise<void> {
  if (getActiveAlarm()) return;
  const now = Date.now();
  const due = await db.reminders
    .where('scheduledTime')
    .belowOrEqual(now)
    .filter((r) => r.status === 'pending' || r.status === 'snoozed')
    .sortBy('scheduledTime');
  if (due.length === 0) return;

  const reminder = due[0];

  if (reminder.gentle) {
    if (reminder.triggeredAt === null) {
      const medicine = await db.medicines.get(reminder.medicineId);
      if (!medicine) return;
      await db.reminders.update(reminder.id, { triggeredAt: now });
      showGentleReminderNotification(
        reminder.id,
        medicine.name,
        medicine.dosage,
        reminder.meal,
        reminder.scheduledTime,
      );
    }
    return;
  }

  const medicine = await db.medicines.get(reminder.medicineId);
  if (!medicine) return;

  const stale = now - reminder.scheduledTime > STALE_MS;

  if (stale) {
    // Came due while the app was not awake: quiet notification once, no
    // alarm sound and no blocking screen. It stays visible in Today.
    if (reminder.triggeredAt === null) {
      await db.reminders.update(reminder.id, { triggeredAt: now });
      showDueAlarmNotification(
        reminder.id,
        medicine.name,
        medicine.dosage,
        reminder.scheduledTime,
      );
    }
    return;
  }

  if (reminder.triggeredAt === null) {
    await db.reminders.update(reminder.id, { triggeredAt: now });
  }

  startAlarmSound();
  const alarm: ActiveAlarm = {
    reminderId: reminder.id,
    medicineId: medicine.id,
    medicineName: medicine.name,
    dosage: medicine.dosage,
    scheduledTime: reminder.scheduledTime,
  };
  setActiveAlarm(alarm);
  showDueAlarmNotification(alarm.reminderId, alarm.medicineName, alarm.dosage, alarm.scheduledTime);
}

/**
 * Runs due-detection for the lifetime of the app, unlocks audio, and offers
 * notification permission on the first user gesture (browser autoplay and
 * permission-prompt policies require a gesture).
 */
export function useAlarmController(): void {
  useEffect(() => {
    const unlockOnce = () => {
      unlockAudio();
      if (isNotificationSupported() && Notification.permission === 'default') {
        void requestNotificationPermission();
      }
    };
    window.addEventListener('pointerdown', unlockOnce, { once: true });
    window.addEventListener('keydown', unlockOnce, { once: true });

    checkDueAlarm().catch((err) => console.error('Initial alarm check failed', err));
    const interval = window.setInterval(() => {
      checkDueAlarm().catch((err) => console.error('Alarm check failed', err));
    }, TICK_MS);

    return () => {
      window.removeEventListener('pointerdown', unlockOnce);
      window.removeEventListener('keydown', unlockOnce);
      window.clearInterval(interval);
      stopAlarmSound();
      setActiveAlarm(null);
    };
  }, []);
}
