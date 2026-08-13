import { useEffect, useRef, type ReactNode } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

type ModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export default function Modal({ title, onClose, children }: ModalProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, true);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    const timer = window.setTimeout(() => closeBtnRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(timer);
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button
            ref={closeBtnRef}
            type="button"
            className="btn btn--ghost"
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
