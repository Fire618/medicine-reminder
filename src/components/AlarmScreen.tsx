import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { setActiveAlarm, useAlarm } from '../alarm/alarmStore';
import { stopAlarmSound } from '../alarm/sound';
import { checkDueAlarm } from '../alarm/useAlarmController';
import { focusFirst, useFocusTrap } from '../hooks/useFocusTrap';
import {
  SNOOZE_MINUTES,
  dismissReminder,
  markTaken,
  skipReminder,
  snoozeReminder,
} from '../reminders/actions';
import { formatTime } from '../utils/time';
import { analyzeImageBlob } from '../vision/analyze';
import { compareVisualMetadata, type VisualComparison } from '../vision/compare';
import ConfirmationCamera from './ConfirmationCamera';

type Flow = 'intro' | 'camera' | 'checking';

export default function AlarmScreen() {
  const alarm = useAlarm();
  const cardRef = useRef<HTMLDivElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [flow, setFlow] = useState<Flow>('intro');
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<VisualComparison | null>(null);

  useFocusTrap(cardRef, Boolean(alarm) || Boolean(completed));

  const medicine = useLiveQuery(
    () => (alarm ? db.medicines.get(alarm.medicineId) : undefined),
    [alarm?.medicineId],
  );
  const hasReference = Boolean(medicine?.referenceImage && medicine?.visualMetadata);

  useEffect(() => {
    setConfirming(false);
    setFlow('intro');
    setCaptureError(null);
    setCompleted(null);
  }, [alarm?.reminderId]);

  useEffect(() => {
    if (alarm) focusFirst(cardRef.current);
  }, [alarm?.reminderId, flow]);

  if (completed && !alarm) {
    return (
      <div className="alarm-overlay" role="alertdialog" aria-modal="true">
        <div ref={cardRef} className="alarm-card">
          <p className="alarm-eyebrow">Done</p>
          <h2 id="alarm-title">Dose recorded as taken</h2>
          <p className="muted">
            {completed.match
              ? `Visual match detected · consistency ${completed.score.toFixed(2)}.`
              : 'Photo captured — the dose was recorded as taken.'}
          </p>
          <div className="alarm-actions">
            <button type="button" className="btn btn--primary" onClick={() => setCompleted(null)}>
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!alarm) return null;

  const stopAlarm = () => {
    stopAlarmSound();
    setActiveAlarm(null);
    setConfirming(false);
    setFlow('intro');
    setCaptureError(null);
    setCompleted(null);
  };

  const resolve = async (action: () => Promise<void>) => {
    stopAlarm();
    try {
      await action();
    } finally {
      await checkDueAlarm();
    }
  };

  const handleCapture = async (blob: Blob) => {
    setFlow('checking');
    setCaptureError(null);
    try {
      const capturedMeta = await analyzeImageBlob(blob);
      const result = compareVisualMetadata(medicine?.visualMetadata ?? null, capturedMeta);
      const verification = result.match ? 'match' : 'no-match';
      // Record the dose and stop the alarm the moment a photo is captured.
      await markTaken(alarm.reminderId, verification);
      stopAlarmSound();
      setActiveAlarm(null);
      setCompleted(result);
    } catch (err) {
      console.error('Photo analysis failed', err);
      setCaptureError('The photo could not be analyzed. Please try again.');
      setFlow('camera');
    }
  };

  return (
    <div
      className="alarm-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="alarm-title"
    >
      <div ref={cardRef} className="alarm-card">
        <p className="alarm-eyebrow">Reminder due</p>
        <h2 id="alarm-title">Time to take your medicine</h2>
        <p className="alarm-medicine">{alarm.medicineName}</p>
        {alarm.dosage && <p className="muted">{alarm.dosage}</p>}
        <p className="muted">Scheduled {formatTime(new Date(alarm.scheduledTime))}</p>

        {flow === 'intro' && (
          <>
            {hasReference ? (
              <div className="alarm-note" role="note">
                Take a live photo of the medicine. The alarm stops as soon as
                the photo is captured and the dose is recorded as taken.
              </div>
            ) : (
              <div className="alarm-note" role="note">
                No reference photo is set for this medicine, so no visual check
                is available. You can confirm taking it manually.
              </div>
            )}

            {confirming ? (
              <div className="alarm-confirm">
                <p>
                  <strong>Please confirm:</strong> have you taken {alarm.medicineName}?
                </p>
                <div className="alarm-actions">
                  <button type="button" className="btn" onClick={() => setConfirming(false)}>
                    Go back
                  </button>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => resolve(() => markTaken(alarm.reminderId, 'none'))}
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
                  onClick={() => (hasReference ? setFlow('camera') : setConfirming(true))}
                >
                  {hasReference ? 'Take photo to confirm' : 'I took this medicine'}
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
          </>
        )}

        {flow === 'camera' && (
          <ConfirmationCamera
            error={captureError}
            onCapture={handleCapture}
            onCancel={() => setFlow('intro')}
          />
        )}

        {flow === 'checking' && (
          <div className="alarm-checking" role="status">
            <p className="muted">Analyzing photo…</p>
          </div>
        )}

        <p className="muted alarm-actions-note">
          Capturing a photo records the dose as taken and stops the alarm.
          Snooze, Skip and Dismiss do not record it as taken.
        </p>
      </div>
    </div>
  );
}