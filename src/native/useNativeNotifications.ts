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
 * the foreground experience.
 *
 * Ordering matters on Android 13+: the very first sync must wait for the
 * notification-permission prompt to be answered, because the plugin refuses
 * to schedule anything while notifications are disabled.
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
        // Denied (or prompt still unresolved): retry once after a short delay
        // in case the OS shows the prompt on first interaction.
        window.setTimeout(() => {
          if (!disposed) void syncNativeNotifications();
        }, 1500);
      }
    })();

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
      disposed = true;
      unregisterTap();
      unregisterResume();
    };
  }, []);
}