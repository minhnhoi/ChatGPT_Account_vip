import { X } from "lucide-react";

export default function AlertBox({ type = "danger", message, onClose }) {
  if (!message) return null;

  return (
    <div className={`tool-alert ${type}`} role="alert">
      <span>{message}</span>
      {onClose && (
        <button type="button" aria-label="Close" onClick={onClose}>
          <X size={16} />
        </button>
      )}
    </div>
  );
}
