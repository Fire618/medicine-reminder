import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
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
import { analyzeImageBlob } from '../vision/analyze';
import { compareVisualMetadata, type VisualComparison } from '../vision/compare';
import ConfirmationCamera from './ConfirmationCamera';

type Flow = 'intro' | 'camera' | 'checking' | 'result';

export default function AlarmScreen() {
  const alarm = useAlarm();
  const [confirming, setConfirming] = useState(false);
  const [flow, setFlow] = useState<Flow>('intro');
  const [comparison, setComparison] = useState<VisualComparison | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const medicine = useLiveQuery(
    () => (alarm ? db.medicines.get(alarm.medicineId) : undefined),
    [alarm?.medicineId],
  );
  const hasReference = Boolean(medicine?.referenceImage && medicine?.visualMetadata);

  useEffect(() => {
    setConfirming(false);
    setFlow('intro');
    setComparison(null);
    setCaptureError(null);
  }, [alarm?.reminderId]);

  if (!alarm) return null;

  const stopAlarm = () => {
    stopAlarmSound();
    setActiveAlarm(null);
    setConfirming(false);
    setFlow('intro');
    setComparison(null);
    setCaptureError(null);
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
      setComparison(result);
      setFlow('result');
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
      <div className="alarm-card">
        <p className="alarm-eyebrow">Reminder due</p>
        <h2 id="alarm-title">Time to take your medicine</h2>
        <p className="alarm-medicine">{alarm.medicineName}</p>
        {alarm.dosage && <p className="muted">{alarm.dosage}</p>}
        <p className="muted">Scheduled {formatTime(new Date(alarm.scheduledTime))}</p>

        {flow === 'intro' && (
          <>
            {hasReference ? (
              <div className="alarm-note" role="note">
                Take a live photo of the medicine for a quick visual consistency
                check. The check only compares color and shape — it does not
                identify or guarantee the medicine.
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

        {flow === 'result' && comparison && (
          <div
            className={`alarm-result ${comparison.match ? 'alarm-result--ok' : 'alarm-result--warn'}`}
          >
            <p className="alarm-result__heading">
              {comparison.match
                ? 'Visual match detected'
                : 'The photo could not be visually matched'}
            </p>
            <p className="muted">Consistency score: {comparison.score.toFixed(2)}</p>

            {comparison.match ? (
              <div className="alarm-actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => resolve(() => markTaken(alarm.reminderId, 'match'))}
                >
                  Yes, I took this medicine
                </button>
                <button type="button" className="btn" onClick={() => setFlow('intro')}>
                  Back
                </button>
              </div>
            ) : (
              <>
                <p className="alarm-result__note">
                  This only means the photo doesn't look consistent with the
                  stored reference — the medicine itself may still be correct.
                  Nothing has been marked as taken and the reminder stays active.
                </p>
                <div className="alarm-actions">
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => setFlow('camera')}
                  >
                    Retake photo
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
              </>
            )}

            <p className="muted alarm-actions-note">
              The visual check is a convenience comparison only. It cannot
              identify a medicine, verify its safety, or confirm the correct
              dose. Always confirm from the label or packaging.
            </p>
          </div>
        )}

        <p className="muted alarm-actions-note">
          Only confirming “taken” records the dose as taken. Snooze, Skip and
          Dismiss do not.
        </p>
      </div>
    </div>
  );
}
