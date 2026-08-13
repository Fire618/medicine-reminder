import { useEffect, useRef, useState } from 'react';
import { cameraError, canvasToThumbnailBlob } from './utils';

type CameraModalProps = {
  title: string;
  onCapture: (blob: Blob) => void;
  onClose: () => void;
};

export default function CameraModal({ title, onCapture, onClose }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new DOMException('Camera API unavailable', 'NotSupportedError');
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {
            /* keep silent; capture still works once loaded */
          });
        }
      } catch (e) {
        if (!cancelled) setError(cameraError(e));
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (!video.videoWidth || !video.videoHeight) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToThumbnailBlob(canvas);
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
              <canvas ref={canvasRef} hidden aria-hidden="true" />
              <div className="form-actions">
                <button type="button" className="btn" onClick={onClose}>
                  Cancel
                </button>
                <button type="button" className="btn btn--primary" onClick={capture}>
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
