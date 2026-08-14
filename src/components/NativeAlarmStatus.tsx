import { useEffect, useState } from 'react';
import { formatTime } from '../utils/time';
import {
  getNativeStatus,
  isNativePlatform,
  requestExactAlarmPermission,
  requestNativeNotificationPermission,
  syncNativeNotifications,
  type NativeStatus,
} from '../native/notifications';

function badge(state: string | null): string {
  if (state === 'granted') return 'badge badge--ok';
  if (state === 'denied') return 'badge badge--danger';
  return 'badge badge--neutral';
}

export default function NativeAlarmStatus() {
  const [status, setStatus] = useState<NativeStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    void getNativeStatus().then(setStatus);
  };

  useEffect(() => {
    if (!isNativePlatform()) return;
    refresh();
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  if (!isNativePlatform()) return null;
  if (!status) return null;

  const enableNotifications = async () => {
    setBusy(true);
    try {
      const permission = await requestNativeNotificationPermission();
      if (permission === 'granted') {
        await syncNativeNotifications();
      }
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const enableExactAlarm = async () => {
    setBusy(true);
    try {
      await requestExactAlarmPermission();
      await syncNativeNotifications();
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const problems: string[] = [];
  if (status.notifications !== 'granted') {
    problems.push('Notifications are disabled — alarms cannot fire.');
  }
  if (status.exactAlarm === 'denied') {
    problems.push(
      'Exact alarms are off — scheduled alarms may be delayed by the phone (Android 14+).',
    );
  }
  if (status.pendingCount === 0 && status.notifications === 'granted') {
    problems.push('No alarms are scheduled yet.');
  }

  return (
    <div className="card">
      <h2 className="card-label">Alarm status (Android app)</h2>

      {problems.length > 0 && (
        <ul className="plain-list">
          {problems.map((p) => (
            <li key={p} className="muted" style={{ margin: '0 0 0.5rem' }}>
              {p}
            </li>
          ))}
        </ul>
      )}

      <p style={{ margin: '0 0 0.5rem' }}>
        Notifications: <span className={badge(status.notifications)}>{status.notifications}</span>
        {status.notifications !== 'granted' && (
          <button
            type="button"
            className="btn btn--compact"
            disabled={busy}
            onClick={enableNotifications}
          >
            Allow
          </button>
        )}
      </p>

      <p style={{ margin: '0 0 0.5rem' }}>
        Exact alarms: <span className={badge(status.exactAlarm)}>{status.exactAlarm}</span>
        {status.exactAlarm === 'denied' && (
          <button
            type="button"
            className="btn btn--compact"
            disabled={busy}
            onClick={enableExactAlarm}
          >
            Enable
          </button>
        )}
      </p>

      <p style={{ margin: '0 0 0.5rem' }}>
        Scheduled alarms: <strong>{status.pendingCount}</strong>
        {status.next && (
          <span className="muted">
            {' '}
            · next: {status.next.title} at {formatTime(new Date(status.next.at))}
          </span>
        )}
      </p>

      {status.lastSync && (
        <p className="muted" style={{ margin: '0 0 0.5rem' }}>
          Last sync {status.lastSync.ok ? 'OK' : 'FAILED'} at{' '}
          {formatTime(new Date(status.lastSync.at))}
          {status.lastSync.error ? ` (${status.lastSync.error})` : ''}
        </p>
      )}

      <button
        type="button"
        className="btn btn--ghost btn--compact"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await syncNativeNotifications();
          } finally {
            setBusy(false);
            refresh();
          }
        }}
      >
        Re-sync now
      </button>
    </div>
  );
}