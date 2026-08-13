import { useEffect } from 'react';
import { getActiveAlarm, setActiveAlarm, type ActiveAlarm } from './alarmStore';
import { startAlarmSound, stopAlarmSound, unlockAudio } from './sound';
import { db } from '../db/db';

const TICK_MS = 10_000;

/**
 * Checks whether any reminder is due and, if so, starts the persistent alarm.
 * Safe to call repeatedly; it is a no-op while an alarm is already active.
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
  const medicine = await db.medicines.get(reminder.medicineId);
  if (!medicine) return;

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
}

/**
 * Runs due-detection for the lifetime of the app and unlocks audio on the
 * first user gesture (browser autoplay policy).
 */
export function useAlarmController(): void {
  useEffect(() => {
    const unlockOnce = () => unlockAudio();
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
