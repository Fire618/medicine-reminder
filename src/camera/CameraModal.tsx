import { useCameraStream } from './useCameraStream';

type CameraModalProps = {
  title: string;
  onCapture: (blob: Blob) => void;
  onClose: () => void;
};

export default function CameraModal({ title, onCapture, onClose }: CameraModalProps) {
  const { videoRef, error, starting, capture } = useCameraStream();

  const handleCapture = async () => {
    const blob = await capture();
    if (blob) onCapture(blob);
  };

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div
        className="modal modal--camera"
        role="dialog"
        aria-modal="true"
        aria-labelledby="camera-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="camera-title">{title}</h2>
          <button type="button" className="btn btn--ghost" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="modal-body">
          {starting ? (
            <p className="muted">Starting camera…</p>
          ) : error ? (
            <div className="form-error-block" role="alert">
              <p>{error}</p>
              <button type="button" className="btn" onClick={onClose}>
                Close
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="camera-preview"
                playsInline
                muted
                aria-label="Live camera preview"
              />
              <div className="form-actions">
                <button type="button" className="btn" onClick={onClose}>
                  Cancel
                </button>
                <button type="button" className="btn btn--primary" onClick={handleCapture}>
                  Capture photo
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
