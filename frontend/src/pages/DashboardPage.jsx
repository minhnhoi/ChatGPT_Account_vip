import { Database, Lock, Plus, ShieldCheck } from "lucide-react";
import StatCards from "../components/dashboard/StatCards";
import StatsBreakdown from "../components/dashboard/StatsBreakdown";
import AccountTable from "../components/accounts/AccountTable";

export default function DashboardPage({
  stats,
  recentAccounts,
  loading,
  onReveal,
  onEdit,
  onDelete,
  onNavigate,
  canManage,
  visitorName,
  visitorId,
  onRequestAccess,
  onBlockedAction,
  canRequestAccess = false,
}) {
  const recent = recentAccounts.slice(0, 6);

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div>
          <p className="tool-eyebrow">ACCOUNT VAULT</p>
          <h1>Quản lý tài khoản rõ ràng, an toàn và dễ thao tác.</h1>
          <span>
            Danh sách tài khoản luôn xem được. Các thao tác nhạy cảm như xem mật
            khẩu, sửa, xóa và thêm mới chỉ mở khi bạn xác thực đúng mật khẩu
            admin hoặc được admin cấp quyền riêng cho từng tài khoản.
          </span>
        </div>
        <div className="hero-actions">
          <button
            className="btn-tool-primary"
            type="button"
            onClick={() => onNavigate("accounts")}
          >
            <Database size={18} /> Mở kho tài khoản
          </button>
          <button
            className="btn-tool-ghost"
            type="button"
            onClick={() =>
              canManage
                ? onNavigate("create")
                : onBlockedAction("thêm tài khoản")
            }
          >
            {canManage ? <Plus size={18} /> : <Lock size={18} />}
            Thêm tài khoản
          </button>
        </div>
      </section>

      <StatCards stats={stats} />

      <div className="dashboard-grid">
        <section className="tool-panel access-overview">
          <div className="panel-heading compact">
            <div>
              <p className="tool-eyebrow">ACCESS CONTROL</p>
              <h2>Quyền hiện tại</h2>
            </div>
            <span className={`access-pill ${canManage ? "admin" : "readonly"}`}>
              {canManage ? <ShieldCheck size={16} /> : <Lock size={16} />}
              {canManage ? "ADMIN" : "READ-ONLY"}
            </span>
          </div>

          <div className="permission-grid">
            <div className={canManage ? "allowed" : "blocked"}>
              Xem mật khẩu
            </div>
            <div className={canManage ? "allowed" : "blocked"}>
              Thêm tài khoản
            </div>
            <div className={canManage ? "allowed" : "blocked"}>
              Sửa thông tin
            </div>
            <div className={canManage ? "allowed" : "blocked"}>Xóa dữ liệu</div>
          </div>

          <p className="panel-note mb-0">
            {canManage
              ? "Bạn đang có toàn quyền. Reload web vẫn giữ admin mode nhờ httpOnly cookie cho tới khi bấm Đăng xuất hoặc phiên hết hạn."
              : canRequestAccess
                ? "Bạn đang ở user mode. Có thể bấm Xin quyền ở từng tài khoản để admin cấp quyền xem/sửa trạng thái riêng."
                : "Bạn đang ở guest mode. Chỉ xem danh sách/tìm kiếm/mở link, cần đăng nhập để xin quyền hoặc thao tác dữ liệu."}
          </p>
        </section>

        <StatsBreakdown stats={stats} />
      </div>

      <section className="tool-panel">
        <div className="panel-heading">
          <div>
            <p className="tool-eyebrow">RECENT RECORDS</p>
            <h2>Tài khoản cập nhật gần đây</h2>
          </div>
          <button
            className="btn-tool-ghost small"
            type="button"
            onClick={() => onNavigate("accounts")}
          >
            Xem tất cả
          </button>
        </div>
        <AccountTable
          accounts={recent}
          loading={loading}
          onReveal={onReveal}
          onEdit={onEdit}
          onDelete={onDelete}
          onRequestAccess={onRequestAccess}
          canManage={canManage}
          visitorName={visitorName}
          visitorId={visitorId}
          onBlockedAction={onBlockedAction}
          canRequestAccess={canRequestAccess}
          compact
        />
      </section>
    </div>
  );
}
