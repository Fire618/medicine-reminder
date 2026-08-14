type TimeFieldProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
};

function parse(value: string): { h: number; m: number } {
  const [h, m] = value.split(':').map(Number);
  return { h: Number.isFinite(h) ? h : 0, m: Number.isFinite(m) ? m : 0 };
}

function fmt(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function Stepper({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (next: number) => void;
  label: string;
}) {
  return (
    <div className="time-stepper">
      <button
        type="button"
        className="time-stepper__btn"
        onClick={() => onChange(value - 1)}
        aria-label={`${label} down`}
      >
        −
      </button>
      <span className="time-stepper__value">{String(value).padStart(2, '0')}</span>
      <button
        type="button"
        className="time-stepper__btn"
        onClick={() => onChange(value + 1)}
        aria-label={`${label} up`}
      >
        +
      </button>
    </div>
  );
}

/**
 * A stepper-based time entry that avoids the native time picker, whose
 * confirm button is missing/awkward on several Android browsers.
 */
export default function TimeField({ value, onChange, label }: TimeFieldProps) {
  const { h, m } = parse(value);
  return (
    <div className="time-field" role="group" aria-label={label ?? 'Time'}>
      <Stepper value={h} label="Hour" onChange={(v) => onChange(fmt((v + 24) % 24, m))} />
      <span className="time-field__sep" aria-hidden="true">
        :
      </span>
      <Stepper value={m} label="Minute" onChange={(v) => onChange(fmt(h, (v + 60) % 60))} />
    </div>
  );
}