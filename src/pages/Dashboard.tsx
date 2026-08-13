import { useLiveQuery } from 'dexie-react-hooks';
import {
  getMissedReminders,
  getNextReminder,
  getTodayReminders,
  getUpcomingReminders,
} from '../reminders/queries';
import { formatTime } from '../utils/time';
import type { JoinedReminder } from '../reminders/queries';
import { WEEKDAYS_SHORT, formatDateStr } from '../utils/time';

function reminderTime(ts: number): string {
  return formatTime(new Date(ts));
}

function statusLabel(jr: JoinedReminder): string {
  const status = jr.reminder.status;
  if (status === 'pending' || status === 'snoozed') return 'Upcoming';
  if (status === 'missed') return 'Missed';
  if (status === 'taken') return 'Taken';
  if (status === 'skipped') return 'Skipped';
  return 'Dismissed';
}

export default function Dashboard() {
  const today = useLiveQuery(() => getTodayReminders());
  const upcoming = useLiveQuery(() => getUpcomingReminders(8));
  const missed = useLiveQuery(() => getMissedReminders());
  const next = useLiveQuery(() => getNextReminder());

  const loading = today === undefined || upcoming === undefined || missed === undefined;

  return (
    <section aria-labelledby="today-heading">
      <h1 id="today-heading">Today</h1>
      <p className="muted">{formatDateStr(new Date().toISOString().slice(0, 10))}</p>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          {next && (
            <div className="card next-dose" role="status">
              <span className="card-label">Next dose</span>
              <span className="next-dose__value">
                {next.medicine.name} at {reminderTime(next.reminder.scheduledTime)}
              </span>
            </div>
          )}

          {missed.length > 0 && (
            <div className="card card--danger">
              <h2 className="card-label">Missed</h2>
              <ul className="plain-list">
                {missed.map((jr) => (
                  <li key={jr.reminder.id} className="reminder-row">
                    <span>{jr.medicine.name}</span>
                    <span className="muted">{reminderTime(jr.reminder.scheduledTime)}</span>
                    <span className="badge badge--danger">Missed</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card">
            <h2 className="card-label">Today's schedule</h2>
            {today.length === 0 ? (
              <p className="muted">No medicines scheduled for today.</p>
            ) : (
              <ul className="plain-list">
                {today.map((jr) => {
                  const s = jr.reminder.status;
                  return (
                    <li key={jr.reminder.id} className="reminder-row">
                      <span>
                        {jr.medicine.name}
                        {jr.medicine.dosage ? <span className="muted"> · {jr.medicine.dosage}</span> : null}
                      </span>
                      <span className="muted">{reminderTime(jr.reminder.scheduledTime)}</span>
                      <span
                        className={
                          s === 'missed' ? 'badge badge--danger' : s === 'taken' ? 'badge badge--ok' : 'badge'
                        }
                      >
                        {statusLabel(jr)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {upcoming.length > 0 && (
            <div className="card">
              <h2 className="card-label">Upcoming</h2>
              <ul className="plain-list">
                {upcoming.map((jr) => (
                  <li key={jr.reminder.id} className="reminder-row">
                    <span>
                      {jr.medicine.name}
                      <span className="muted"> · {jr.medicine.dosage || 'no dosage'}</span>
                    </span>
                    <span className="muted">{reminderTime(jr.reminder.scheduledTime)}</span>
                    <span className="muted">{WEEKDAYS_SHORT[new Date(jr.reminder.scheduledTime).getDay()]}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
