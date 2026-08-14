import { useState, type FormEvent } from 'react';
import type { Frequency, Meal, MealWindows, Medicine, MedicineInput } from '../db/types';
import { WEEKDAYS_SHORT, addDaysToDateStr, todayStr } from '../utils/time';
import { DEFAULT_MEAL_WINDOWS, MEAL_LABELS, MEAL_ORDER } from '../reminders/schedule';
import ReferenceImagePicker from './ReferenceImagePicker';
import TimeField from './TimeField';
import { analyzeImageBlob } from '../vision/analyze';

type EndType = 'ongoing' | 'duration' | 'date';

type MedicineFormProps = {
  initial?: Medicine | null;
  onSubmit: (input: MedicineInput) => void | Promise<void>;
  onCancel: () => void;
};

function toInput(initial?: Medicine | null): {
  name: string;
  dosage: string;
  frequency: Frequency;
  daysOfWeek: number[];
  times: string[];
  meals: Meal[];
  mealWindows: MealWindows;
  startDate: string;
  endType: EndType;
  durationDays: string;
  endDate: string;
  referenceImage: Blob | null;
} {
  const today = todayStr();
  let endType: EndType = 'ongoing';
  let durationDays = '';
  let endDate = today;

  if (initial?.durationDays) {
    endType = 'duration';
    durationDays = String(initial.durationDays);
  } else if (initial?.endDate) {
    endType = 'date';
    endDate = initial.endDate;
  }

  return {
    name: initial?.name ?? '',
    dosage: initial?.dosage ?? '',
    frequency: initial?.frequency ?? 'daily',
    daysOfWeek: initial?.daysOfWeek ?? [],
    times: initial && initial.times.length > 0 ? [...initial.times] : ['09:00'],
    meals: initial?.meals ?? [],
    mealWindows: initial?.mealWindows ?? JSON.parse(JSON.stringify(DEFAULT_MEAL_WINDOWS)),
    startDate: initial?.startDate ?? today,
    endType,
    durationDays,
    endDate,
    referenceImage: initial?.referenceImage ?? null,
  };
}

