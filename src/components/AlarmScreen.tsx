import { useState } from 'react';
import { setActiveAlarm, useAlarm } from '../alarm/alarmStore';
import { stopAlarmSound } from '../alarm/sound';
import { checkDueAlarm } from '../alarm/useAlarmController';
import {
  SNOOZE_MINUTES,
  dismissReminder,
  markTaken,
  skipReminder,
  snoozeReminder,
} from '../reminders/actions';
import { formatTime } from '../utils/time';

export default function AlarmScreen() {
  const alarm = useAlarm();
  const [confirmingTaken, setConfirmingTaken] = useState(false);

  if (!alarm) return null;

  const resolve = async (action: () => Promise<void>) => {
    stopAlarmSound();
    setActiveAlarm(null);
    setConfirmingTaken(false);
    try {
      await action();
    } finally {
      await checkDueAlarm();
    }
  };

  return (
    <div
      className="alarm-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="alarm-title"
    >
      <div className="alarm-card">
        <p className="alarm-eyebrow">Reminder due</p>
        <h2 id="alarm-title">Time to take your medicine</h2>
        <p className="alarm-medicine">{alarm.medicineName}</p>
        {alarm.dosage && <p className="muted">{alarm.dosage}</p>}
        <p className="muted">Scheduled {formatTime(new Date(alarm.scheduledTime))}</p>

        <div className="alarm-note" role="note">
          Photo-based visual checking is not available yet, so you confirm manually.
          Taking a medicine is always your decision.
        </div>

        {confirmingTaken ? (
          <div className="alarm-confirm">
            <p>
              <strong>Please confirm:</strong> have you taken {alarm.medicineName}?
            </p>
            <div className="alarm-actions">
              <button type="button" className="btn" onClick={() => setConfirmingTaken(false)}>
                Go back
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => resolve(() => markTaken(alarm.reminderId))}
              >
                Yes, I took it
              </button>
            </div>
          </div>
        ) : (
          <div className="alarm-actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setConfirmingTaken(true)}
            >
              I took this medicine
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => resolve(() => snoozeReminder(alarm.reminderId))}
            >
              Snooze {SNOOZE_MINUTES} min
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => resolve(() => skipReminder(alarm.reminderId))}
            >
              Skip this dose
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => resolve(() => dismissReminder(alarm.reminderId))}
            >
              Dismiss
            </button>
          </div>
        )}

        <p className="muted alarm-actions-note">
          Only “I took this medicine” records the dose as taken. Snooze, Skip and
          Dismiss do not.
        </p>
      </div>
    </div>
  );
}
