import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import {
  createMedicine,
  deleteMedicine,
  setMedicineActive,
  updateMedicine,
} from '../db/medicines';
import type { Medicine, MedicineInput } from '../db/types';
import Modal from '../components/Modal';
import MedicineForm from '../components/MedicineForm';
import { WEEKDAYS_SHORT, formatDateStr } from '../utils/time';
import { MEAL_LABELS } from '../reminders/schedule';

type Editing = { mode: 'add' } | { mode: 'edit'; medicine: Medicine } | null;

function frequencyLabel(m: Medicine): string {
  if (m.frequency === 'before-meal') {
    const meals = (m.meals ?? []).map((meal) => MEAL_LABELS[meal]);
    return meals.length > 0 ? `Before ${meals.join(' / ')}` : 'Before meals';
  }
  if (m.frequency === 'daily') return 'Every day';
  if (m.daysOfWeek.length === 7) return 'Every day';
  return m.daysOfWeek.map((d) => WEEKDAYS_SHORT[d]).join(', ');
}

function scheduleMeta(m: Medicine): string {
  if (m.frequency === 'before-meal') {
    return (m.meals ?? [])
      .map((meal) => {
        const w = m.mealWindows?.[meal];
        return w ? `${MEAL_LABELS[meal]} ${w.start}–${w.end}` : MEAL_LABELS[meal];
      })
      .join(', ');
  }
  return m.times.join(', ');
}

export default function Medicines() {
  const [editing, setEditing] = useState<Editing>(null);
  const [confirmDelete, setConfirmDelete] = useState<Medicine | null>(null);
  const [error, setError] = useState<string | null>(null);

  const medicines = useLiveQuery(() =>
    db.medicines.orderBy('updatedAt').reverse().toArray(),
  );

  const handleSave = async (input: MedicineInput) => {
    setError(null);
    try {
      if (editing?.mode === 'edit') {
        await updateMedicine(editing.medicine.id, input);
      } else {
        await createMedicine(input);
      }
      setEditing(null);
    } catch (err) {
      console.error('Failed to save medicine', err);
      setError('Could not save the medicine. Please try again.');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteMedicine(confirmDelete.id);
      setConfirmDelete(null);
    } catch (err) {
      console.error('Failed to delete medicine', err);
      setError('Could not delete the medicine. Please try again.');
    }
  };

  const toggleActive = async (m: Medicine) => {
    try {
      await setMedicineActive(m.id, !m.active);
    } catch (err) {
      console.error('Failed to update medicine', err);
      setError('Could not update the medicine. Please try again.');
    }
  };

  return (
    <section aria-labelledby="medicines-heading">
      <div className="page-heading">
        <h1 id="medicines-heading">Medicines</h1>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => setEditing({ mode: 'add' })}
        >
          Add medicine
        </button>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      {medicines === undefined ? (
        <p className="muted">Loading…</p>
      ) : medicines.length === 0 ? (
        <p className="muted">
          No medicines yet. Add your first medicine to get started.
        </p>
      ) : (
        <ul className="medicine-list">
          {medicines.map((m) => (
            <li key={m.id} className={`medicine-card${m.active ? '' : ' medicine-card--inactive'}`}>
              <div className="medicine-card__info">
                <h2 className="medicine-card__name">{m.name}</h2>
                {m.dosage && <p className="muted">{m.dosage}</p>}
                <p className="medicine-card__meta">
                  {frequencyLabel(m)} &middot; {scheduleMeta(m)}
                </p>
                <p className="muted medicine-card__meta">
                  {formatDateStr(m.startDate)}
                  {m.endDate ? ` – ${formatDateStr(m.endDate)}` : ' – ongoing'}
                </p>
              </div>
              <div className="medicine-card__actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => toggleActive(m)}
                  aria-pressed={m.active}
                >
                  {m.active ? 'Pause' : 'Resume'}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setEditing({ mode: 'edit', medicine: m })}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => setConfirmDelete(m)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <Modal
          title={editing.mode === 'edit' ? 'Edit medicine' : 'Add medicine'}
          onClose={() => setEditing(null)}
        >
          <MedicineForm
            initial={editing.mode === 'edit' ? editing.medicine : null}
            onSubmit={handleSave}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal
          title="Delete medicine"
          onClose={() => setConfirmDelete(null)}
        >
          <p>
            Delete <strong>{confirmDelete.name}</strong>? This also deletes its
            reminders and medication history.
          </p>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setConfirmDelete(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn--danger" onClick={handleDelete}>
              Delete
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
