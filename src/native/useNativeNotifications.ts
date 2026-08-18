import { useEffect } from 'react';
import { db } from '../db/db';
import { stopAlarmSound } from '../alarm/sound';
import { getActiveAlarm, setActiveAlarm } from '../alarm/alarmStore';
import { FullScreenAlarm } from './alarmPlugin';
import {
  isNativePlatform,
  onNativeAppResume,
  requestNativeNotificationPermission,
  syncNativeNotifications,
  enableAlarmUi,
} from './notifications';

async function showForcedAlarm(reminderId: string): Promise<void> {
  const reminder = await db.reminders.get(reminderId);
  if (!reminder) return;
  if (reminder.status !== 'pending' && reminder.status !== 'snoozed') return;
  const medicine = await db.medicines.get(reminder.medicineId);
  if (!medicine) return;
  // Already handling this dose (e.g. user is mid-photo) — don't reset the UI.
  if (getActiveAlarm()?.reminderId === reminderId) return;
  stopAlarmSound();
  void enableAlarmUi();
  setActiveAlarm({
    reminderId: reminder.id,
    medicineId: medicine.id,
    medicineName: medicine.name,
    dosage: medicine.dosage,
    scheduledTime: reminder.scheduledTime,
    forced: true,
  });
}

/**
 * Keeps the OS alarm schedule in sync with the on-device reminders and shows
 * the forced alarm screen when the app is launched by a native alarm.
 *
 * Ordering matters on Android 13+: the first sync must wait for the
 * notification-permission prompt to be answered, because scheduling is refused
 * while notifications are disabled.
 */
export function useNativeNotifications(): void {
  useEffect(() => {
    if (!isNativePlatform()) return;

    let disposed = false;

    void (async () => {
      const permission = await requestNativeNotificationPermission();
      if (disposed) return;
      if (permission === 'granted') {
        await syncNativeNotifications();
      } else {
        window.setTimeout(() => {
          if (!disposed) void syncNativeNotifications();
        }, 1500);
      }
    })();

    const consume = () => {
      void FullScreenAlarm.consumeLaunchReminder().then((r) => {
        if (disposed) return;
        if (r.reminderId) void showForcedAlarm(r.reminderId);
      });
    };

    // Cold start launched by a native alarm, and each return to the foreground.
    consume();
    const unregisterResume = onNativeAppResume(() => {
      consume();
      void syncNativeNotifications();
    });

    return () => {
      disposed = true;
      unregisterResume();
    };
  }, []);
}