import { formatTime } from '../utils/time';
import { MEAL_LABELS } from '../reminders/schedule';
import type { Meal } from '../db/types';

export type NotificationPermissionState = NotificationPermission | 'unsupported';

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermissionState {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/** Must be called within a user gesture for the browser to show the prompt. */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/**
 * Shows a browser notification for a due alarm. No-op unless permission is
 * granted. Works while the app is open; it cannot wake a closed app (that
 * would require Web Push, which is intentionally not used here).
 */
export function showDueAlarmNotification(
  reminderId: string,
  medicineName: string,
  dosage: string,
  scheduledTime: number,
): void {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return;
  const time = formatTime(new Date(scheduledTime));
  const body = dosage ? `${dosage} · scheduled ${time}` : `Scheduled ${time}`;
  try {
    const notification = new Notification(`Time to take ${medicineName}`, {
      body,
      tag: `medicine-reminder-${reminderId}`,
      icon: `${import.meta.env.BASE_URL}icon-192.png`,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch (err) {
    console.error('Failed to show notification', err);
  }
}

/**
 * One gentle nudge for a meal-window reminder: notification only, never a
 * loud alarm. The dose stays actionable from the Today screen until the
 * window closes.
 */
export function showGentleReminderNotification(
  reminderId: string,
  medicineName: string,
  dosage: string,
  meal: Meal | null,
  scheduledTime: number,
): void {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return;
  const time = formatTime(new Date(scheduledTime));
  const mealLabel = meal ? MEAL_LABELS[meal] : null;
  const body = mealLabel
    ? `Before ${mealLabel.toLowerCase()} (window opened ${time})${dosage ? ` · ${dosage}` : ''}`
    : `Take when convenient (window opened ${time})${dosage ? ` · ${dosage}` : ''}`;
  try {
    const notification = new Notification(`${medicineName} — gentle reminder`, {
      body,
      tag: `medicine-reminder-${reminderId}`,
      icon: `${import.meta.env.BASE_URL}icon-192.png`,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch (err) {
    console.error('Failed to show notification', err);
  }
}
