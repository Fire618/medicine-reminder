import { useRef } from 'react';
import { useCameraStream } from '../camera/useCameraStream';

type ConfirmationCameraProps = {
  error?: string | null;
  onCapture: (blob: Blob) => void;
  onCancel: () => void;
};

export default function ConfirmationCamera({ error, onCapture, onCancel }: ConfirmationCameraProps) {
  const { videoRef, starting, capture, error: streamError } = useCameraStream();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleCapture = async () => {
    const blob = await capture();
    if (blob) onCapture(blob);
  };

  const handleFile = (file: File | undefined) => {
    if (file) onCapture(file);
  };

  return (
    <div className="confirm-camera">
      {starting && <p className="muted">Starting camera…</p>}
      {streamError && (
        <div className="form-error-block" role="alert">
          <p>{streamError}</p>
          <div className="alarm-actions">
            <button type="button" className="btn btn--primary" onClick={() => fileRef.current?.click()}>
              Choose photo instead
            </button>
            <button type="button" className="btn" onClick={onCancel}>
              Go back
            </button>
          </div>
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <video
        ref={videoRef}
        className="camera-preview"
        autoPlay
        playsInline
        muted
        aria-label="Live camera preview"
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <div className="alarm-actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={handleCapture}
          disabled={starting || Boolean(streamError)}
        >
          Capture photo
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
