import { LockKeyhole } from "lucide-react";

export default function LockedPanel({
  title = "Tính năng bị khóa",
  message,
  onBack,
}) {
  return (
    <section className="tool-panel locked-panel">
      <div className="locked-icon">
        <LockKeyhole size={30} />
      </div>
      <h3>{title}</h3>
      <p>
        {message ||
          "Bạn đang ở chế độ chỉ xem nên không thể dùng chức năng này. Mở lại web và nhập đúng mật khẩu admin để mở khóa."}
      </p>
      {onBack && (
        <button className="btn-tool-ghost" type="button" onClick={onBack}>
          Quay về danh sách
        </button>
      )}
    </section>
  );
}
