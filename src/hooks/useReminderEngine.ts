import { useEffect } from 'react';
import { runReminderMaintenance, markMissedReminders } from '../reminders/engine';

const MAINTENANCE_INTERVAL_MS = 30_000;

/**
 * Starts the reminder engine for the lifetime of the app:
 * materializes upcoming reminders on startup and periodically marks
 * overdue pending reminders as missed.
 */
export function useReminderEngine(): void {
  useEffect(() => {
    let cancelled = false;

    runReminderMaintenance().catch((err) =>
      console.error('Reminder engine startup sync failed', err),
    );

    const interval = window.setInterval(async () => {
      if (cancelled) return;
      try {
        await markMissedReminders();
      } catch (err) {
        console.error('Reminder maintenance tick failed', err);
      }
    }, MAINTENANCE_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);
}