export default function MedicineForm({ initial, onSubmit, onCancel }: MedicineFormProps) {
  const [form, setForm] = useState(() => toInput(initial));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleDay = (day: number) => {
    const has = form.daysOfWeek.includes(day);
    set(
      'daysOfWeek',
      has ? form.daysOfWeek.filter((d) => d !== day) : [...form.daysOfWeek, day].sort(),
    );
  };

  const setTime = (idx: number, value: string) => {
    const times = [...form.times];
    times[idx] = value;
    set('times', times);
  };

  const addTime = () => set('times', [...form.times, '12:00']);
  const removeTime = (idx: number) => {
    if (form.times.length > 1) set('times', form.times.filter((_, i) => i !== idx));
  };

  const toggleMeal = (meal: Meal) => {
    const has = form.meals.includes(meal);
    set('meals', has ? form.meals.filter((m) => m !== meal) : [...form.meals, meal]);
  };

  const setWindow = (meal: Meal, key: 'start' | 'end', value: string) => {
    set('mealWindows', {
      ...form.mealWindows,
      [meal]: { ...form.mealWindows[meal], [key]: value },
    });
  };

  const buildInput = (): MedicineInput | null => {
    const name = form.name.trim();
    if (!name) {
      setError('Please enter a medicine name.');
      return null;
    }
    if (form.frequency === 'before-meal') {
      if (form.meals.length === 0) {
        setError('Choose at least one meal to take this medicine before.');
        return null;
      }
      for (const meal of form.meals) {
        const w = form.mealWindows[meal];
        if (!w?.start || !w?.end) {
          setError(`Please set a reminder window for ${MEAL_LABELS[meal]}.`);
          return null;
        }
        if (w.end <= w.start) {
          setError(`${MEAL_LABELS[meal]} window end must be after its start.`);
          return null;
        }
      }
    } else {
      const times = form.times.filter((t) => t.length > 0);
      if (times.length === 0) {
        setError('Please set at least one reminder time.');
        return null;
      }
      if (form.frequency === 'custom-days' && form.daysOfWeek.length === 0) {
        setError('Please choose at least one day of the week.');
        return null;
      }
    }
    const start = form.startDate;
    if (!start) {
      setError('Please set a start date.');
      return null;
    }

    let endDate: string | null = null;
    let durationDays: number | null = null;

    if (form.endType === 'duration') {
      const days = Number(form.durationDays);
      if (!Number.isFinite(days) || days < 1) {
        setError('Duration must be at least 1 day.');
        return null;
      }
      durationDays = Math.floor(days);
      endDate = addDaysToDateStr(start, durationDays - 1);
    } else if (form.endType === 'date') {
      if (!form.endDate) {
        setError('Please set an end date.');
        return null;
      }
      if (form.endDate < start) {
        setError('End date must be on or after the start date.');
        return null;
      }
      endDate = form.endDate;
    }

    setError(null);
    const isBeforeMeal = form.frequency === 'before-meal';
    return {
      name,
      dosage: form.dosage.trim(),
      frequency: form.frequency,
      daysOfWeek:
        form.frequency === 'daily' || isBeforeMeal ? [] : form.daysOfWeek,
      times: isBeforeMeal ? [] : form.times.filter((t) => t.length > 0),
      meals: isBeforeMeal ? [...form.meals] : [],
      mealWindows: isBeforeMeal
        ? form.mealWindows
        : JSON.parse(JSON.stringify(DEFAULT_MEAL_WINDOWS)),
      startDate: start,
      endDate,
      durationDays,
      referenceImage: form.referenceImage,
      visualMetadata: initial?.visualMetadata ?? null,
      active: initial?.active ?? true,
    };
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const input = buildInput();
    if (!input) return;
    setSaving(true);
    try {
      if (input.referenceImage) {
        input.visualMetadata = await analyzeImageBlob(input.referenceImage).catch(() => null);
      } else {
        input.visualMetadata = null;
      }
      await onSubmit(input);
    } finally {
      setSaving(false);
    }
  };

  const days = WEEKDAYS_SHORT.map((label, i) => (
    <label key={i} className="day-chip">
      <input
        type="checkbox"
        checked={form.daysOfWeek.includes(i)}
        onChange={() => toggleDay(i)}
      />
      <span>{label}</span>
    </label>
  ));

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor="mf-name">Medicine name *</label>
        <input
          id="mf-name"
          type="text"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. Metformin"
          autoComplete="off"
        />
      </div>

      <div className="field">
        <label htmlFor="mf-dosage">Dosage (as entered by you)</label>
        <input
          id="mf-dosage"
          type="text"
          value={form.dosage}
          onChange={(e) => set('dosage', e.target.value)}
          placeholder="e.g. 500 mg tablet"
          autoComplete="off"
        />
      </div>

      <fieldset className="field">
        <legend>Frequency</legend>
        <div className="radio-row">
          <label>
            <input
              type="radio"
              name="mf-frequency"
              checked={form.frequency === 'daily'}
              onChange={() => set('frequency', 'daily')}
            />
            Every day
          </label>
          <label>
            <input
              type="radio"
              name="mf-frequency"
              checked={form.frequency === 'custom-days'}
              onChange={() => set('frequency', 'custom-days')}
            />
            Specific days
          </label>
          <label>
            <input
              type="radio"
              name="mf-frequency"
              checked={form.frequency === 'before-meal'}
              onChange={() => set('frequency', 'before-meal')}
            />
            Before meals
          </label>
        </div>
        {form.frequency === 'custom-days' && (
          <div className="day-chips" role="group" aria-label="Days of the week">
            {days}
          </div>
        )}
        {form.frequency === 'before-meal' && (
          <>
            <p className="muted">
              No fixed time — one gentle nudge when the meal window opens. Mark
              it taken whenever you actually take it before that meal.
            </p>
            <div className="day-chips" role="group" aria-label="Meals">
              {MEAL_ORDER.map((meal) => (
                <label key={meal} className="day-chip">
                  <input
                    type="checkbox"
                    checked={form.meals.includes(meal)}
                    onChange={() => toggleMeal(meal)}
                  />
                  <span>{MEAL_LABELS[meal]}</span>
                </label>
              ))}
            </div>
            {form.meals.map((meal) => (
              <div key={meal} className="field meal-window-field">
                <span className="meal-window-label">
                  {MEAL_LABELS[meal]} window
                </span>
                <div className="time-row">
                  <div className="field">
                    <span className="muted">Opens</span>
                    <TimeField
                      value={form.mealWindows[meal].start}
                      onChange={(v) => setWindow(meal, 'start', v)}
                    />
                  </div>
                  <div className="field">
                    <span className="muted">Closes</span>
                    <TimeField
                      value={form.mealWindows[meal].end}
                      onChange={(v) => setWindow(meal, 'end', v)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </fieldset>

      {form.frequency !== 'before-meal' && (
      <fieldset className="field">
        <legend>Reminder times</legend>
        <div className="time-list">
          {form.times.map((t, i) => (
            <div key={i} className="time-row">
              <TimeField
                value={t}
                label={`Reminder time ${i + 1}`}
                onChange={(v) => setTime(i, v)}
              />
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => removeTime(i)}
                disabled={form.times.length <= 1}
                aria-label={`Remove time ${i + 1}`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="btn" onClick={addTime}>
          + Add another time
        </button>
      </fieldset>
      )}

      <div className="field">
        <label htmlFor="mf-start">Start date *</label>
        <input
          id="mf-start"
          type="date"
          value={form.startDate}
          onChange={(e) => set('startDate', e.target.value)}
        />
      </div>

      <fieldset className="field">
        <legend>End date or duration</legend>
        <div className="radio-row">
          <label>
            <input
              type="radio"
              name="mf-endtype"
              checked={form.endType === 'ongoing'}
              onChange={() => set('endType', 'ongoing')}
            />
            No end date
          </label>
          <label>
            <input
              type="radio"
              name="mf-endtype"
              checked={form.endType === 'duration'}
              onChange={() => set('endType', 'duration')}
            />
            For a duration
          </label>
          <label>
            <input
              type="radio"
              name="mf-endtype"
              checked={form.endType === 'date'}
              onChange={() => set('endType', 'date')}
            />
            End on a date
          </label>
        </div>
        {form.endType === 'duration' && (
          <div className="field">
            <label htmlFor="mf-duration">Duration (days)</label>
            <input
              id="mf-duration"
              type="number"
              min={1}
              value={form.durationDays}
              onChange={(e) => set('durationDays', e.target.value)}
            />
          </div>
        )}
        {form.endType === 'date' && (
          <div className="field">
            <label htmlFor="mf-end">End date</label>
            <input
              id="mf-end"
              type="date"
              value={form.endDate}
              onChange={(e) => set('endDate', e.target.value)}
            />
          </div>
        )}
      </fieldset>

      <fieldset className="field">
        <legend>Reference photo (optional)</legend>
        <ReferenceImagePicker
          value={form.referenceImage}
          onChange={(blob) => set('referenceImage', blob)}
        />
      </fieldset>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Add medicine'}
        </button>
      </div>
    </form>
  );
}
