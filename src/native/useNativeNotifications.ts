import { useEffect } from 'react';
import { db } from '../db/db';
import { stopAlarmSound } from '../alarm/sound';
import { setActiveAlarm } from '../alarm/alarmStore';
import {
  isNativePlatform,
  onNativeAppResume,
  onNativeNotificationTap,
  requestNativeNotificationPermission,
  syncNativeNotifications,
} from './notifications';

/**
 * Keeps the OS notification schedule in sync with the on-device reminders
 * while running inside the Capacitor (Android) app. The native notifications
 * are what fire when the app is killed; the web alarm controller only handles
 * the foreground experience. Re-syncs are also triggered from the action and
 * engine layers via `scheduleNativeSync()` whenever reminders change.
 */
export function useNativeNotifications(): void {
  useEffect(() => {
    if (!isNativePlatform()) return;

    void requestNativeNotificationPermission();
    void syncNativeNotifications();

    const unregisterTap = onNativeNotificationTap(async (reminderId) => {
      // User opened the app from a fired notification: show the dose screen
      // for that reminder (native notification already sounded the alarm).
      const reminder = await db.reminders.get(reminderId);
      if (!reminder) return;
      const medicine = await db.medicines.get(reminder.medicineId);
      if (!medicine) return;
      stopAlarmSound();
      setActiveAlarm({
        reminderId: reminder.id,
        medicineId: medicine.id,
        medicineName: medicine.name,
        dosage: medicine.dosage,
        scheduledTime: reminder.scheduledTime,
      });
    });

    const unregisterResume = onNativeAppResume(() => {
      void syncNativeNotifications();
    });

    return () => {
      unregisterTap();
      unregisterResume();
    };
  }, []);
}