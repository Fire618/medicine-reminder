import { useLiveQuery } from 'dexie-react-hooks';
import {
  getDailyAdherence,
  getMissedReminders,
  getNextReminder,
  getTodayReminders,
  getUpcomingReminders,
} from '../reminders/queries';
import { formatTime, formatDateStr, WEEKDAYS_SHORT } from '../utils/time';
import { STATUS_LABELS } from '../utils/status';
import { markTaken } from '../reminders/actions';
import { MEAL_LABELS } from '../reminders/schedule';
import type { JoinedReminder } from '../reminders/queries';

function reminderTime(ts: number): string {
  return formatTime(new Date(ts));
}

function statusLabel(jr: JoinedReminder): string {
  return STATUS_LABELS[jr.reminder.status];
}

function statusClass(status: string): string {
  if (status === 'missed') return 'badge badge--danger';
  if (status === 'taken') return 'badge badge--ok';
  return 'badge';
}

function gentleTag(jr: JoinedReminder): string | null {
  if (!jr.reminder.gentle) return null;
  const meal = jr.reminder.meal ? MEAL_LABELS[jr.reminder.meal] : 'meal';
  if (jr.reminder.windowEnd && jr.reminder.windowEnd > Date.now()) {
    return `Before ${meal.toLowerCase()} · open until ${reminderTime(jr.reminder.windowEnd)}`;
  }
  return `Before ${meal.toLowerCase()}`;
}

export default function Dashboard() {
  const today = useLiveQuery(() => getTodayReminders());
  const upcoming = useLiveQuery(() => getUpcomingReminders(8));
  const missed = useLiveQuery(() => getMissedReminders());
  const next = useLiveQuery(() => getNextReminder());
  const adherence = useLiveQuery(() => getDailyAdherence(7));

  const loading = today === undefined || upcoming === undefined || missed === undefined || adherence === undefined;

  const takenToday = today?.filter((r) => r.reminder.status === 'taken').length ?? 0;
  const scheduledToday = today?.length ?? 0;
  const todayPct = scheduledToday > 0 ? (takenToday / scheduledToday) * 100 : 0;

  const overallTaken = adherence?.reduce((s, d) => s + d.taken, 0) ?? 0;
  const overallTotal = adherence?.reduce((s, d) => s + d.total, 0) ?? 0;
  const overallPct = overallTotal > 0 ? Math.round((overallTaken / overallTotal) * 100) : null;

  return (
    <section aria-labelledby="today-heading">
      <h1 id="today-heading">Today</h1>
      <p className="muted">{formatDateStr(new Date().toISOString().slice(0, 10))}</p>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <div className="card">
            <h2 className="card-label">Today</h2>
            {scheduledToday === 0 ? (
              <p className="muted">No medicines scheduled today.</p>
            ) : (
              <>
                <p>
                  <strong>{takenToday}</strong> of <strong>{scheduledToday}</strong>{' '}
                  scheduled doses taken today
                </p>
                <div
                  className="progress"
                  role="progressbar"
                  aria-valuenow={Math.round(todayPct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className="progress__fill" style={{ width: `${todayPct}%` }} />
                </div>
              </>
            )}
          </div>

          {overallPct !== null && (
            <div className="card">
              <h2 className="card-label">Last 7 days</h2>
              <div className="adherence-bars" aria-label="Daily adherence over the last 7 days">
                {adherence!.map((d) => {
                  const pct = d.total > 0 ? (d.taken / d.total) * 100 : 0;
                  const date = new Date(d.date + 'T12:00:00');
                  return (
                    <div key={d.date} className="adherence-day" title={`${WEEKDAYS_SHORT[date.getDay()]} ${d.date}: ${d.taken}/${d.total}`}>
                      <div className="adherence-bar">
                        <div
                          className="adherence-bar__fill"
                          style={{ height: `${d.total > 0 ? pct : 3}%` }}
                        />
                      </div>
                      <span className="muted">{WEEKDAYS_SHORT[date.getDay()]}</span>
                    </div>
                  );
                })}
              </div>
              <p className="muted">
                {overallPct}% of doses taken over the last 7 days.
              </p>
            </div>
          )}

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
                  const tag = gentleTag(jr);
                  const pending = jr.reminder.status === 'pending';
                  return (
                    <li key={jr.reminder.id} className="reminder-row">
                      <span>
                        {jr.medicine.name}
                        {jr.medicine.dosage ? (
                          <span className="muted"> · {jr.medicine.dosage}</span>
                        ) : null}
                        {tag ? <span className="muted"> · {tag}</span> : null}
                      </span>
                      <span className="muted">{reminderTime(jr.reminder.scheduledTime)}</span>
                      <span className={statusClass(jr.reminder.status)}>{statusLabel(jr)}</span>
                      {pending && (
                        <button
                          type="button"
                          className="btn btn--compact"
                          onClick={() => markTaken(jr.reminder.id, 'none')}
                        >
                          Mark taken
                        </button>
                      )}
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
