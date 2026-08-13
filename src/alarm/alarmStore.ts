import { useSyncExternalStore } from 'react';

export type ActiveAlarm = {
  reminderId: string;
  medicineId: string;
  medicineName: string;
  dosage: string;
  scheduledTime: number;
};

let active: ActiveAlarm | null = null;
const listeners = new Set<() => void>();

export function getActiveAlarm(): ActiveAlarm | null {
  return active;
}

export function setActiveAlarm(next: ActiveAlarm | null): void {
  active = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** React hook that re-renders whenever the active alarm changes. */
export function useAlarm(): ActiveAlarm | null {
  return useSyncExternalStore(subscribe, getActiveAlarm);
}
