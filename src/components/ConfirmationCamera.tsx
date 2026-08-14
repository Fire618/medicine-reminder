import { useCameraStream } from '../camera/useCameraStream';

type ConfirmationCameraProps = {
  error?: string | null;
  onCapture: (blob: Blob) => void;
  onCancel: () => void;
};

export default function ConfirmationCamera({ error, onCapture, onCancel }: ConfirmationCameraProps) {
  const { videoRef, starting, capture, error: streamError } = useCameraStream();

  const handleCapture = async () => {
    const blob = await capture();
    if (blob) onCapture(blob);
  };

  return (
    <div className="confirm-camera">
      {starting ? (
        <p className="muted">Starting camera…</p>
      ) : streamError ? (
        <div className="form-error-block" role="alert">
          <p>{streamError}</p>
          <button type="button" className="btn" onClick={onCancel}>
            Go back
          </button>
        </div>
      ) : (
        <>
          {error && <p className="form-error" role="alert">{error}</p>}
          <video
            ref={videoRef}
            className="camera-preview"
            autoPlay
            playsInline
            muted
            aria-label="Live camera preview"
          />
          <div className="alarm-actions">
            <button type="button" className="btn btn--primary" onClick={handleCapture}>
              Capture photo
            </button>
            <button type="button" className="btn" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
