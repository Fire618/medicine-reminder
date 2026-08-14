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

export type NotificationPermState = 'granted' | 'denied' | 'prompt';

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

/**
 * The notification channel must NOT be given a `sound`: the plugin maps it to
 * a raw resource URI (android.resource://<pkg>/raw/<name>) and "default" points
 * at a resource that does not exist, which silently silences the whole
 * channel. Leaving it unset makes Android use the system default sound.
 */
async function ensureChannel(): Promise<void> {
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Medicine reminders',
      description: 'Reminders for scheduled doses',
      importance: 5,
      vibration: true,
      visibility: 1,
    });
  } catch (err) {
    console.error('Failed to create notification channel', err);
  }
}

export async function checkNotificationPermission(): Promise<NotificationPermState> {
  if (!isNativePlatform()) return 'prompt';
  try {
    const status = await LocalNotifications.checkPermissions();
    return (status.display as NotificationPermState) ?? 'denied';
  } catch {
    return 'denied';
  }
}

export async function requestNativeNotificationPermission(): Promise<NotificationPermState> {
  if (!isNativePlatform()) return 'prompt';
  try {
    const status = await LocalNotifications.requestPermissions();
    return (status.display as NotificationPermState) ?? 'denied';
  } catch {
    return 'denied';
  }
}

export async function checkExactAlarmSetting(): Promise<'granted' | 'denied'> {
  if (!isNativePlatform()) return 'granted';
  try {
    const status = await LocalNotifications.checkExactNotificationSetting();
    return (status.exact_alarm as 'granted' | 'denied') ?? 'denied';
  } catch {
    return 'granted';
  }
}

/** Opens the system "Alarms & reminders" settings screen (Android 12+). */
export async function requestExactAlarmPermission(): Promise<'granted' | 'denied'> {
  if (!isNativePlatform()) return 'granted';
  try {
    const status = await LocalNotifications.changeExactNotificationSetting();
    return (status.exact_alarm as 'granted' | 'denied') ?? 'denied';
  } catch {
    return 'granted';
  }
}

export type NativeSyncResult = {
  skipped: boolean;
  canceled: number;
  scheduled: number;
  pending: number;
};

let lastSync: { at: number; ok: boolean; error?: string } | null = null;

/**
 * Reconciles the OS notification schedule with the reminders currently stored
 * on the device. Runs on launch, on resume, and whenever reminders change.
 * Only schedules/cancels the difference, so a transient failure cannot wipe
 * the whole schedule. Notifications survive the app being killed because they
 * are registered with the OS AlarmManager.
 */
export async function syncNativeNotifications(): Promise<NativeSyncResult> {
  const empty: NativeSyncResult = { skipped: true, canceled: 0, scheduled: 0, pending: 0 };
  if (!isNativePlatform()) return empty;
  try {
    const permission = await checkNotificationPermission();
    if (permission !== 'granted') {
      lastSync = { at: Date.now(), ok: false, error: `notifications ${permission}` };
      return { ...empty, skipped: false };
    }

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

    const desiredById = new Map(desired.map((d) => [d.extra.reminderId as string, String(d.id)]));
    const pending = await LocalNotifications.getPending();
    const existingByRid = new Map<string, LocalNotificationSchema>();
    for (const n of pending.notifications) {
      const rid = (n.extra as { reminderId?: string } | null)?.reminderId;
      if (rid) existingByRid.set(rid, n);
    }

    const toCancel: LocalNotificationSchema[] = [];
    for (const [rid, n] of existingByRid) {
      if (!desiredById.has(rid)) toCancel.push(n);
    }
    if (toCancel.length > 0) {
      await LocalNotifications.cancel({ notifications: toCancel });
    }

    const toSchedule: LocalNotificationSchema[] = [];
    for (const d of desired) {
      const rid = d.extra.reminderId as string;
      if (!existingByRid.has(rid)) toSchedule.push(d);
    }
    if (toSchedule.length > 0) {
      await LocalNotifications.schedule({ notifications: toSchedule });
    }

    lastSync = { at: Date.now(), ok: true };
    return {
      skipped: false,
      canceled: toCancel.length,
      scheduled: toSchedule.length,
      pending: pending.notifications.length - toCancel.length + toSchedule.length,
    };
  } catch (err) {
    lastSync = { at: Date.now(), ok: false, error: err instanceof Error ? err.message : String(err) };
    console.error('Native notification sync failed', err);
    return { ...empty, skipped: false };
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

export type NativeStatus = {
  platform: boolean;
  notifications: NotificationPermState;
  exactAlarm: 'granted' | 'denied';
  pendingCount: number;
  next: { title: string; body: string; at: number } | null;
  nextPending: { title: string; body: string; at: number } | null;
  lastSync: { at: number; ok: boolean; error?: string } | null;
};

/** Live status for the in-app diagnostics card. */
export async function getNativeStatus(): Promise<NativeStatus> {
  const platform = isNativePlatform();
  if (!platform) {
    return {
      platform,
      notifications: 'prompt',
      exactAlarm: 'granted',
      pendingCount: 0,
      next: null,
      nextPending: null,
      lastSync: null,
    };
  }
  try {
    const [permission, exactAlarm, pending] = await Promise.all([
      checkNotificationPermission(),
      checkExactAlarmSetting(),
      LocalNotifications.getPending(),
    ]);
    const now = Date.now();
    type PendingEntry = { title: string; body: string; at: number | null; rid?: string };
    const upcoming = pending.notifications
      .map<PendingEntry>((n) => ({
        title: n.title,
        body: n.body,
        at: n.schedule?.at ? n.schedule.at.getTime() : null,
        rid: (n.extra as { reminderId?: string } | null)?.reminderId,
      }))
      .filter((n): n is PendingEntry & { at: number } => n.at !== null && n.at >= now)
      .sort((a, b) => a.at - b.at);
    return {
      platform,
      notifications: permission,
      exactAlarm,
      pendingCount: pending.notifications.length,
      next: upcoming[0] ? { title: upcoming[0].title, body: upcoming[0].body, at: upcoming[0].at } : null,
      nextPending: null,
      lastSync,
    };
  } catch (err) {
    return {
      platform,
      notifications: 'denied',
      exactAlarm: 'denied',
      pendingCount: 0,
      next: null,
      nextPending: null,
      lastSync: lastSync ?? { at: Date.now(), ok: false, error: err instanceof Error ? err.message : String(err) },
    };
  }
}