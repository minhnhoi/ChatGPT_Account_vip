import {
  ArrowLeft,
  KeyRound,
  PlusCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import AccountForm from "../components/accounts/AccountForm";

export default function CreateAccountPage({
  onCreate,
  onBack,
  visitorName = "",
  preferences,
}) {
  return (
    <div className="page-stack">
      <section className="hero-panel mini-hero">
        <div>
          <p className="tool-eyebrow">NEW RECORD</p>
          <h1>Thêm tài khoản mới với form chia nhóm rõ ràng.</h1>
          <span>
            Form tự lấy chủ sở hữu là{" "}
            <b>{visitorName || "tên trong MongoDB"}</b>, có tạo mật khẩu mạnh,
            phân loại gói, trạng thái, ngày gia hạn, tags và ghi chú.
          </span>
        </div>
        <div className="hero-actions">
          {onBack && (
            <button className="btn-tool-ghost" type="button" onClick={onBack}>
              <ArrowLeft size={16} /> Quay lại kho
            </button>
          )}
        </div>
      </section>

      <div className="metric-grid three">
        <div className="metric-tile success">
          <div>
            <span>Bảo mật</span>
            <strong>AES-256</strong>
            <small>Mã hóa trước khi lưu</small>
          </div>
          <ShieldCheck size={22} />
        </div>
        <div className="metric-tile blue">
          <div>
            <span>Chủ sở hữu</span>
            <strong>{visitorName || "MongoDB"}</strong>
            <small>Lưu theo hồ sơ người dùng</small>
          </div>
          <Sparkles size={22} />
        </div>
        <div className="metric-tile">
          <div>
            <span>Secret</span>
            <strong>Generator</strong>
            <small>Tạo mật khẩu mạnh</small>
          </div>
          <KeyRound size={22} />
        </div>
      </div>

      <section className="tool-panel form-panel">
        <div className="panel-heading">
          <div>
            <p className="tool-eyebrow">CREATE FORM</p>
            <h2>
              <PlusCircle size={23} /> Thông tin tài khoản
            </h2>
            <span className="panel-subtitle">
              Cài đặt mặc định cho gói/trạng thái có thể đổi ở mục Cài đặt hệ
              thống.
            </span>
          </div>
        </div>
        <AccountForm
          onSubmit={onCreate}
          visitorName={visitorName}
          lockOwnerName
          preferences={preferences}
        />
      </section>
    </div>
  );
}
