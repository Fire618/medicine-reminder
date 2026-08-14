import { Capacitor } from '@capacitor/core';
import {
  LocalNotifications,
  type LocalNotificationSchema,
} from '@capacitor/local-notifications';
import { App } from '@capacitor/app';
import { db } from '../db/db';
import { formatTime } from '../utils/time';
import { MEAL_LABELS } from '../reminders/schedule';
import type { Meal } from '../db/types';

const SYNC_HORIZON_MS = 14 * 24 * 60 * 60 * 1000;
const CHANNEL_ID = 'reminders';

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

let syncTimer: number | undefined;

/**
 * Debounced re-sync. Call after any change that affects future reminders
 * (taken/snoozed/missed, medicine added/edited/deleted). No-op on web.
 */
export function scheduleNativeSync(): void {
  if (!isNativePlatform()) return;
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => {
    void syncNativeNotifications();
  }, 300);
}

/** Stable non-negative integer id derived from a reminder id (plugin requires ints). */
export function numericId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  }
  return (h & 0x7fffffff) || 1;
}

function mealLabel(meal: Meal | null): string {
  return meal ? MEAL_LABELS[meal].toLowerCase() : 'meal';
}

async function ensureChannel(): Promise<void> {
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Medicine reminders',
      description: 'Reminders for scheduled doses',
      importance: 5,
      vibration: true,
      sound: 'default',
      visibility: 1,
    });
  } catch (err) {
    console.error('Failed to create notification channel', err);
  }
}

/**
 * Reconciles the native notification schedule with the reminders currently
 * stored on the device. Runs on launch, on resume, and whenever the
 * reminders change (taken/snoozed/missed/edited). Notifications survive the
 * app being killed because they are registered with the OS.
 */
export async function syncNativeNotifications(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await ensureChannel();
    const now = Date.now();
    const reminders = await db.reminders.toArray();
    const meds = await db.medicines.toArray();
    const medById = new Map(meds.map((m) => [m.id, m]));

    const desired: LocalNotificationSchema[] = [];
    for (const r of reminders) {
      const statusOk = r.status === 'pending' || r.status === 'snoozed';
      const inHorizon =
        r.scheduledTime >= now && r.scheduledTime <= now + SYNC_HORIZON_MS;
      if (!statusOk || !inHorizon) continue;
      const medicine = medById.get(r.medicineId);
      if (!medicine || !medicine.active) continue;

      const time = formatTime(new Date(r.scheduledTime));
      let body: string;
      if (r.gentle) {
        const label = mealLabel(r.meal);
        const until = r.windowEnd ? ` · until ${formatTime(new Date(r.windowEnd))}` : '';
        body = `Before ${label} (window opened ${time}${until})`;
      } else {
        body = `Scheduled ${time}`;
      }
      if (medicine.dosage) body += ` · ${medicine.dosage}`;

      desired.push({
        id: numericId(r.id),
        title: `${medicine.name} — time to take`,
        body,
        schedule: { at: new Date(r.scheduledTime), allowWhileIdle: true },
        extra: { reminderId: r.id },
        channelId: CHANNEL_ID,
      });
    }

    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }
    if (desired.length > 0) {
      await LocalNotifications.schedule({ notifications: desired });
    }
  } catch (err) {
    console.error('Native notification sync failed', err);
  }
}

/** Removes the native notification for one reminder (e.g. before ringing in-app). */
export async function cancelNativeNotification(reminderId: string): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    const pending = await LocalNotifications.getPending();
    const targets = pending.notifications.filter(
      (n) => (n.extra as { reminderId?: string } | null)?.reminderId === reminderId,
    );
    if (targets.length > 0) {
      await LocalNotifications.cancel({ notifications: targets });
    }
  } catch (err) {
    console.error('Failed to cancel native notification', err);
  }
}

/** Requests notification permission (Android 13+). Safe to call at startup. */
export async function requestNativeNotificationPermission(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await LocalNotifications.requestPermissions();
  } catch (err) {
    console.error('Notification permission request failed', err);
  }
}

/** Fires when the user taps a scheduled notification. */
export function onNativeNotificationTap(cb: (reminderId: string) => void): () => void {
  if (!isNativePlatform()) return () => undefined;
  const promise = LocalNotifications.addListener(
    'localNotificationActionPerformed',
    (e) => {
      const reminderId = (e.notification.extra as { reminderId?: string } | null)?.reminderId;
      if (reminderId) cb(reminderId);
    },
  );
  return () => {
    void promise.then((listener) => listener.remove());
  };
}

/** Fires when the app returns to the foreground. */
export function onNativeAppResume(cb: () => void): () => void {
  if (!isNativePlatform()) return () => undefined;
  const promise = App.addListener('appStateChange', (state) => {
    if (state.isActive) cb();
  });
  return () => {
    void promise.then((listener) => listener.remove());
  };
}