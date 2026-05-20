import { AlertTriangle } from "lucide-react";

export default function ConfirmModal({
  open,
  title = "Xác nhận",
  message = "",
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  variant = "primary",
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <>
      <div className="modal fade show d-block" tabIndex="-1" role="dialog">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content tool-modal">
            <div className="modal-header">
              <h5 className="modal-title d-flex align-items-center gap-2">
                {variant === "danger" && (
                  <AlertTriangle size={20} className="text-danger" />
                )}
                {title}
              </h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={onCancel}
                aria-label="Close"
              />
            </div>
            <div className="modal-body">
              <p className="mb-0 text-secondary-light">{message}</p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-tool-ghost"
                onClick={onCancel}
                data-testid="confirm-modal-cancel"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                className={
                  variant === "danger" ? "btn-tool-danger" : "btn-tool-primary"
                }
                onClick={onConfirm}
                data-testid="confirm-modal-confirm"
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
