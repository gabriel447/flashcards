import { useEffect } from 'react';

type ConfirmModalProps = {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({ open, title = 'Confirmar exclusão', message, confirmText = 'Deletar', cancelText = 'Cancelar', onConfirm, onCancel }: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-box" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(e) => e.stopPropagation()}>
        {title && <h3 id="confirm-title" className="modal-title">{title}</h3>}
        <p className="modal-message">{message}</p>
        <div className="modal-actions">
          <button className="btn btn-secondary btn-sm" onClick={onCancel}>{cancelText}</button>
          <button className="btn btn-danger btn-sm" onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}