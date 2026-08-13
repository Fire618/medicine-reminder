import { useRef, useState } from 'react';
import { analyzeImageBlob } from '../vision/analyze';
import { compareVisualMetadata, MATCH_THRESHOLD } from '../vision/compare';
import type { VisualMetadata } from '../db/types';

type Loaded = {
  blob: Blob;
  meta: VisualMetadata;
  url: string;
};

function useImageLoader() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prevUrl = useRef<string | null>(null);

  const load = async (file: File) => {
    setError(null);
    try {
      const blob = await analyzeImageBlob(file);
      if (prevUrl.current) URL.revokeObjectURL(prevUrl.current);
      const url = URL.createObjectURL(file);
      prevUrl.current = url;
      setLoaded({ blob: file, meta: blob, url });
    } catch (err) {
      console.error(err);
      setError('Could not analyze that image.');
    }
  };

  return { loaded, error, load };
}

function pct(v: number): string {
  return `${(v * 100).toFixed(0)}%`;
}

export default function DevVision() {
  const reference = useImageLoader();
  const captured = useImageLoader();

  const result = reference.loaded || captured.loaded
    ? compareVisualMetadata(reference.loaded?.meta ?? null, captured.loaded?.meta ?? null)
    : null;

  return (
    <section aria-labelledby="dev-heading">
      <h1 id="dev-heading">Visual check test</h1>
      <p className="muted">
        Developer test tool. Upload a reference photo and a captured photo to inspect
        the local color/size/shape comparison. The visual check is a consistency
        check only — it never identifies a medicine.
      </p>

      <div className="dev-grid">
        <div className="card">
          <h2 className="card-label">Reference</h2>
          <input type="file" accept="image/*" onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void reference.load(f);
          }} />
          {reference.error && <p className="form-error">{reference.error}</p>}
          {reference.loaded && <img className="dev-img" src={reference.loaded.url} alt="Reference" />}
          {reference.loaded && <MetaTable meta={reference.loaded.meta} />}
        </div>

        <div className="card">
          <h2 className="card-label">Captured</h2>
          <input type="file" accept="image/*" onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void captured.load(f);
          }} />
          {captured.error && <p className="form-error">{captured.error}</p>}
          {captured.loaded && <img className="dev-img" src={captured.loaded.url} alt="Captured" />}
          {captured.loaded && <MetaTable meta={captured.loaded.meta} />}
        </div>
      </div>

      {result && (
        <div className={`card ${result.match ? 'card--ok' : 'card--danger'}`}>
          <h2 className="card-label">Result</h2>
          <p className="dev-score">
            Score: <strong>{result.score.toFixed(2)}</strong>{' '}
            (threshold {MATCH_THRESHOLD})
          </p>
          <p className="dev-match">
            {result.referenceMissing || result.capturedMissing
              ? 'Both a reference and a captured image are required.'
              : result.match
                ? 'Visual match detected.'
                : 'Images could not be visually matched.'}
          </p>
          <ul className="plain-list">
            <li className="reminder-row"><span>Color</span><span>{pct(result.breakdown.color)}</span></li>
            <li className="reminder-row"><span>Histogram</span><span>{pct(result.breakdown.histogram)}</span></li>
            <li className="reminder-row"><span>Size</span><span>{pct(result.breakdown.size)}</span></li>
            <li className="reminder-row"><span>Shape</span><span>{pct(result.breakdown.shape)}</span></li>
            <li className="reminder-row"><span>dHash</span><span>{pct(result.breakdown.hash)}</span></li>
          </ul>
          <p className="muted">
            This score does not verify that the medicine is correct, safe, or the
            right dose. The user always makes the final decision.
          </p>
        </div>
      )}
    </section>
  );
}

function MetaTable({ meta }: { meta: VisualMetadata }) {
  return (
    <p className="muted dev-meta">
      color rgb({meta.dominantColor.map((c) => c.toFixed(0)).join(', ')}) · size{' '}
      {pct(meta.sizeRatio)} · aspect {meta.aspectRatio.toFixed(2)}
      <br />
      dHash {meta.hash}
    </p>
  );
}
