import { registerPlugin } from '@capacitor/core';

export interface ScheduledAlarm {
  reminderId: string;
  at: number;
  title: string;
  body: string;
  gentle: boolean;
  future: boolean;
}

export interface NativeAlarmStatus {
  notifications: 'granted' | 'denied';
  exactAlarm: 'granted' | 'denied';
  fullScreen: boolean;
  pending: number;
}

export interface FullScreenAlarmPlugin {
  schedule(options: {
    reminderId: string;
    at: number;
    title: string;
    body: string;
    gentle: boolean;
  }): Promise<void>;
  cancel(options: { reminderId: string }): Promise<void>;
  stopRingtone(): Promise<void>;
  cancelAll(): Promise<void>;
  getPending(): Promise<{ alarms: ScheduledAlarm[] }>;
  getStatus(): Promise<NativeAlarmStatus>;
  isFullScreenAllowed(): Promise<{ allowed: boolean }>;
  requestFullScreen(): Promise<{ allowed: boolean }>;
  consumeLaunchReminder(): Promise<{ reminderId?: string }>;
  isAlarmActive(): Promise<{ active: boolean; reminderId?: string }>;
  setAlarmUi(options: { on: boolean }): Promise<void>;
}

/** On web this proxy rejects when called, so all callers must guard with isNativePlatform(). */
export const FullScreenAlarm = registerPlugin<FullScreenAlarmPlugin>('FullScreenAlarm');