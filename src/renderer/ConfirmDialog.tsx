// Keeps destructive history confirmation keyboard-modal without dismissing Settings.
import { useEffect, useRef } from "react";
import { strings as s } from "./strings";
export function ConfirmDialog({
  title,
  message,
  onConfirm,
  onClose,
  confirmLabel = s.confirm,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onClose: () => void;
  confirmLabel?: string;
}) {
  const root = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    root.current?.showModal();
  }, []);
  return (
    <dialog
      ref={root}
      role="alertdialog"
      aria-label={title}
      className="confirm-dialog"
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <p>{message}</p>
      <button autoFocus onClick={onClose}>
        {s.cancel}
      </button>
      <button className="primary" onClick={onConfirm}>
        {confirmLabel}
      </button>
    </dialog>
  );
}
