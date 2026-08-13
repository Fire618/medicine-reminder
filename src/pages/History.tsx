import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getHistoryEntries } from '../reminders/queries';
import { toDateStr, formatTime } from '../utils/time';
import { STATUS_LABELS, VERIFICATION_LABELS } from '../utils/status';
import type { HistoryEntry, ReminderStatus } from '../db/types';

type Filter = ReminderStatus | 'all';

const FILTERS: Filter[] = ['all', 'taken', 'missed', 'skipped', 'snoozed', 'dismissed'];

const STATUS_CLASS: Record<ReminderStatus, string> = {
  pending: 'badge',
  taken: 'badge badge--ok',
  missed: 'badge badge--danger',
  skipped: 'badge',
  snoozed: 'badge',
  dismissed: 'badge',
};

export default function History() {
  const [filter, setFilter] = useState<Filter>('all');
  const entries = useLiveQuery(() => getHistoryEntries(500));

  const groups = useMemo(() => {
    if (!entries) return [];
    const list = filter === 'all' ? entries : entries.filter((e) => e.status === filter);
    const map = new Map<string, HistoryEntry[]>();
    for (const e of list) {
      const day = toDateStr(new Date(e.scheduledTime));
      const arr = map.get(day) ?? [];
      arr.push(e);
      map.set(day, arr);
    }
    return Array.from(map.entries());
  }, [entries, filter]);

  return (
    <section aria-labelledby="history-heading">
      <div className="page-heading">
        <h1 id="history-heading">History</h1>
      </div>

      <div className="filter-pills" role="group" aria-label="Filter history">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={f === filter ? 'pill pill--active' : 'pill'}
            onClick={() => setFilter(f)}
            aria-pressed={f === filter}
          >
            {f === 'all' ? 'All' : STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      {entries === undefined ? (
        <p className="muted">Loading…</p>
      ) : groups.length === 0 ? (
        <p className="muted">
          {entries.length === 0
            ? 'No medication history yet. It will build up as you take, skip, or miss doses.'
            : 'No entries match this filter.'}
        </p>
      ) : (
        groups.map(([day, list]) => (
          <div key={day} className="card history-group">
            <h2 className="card-label">{formatHistoryDate(day)}</h2>
            <ul className="plain-list">
              {list.map((e) => (
                <li key={e.id} className="history-row">
                  <div>
                    <span className="history-row__name">{e.medicineName}</span>
                    <span className="muted">
                      {' '}
                      · {formatTime(new Date(e.scheduledTime))}
                      {e.completedAt
                        ? ` · done ${formatTime(new Date(e.completedAt))}`
                        : ''}
                    </span>
                  </div>
                  <div className="history-row__badges">
                    <span className={STATUS_CLASS[e.status]}>{STATUS_LABELS[e.status]}</span>
                    <span className="badge badge--neutral">{VERIFICATION_LABELS[e.verificationStatus]}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

function formatHistoryDate(day: string): string {
  return new Date(day + 'T12:00:00').toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
