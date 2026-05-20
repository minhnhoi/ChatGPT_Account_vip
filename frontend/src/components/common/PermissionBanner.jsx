import { Lock, ShieldCheck } from "lucide-react";
import { formatDateTime } from "../../utils/date";

export default function PermissionBanner({ isAdmin, message, expiresAt }) {
  return (
    <div className={`permission-banner ${isAdmin ? "admin" : "readonly"}`}>
      {isAdmin ? <ShieldCheck size={18} /> : <Lock size={18} />}
      <div>
        <strong>{isAdmin ? "Admin mode đang bật" : "Read-only mode"}</strong>
        <span>
          {isAdmin
            ? `Bạn có thể thêm, sửa, xóa và xem mật khẩu. Token hết hạn: ${expiresAt ? formatDateTime(expiresAt) : "không rõ"}.`
            : message ||
              "Bạn chỉ có thể xem danh sách. Xem pass, thêm, sửa và xóa đã bị khóa."}
        </span>
      </div>
    </div>
  );
}
