import { useEffect, useRef, useState } from 'react';
import CameraModal from '../camera/CameraModal';
import { fileToThumbnailBlob } from '../camera/utils';

type ReferenceImagePickerProps = {
  value: Blob | null;
  onChange: (blob: Blob | null) => void;
};

export default function ReferenceImagePicker({ value, onChange }: ReferenceImagePickerProps) {
  const [showCamera, setShowCamera] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!value) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    try {
      const blob = await fileToThumbnailBlob(file);
      if (blob) onChange(blob);
    } catch (err) {
      console.error('Failed to process image', err);
      setError('That image could not be read. Please try another file.');
    }
  };

  return (
    <div className="ref-image">
      {previewUrl ? (
        <img src={previewUrl} alt="Reference photo of the medicine" className="ref-image__preview" />
      ) : (
        <div className="ref-image__empty">No reference photo set</div>
      )}

      <div className="ref-image__actions">
        <button type="button" className="btn" onClick={() => setShowCamera(true)}>
          Capture with camera
        </button>
        <button type="button" className="btn" onClick={() => fileInputRef.current?.click()}>
          Choose from files
        </button>
        {previewUrl && (
          <button type="button" className="btn btn--danger" onClick={() => onChange(null)}>
            Remove
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleFile}
        aria-label="Choose a reference photo file"
      />

      {error && <p className="form-error" role="alert">{error}</p>}

      <p className="muted ref-image__note">
        Take the photo of the bare medicine — remove it from any wrapper or
        blister pack and place a single pill/tablet on a plain, contrasting
        background. Get close so its shape, size and color fill the frame; that
        is what the reminder check compares against.
      </p>
      <p className="muted ref-image__note">
        Stored only on this device. Used only for a visual consistency check
        later — never to identify or authenticate a medicine.
      </p>

      {showCamera && (
        <CameraModal
          title="Capture reference photo"
          onCapture={(blob) => {
            onChange(blob);
            setShowCamera(false);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}
