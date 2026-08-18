import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';
import { FullScreenAlarm, type ScheduledAlarm } from './alarmPlugin';
import { db } from '../db/db';
import { formatTime } from '../utils/time';
import { MEAL_LABELS } from '../reminders/schedule';
import type { Meal } from '../db/types';

const SYNC_HORIZON_MS = 14 * 24 * 60 * 60 * 1000;

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export type NotificationPermState = 'granted' | 'denied' | 'prompt';

function mealLabel(meal: Meal | null): string {
  return meal ? MEAL_LABELS[meal].toLowerCase() : 'meal';
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
    const status = await FullScreenAlarm.getStatus();
    return status.exactAlarm;
  } catch {
    return 'granted';
  }
}

/** Exact alarms are scheduled via setAlarmClock which needs no special permission. */
export async function requestExactAlarmPermission(): Promise<'granted' | 'denied'> {
  return checkExactAlarmSetting();
}

export async function isFullScreenAllowed(): Promise<boolean> {
  if (!isNativePlatform()) return true;
  try {
    const r = await FullScreenAlarm.isFullScreenAllowed();
    return r.allowed;
  } catch {
    return true;
  }
}

export async function requestFullScreenPermission(): Promise<boolean> {
  if (!isNativePlatform()) return true;
  try {
    const r = await FullScreenAlarm.requestFullScreen();
    return r.allowed;
  } catch {
    return true;
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
 * Reconciles the OS alarm schedule with the reminders stored on the device.
 * Runs on launch, on resume, and whenever reminders change. Alarms are
 * registered with AlarmManager (setAlarmClock), so they fire exactly on time
 * and survive the app being killed.
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

    const now = Date.now();
    const reminders = await db.reminders.toArray();
    const meds = await db.medicines.toArray();
    const medById = new Map(meds.map((m) => [m.id, m]));

    const desired: ScheduledAlarm[] = [];
    for (const r of reminders) {
      const statusOk = r.status === 'pending' || r.status === 'snoozed';
      // Past-due pending reminders are kept so the native alarm (which re-arms
      // itself every 60s) keeps nagging until the dose is confirmed.
      const inHorizon = r.scheduledTime <= now + SYNC_HORIZON_MS;
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
        reminderId: r.id,
        at: r.scheduledTime,
        title: `${medicine.name} — time to take`,
        body,
        gentle: Boolean(r.gentle),
        future: true,
      });
    }

    const desiredByRid = new Map(desired.map((d) => [d.reminderId, d]));
    const existing = await FullScreenAlarm.getPending();
    const existingByRid = new Map(existing.alarms.map((a) => [a.reminderId, a]));

    const toCancel: string[] = [];
    for (const rid of existingByRid.keys()) {
      if (!desiredByRid.has(rid)) toCancel.push(rid);
    }
    for (const rid of toCancel) {
      await cancelNativeNotification(rid);
    }

    let scheduled = 0;
    for (const d of desired) {
      const existing = existingByRid.get(d.reminderId);
      if (!existing) {
        await FullScreenAlarm.schedule({
          reminderId: d.reminderId,
          at: d.at,
          title: d.title,
          body: d.body,
          gentle: d.gentle,
        });
        scheduled += 1;
      } else if (existing.at !== d.at || existing.gentle !== d.gentle) {
        // Time changed (e.g. snoozed) — reschedule the OS alarm.
        await FullScreenAlarm.cancel({ reminderId: d.reminderId });
        await FullScreenAlarm.schedule({
          reminderId: d.reminderId,
          at: d.at,
          title: d.title,
          body: d.body,
          gentle: d.gentle,
        });
        scheduled += 1;
      }
    }

    lastSync = { at: Date.now(), ok: true };
    return {
      skipped: false,
      canceled: toCancel.length,
      scheduled,
      pending: (await FullScreenAlarm.getPending()).alarms.length,
    };
  } catch (err) {
    lastSync = { at: Date.now(), ok: false, error: err instanceof Error ? err.message : String(err) };
    console.error('Native alarm sync failed', err);
    return { ...empty, skipped: false };
  }
}

/** Keeps the display on and hides the system bars while a forced alarm shows. */
export async function enableAlarmUi(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await FullScreenAlarm.setAlarmUi({ on: true });
  } catch (err) {
    console.error('Failed to enable alarm UI', err);
  }
}

/** Removes the OS alarm for one reminder (e.g. after the dose is completed). */
export async function cancelNativeNotification(reminderId: string): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await FullScreenAlarm.cancel({ reminderId });
    await FullScreenAlarm.stopRingtone();
    await FullScreenAlarm.setAlarmUi({ on: false });
  } catch (err) {
    console.error('Failed to cancel native alarm', err);
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
  fullScreen: boolean;
  pendingCount: number;
  next: { title: string; body: string; at: number } | null;
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
      fullScreen: true,
      pendingCount: 0,
      next: null,
      lastSync: null,
    };
  }
  try {
    const [permission, status, pending] = await Promise.all([
      checkNotificationPermission(),
      FullScreenAlarm.getStatus(),
      FullScreenAlarm.getPending(),
    ]);
    const now = Date.now();
    const upcoming = pending.alarms
      .filter((a) => a.at >= now)
      .sort((a, b) => a.at - b.at);
    return {
      platform,
      notifications: permission,
      exactAlarm: status.exactAlarm,
      fullScreen: status.fullScreen,
      pendingCount: status.pending,
      next: upcoming[0]
        ? { title: upcoming[0].title, body: upcoming[0].body, at: upcoming[0].at }
        : null,
      lastSync,
    };
  } catch (err) {
    return {
      platform,
      notifications: 'denied',
      exactAlarm: 'denied',
      fullScreen: false,
      pendingCount: 0,
      next: null,
      lastSync: lastSync ?? {
        at: Date.now(),
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }
}