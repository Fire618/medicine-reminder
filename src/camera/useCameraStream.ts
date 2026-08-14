import { useEffect, useRef, useState } from 'react';
import { cameraError, canvasToThumbnailBlob } from './utils';

/**
 * Manages a live getUserMedia stream for the lifetime of the component.
 * Starts the camera on mount and stops all tracks on unmount.
 *
 * The start sequence is deliberately defensive: it waits for the stream's
 * metadata before calling play(), sets muted/playsInline/autoplay directly
 * on the element, and falls back to any camera when the rear-camera
 * constraint is not supported. This avoids the classic "black preview"
 * where the stream starts but frames never render.
 */
export function useCameraStream() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    const stopStream = () => {
      stream?.getTracks().forEach((t) => t.stop());
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new DOMException('Camera API unavailable', 'NotSupportedError');
        }

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false,
          });
        } catch (e) {
          if ((e as DOMException)?.name === 'OverconstrainedError') {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
          } else {
            throw e;
          }
        }

        if (cancelled) {
          stopStream();
          return;
        }

        const video = videoRef.current;
        if (!video) {
          stopStream();
          return;
        }

        video.muted = true;
        video.playsInline = true;
        video.setAttribute('autoplay', '');
        video.srcObject = stream;

        if (video.readyState < 1) {
          await new Promise<void>((resolve) => {
            const onReady = () => {
              video.removeEventListener('loadedmetadata', onReady);
              resolve();
            };
            video.addEventListener('loadedmetadata', onReady);
          });
        }

        if (cancelled) return;
        await video.play().catch(() => {
          /* capture still works once frames are available */
        });
      } catch (e) {
        if (!cancelled) setError(cameraError(e));
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      stopStream();
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