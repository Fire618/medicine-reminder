import { useEffect, useRef, useState } from 'react';
import { cameraError, canvasToThumbnailBlob } from './utils';

/**
 * Manages a live getUserMedia stream for the lifetime of the component.
 * Starts the camera on mount and stops all tracks on unmount.
 */
export function useCameraStream() {
  const videoRef = useRef<HTMLVideoElement>(null);
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
            /* capture still works once frames are available */
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

  /** Captures the current video frame as a downscaled JPEG Blob, or null. */
  const capture = async (): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvasToThumbnailBlob(canvas);
  };

  return { videoRef, error, starting, capture };
}
