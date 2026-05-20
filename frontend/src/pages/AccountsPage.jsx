import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Layers3,
  Lock,
  Plus,
  Sparkles,
} from "lucide-react";
import AccountFilters from "../components/accounts/AccountFilters";
import AccountTable from "../components/accounts/AccountTable";

function normalized(status) {
  if (status === "in_use") return "active";
  if (status === "old") return "expired";
  if (status === "lost") return "disabled";
  return status || "new";
}

function MiniMetric({ label, value, helper, icon: Icon, tone = "" }) {
  return (
    <div className={`metric-tile ${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{helper}</small>
      </div>
      <Icon size={22} />
    </div>
  );
}

export default function AccountsPage({
  accounts,
  loading,
  filters,
  setFilters,
  onReveal,
  onEdit,
  onDelete,
  canManage,
  visitorName,
  visitorId,
  onRequestAccess,
  onBlockedAction,
  onNavigate,
  canRequestAccess = false,
}) {
  const activeCount = accounts.filter(
    (item) => normalized(item.status) === "active",
  ).length;
  const attentionCount = accounts.filter((item) =>
    ["expired", "disabled"].includes(normalized(item.status)),
  ).length;
  const paidCount = accounts.filter((item) =>
    ["plus", "pro", "team", "enterprise"].includes(item.planVersion),
  ).length;

  function quickStatus(status) {
    setFilters?.((prev) => ({ ...prev, status }));
  }

  function quickPlan(planVersion) {
    setFilters?.((prev) => ({ ...prev, planVersion }));
  }

  return (
    <div className="page-stack">
      <section className="hero-panel mini-hero">
        <div>
          <p className="tool-eyebrow">ACCOUNT DATABASE</p>
          <h1>
            Kho tài khoản có lọc nhanh, thao tác rõ ràng và bảo vệ mật khẩu.
          </h1>
          <span>
            {canRequestAccess
              ? "User mode có thể xin quyền từng tài khoản; khi admin duyệt thì được xem email/mật khẩu và chỉ sửa trạng thái tài khoản đó."
              : "Guest mode chỉ xem danh sách/tìm kiếm/mở link. Đăng nhập để xin quyền hoặc thao tác tài khoản."}
          </span>
        </div>
        <div className="hero-actions">
          <button
            className="btn-tool-primary"
            type="button"
            onClick={() =>
              canManage
                ? onNavigate?.("create")
                : onBlockedAction("thêm tài khoản")
            }
          >
            {canManage ? <Plus size={18} /> : <Lock size={18} />}
            Thêm tài khoản
          </button>
        </div>
      </section>

      <div className="metric-grid four">
        <MiniMetric
          label="Đang hiển thị"
          value={accounts.length}
          helper="Theo bộ lọc hiện tại"
          icon={Database}
        />
        <MiniMetric
          label="Active"
          value={activeCount}
          helper="Sẵn sàng sử dụng"
          icon={CheckCircle2}
          tone="success"
        />
        <MiniMetric
          label="Gói trả phí"
          value={paidCount}
          helper="Plus / Pro / Team"
          icon={Layers3}
          tone="blue"
        />
        <MiniMetric
          label="Cần xử lý"
          value={attentionCount}
          helper="Expired / Disabled"
          icon={AlertTriangle}
          tone="warning"
        />
      </div>

      <section className="tool-panel records-panel">
        <div className="panel-heading">
          <div>
            <p className="tool-eyebrow">DATABASE</p>
            <h2>
              <Database size={22} /> Kho tài khoản
            </h2>
            <span className="panel-subtitle">
              {accounts.length} bản ghi đang hiển thị theo bộ lọc hiện tại.
            </span>
          </div>
          <div className="panel-actions">
            <button
              className="btn-tool-ghost small"
              type="button"
              onClick={() => quickStatus("active")}
            >
              <Sparkles size={15} /> Active
            </button>
            <button
              className="btn-tool-ghost small"
              type="button"
              onClick={() => quickPlan("plus")}
            >
              Plus
            </button>
            <button
              className="btn-tool-ghost small"
              type="button"
              onClick={() => quickPlan("pro")}
            >
              Pro
            </button>
          </div>
        </div>

        <AccountFilters filters={filters} onChange={setFilters} />
        <AccountTable
          accounts={accounts}
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
        />
      </section>
    </div>
  );
}
