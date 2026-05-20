import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  BarChart3,
  BookOpenText,
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock3,
  DatabaseBackup,
  Download,
  FileJson,
  Filter,
  KeyRound,
  ExternalLink,
  Loader2,
  Mail,
  Layers3,
  ListChecks,
  Lock,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  Upload,
  Trash2,
  UserCheck,
  UsersRound,
  Wrench,
} from "lucide-react";
import { activityService } from "../services/activityService";
import { backupService } from "../services/backupService";
import { otpService } from "../services/otpService";
import {
  PLAN_OPTIONS,
  STATUS_OPTIONS,
  getPlanLabel,
  getStatusClassName,
  getStatusLabel,
} from "../utils/labels";
import { formatDateTime } from "../utils/date";
import {
  DEFAULT_PREFERENCES,
  normalizePreferences,
} from "../utils/preferences";

const DAY_MS = 24 * 60 * 60 * 1000;

function Panel({
  eyebrow,
  title,
  icon: Icon,
  subtitle,
  children,
  actions,
  className = "",
}) {
  return (
    <section className={`tool-panel ${className}`.trim()}>
      <div className="panel-heading">
        <div>
          <p className="tool-eyebrow">{eyebrow}</p>
          <h2>
            {Icon && <Icon size={22} />} {title}
          </h2>
          {subtitle && <span className="panel-subtitle">{subtitle}</span>}
        </div>
        {actions && <div className="panel-actions">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

function MetricTile({ label, value, helper, icon: Icon, tone = "default" }) {
  return (
    <div className={`metric-tile ${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {helper && <small>{helper}</small>}
      </div>
      {Icon && <Icon size={22} />}
    </div>
  );
}

function ProgressLine({ label, value, total, tone = "green" }) {
  const percent =
    total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="progress-line">
      <div>
        <span>{label}</span>
        <b>{value}</b>
      </div>
      <div className="progress-track">
        <i className={tone} style={{ width: `${percent}%` }} />
      </div>
      <small>{percent}% tổng dữ liệu</small>
    </div>
  );
}

function EmptyState({
  title = "Chưa có dữ liệu",
  message = "Dữ liệu sẽ hiển thị tại đây khi hệ thống có bản ghi phù hợp.",
}) {
  return (
    <div className="vault-table-empty">
      <Sparkles size={30} />
      <h5>{title}</h5>
      <p>{message}</p>
    </div>
  );
}

function normalizeStatus(status) {
  if (status === "in_use") return "active";
  if (status === "old") return "expired";
  if (status === "lost") return "disabled";
  return status || "new";
}

function countBy(items, field, normalizer = (value) => value || "other") {
  return items.reduce((result, item) => {
    const key = normalizer(item[field]);
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

function daysUntil(value) {
  if (!value) return null;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / DAY_MS);
}

function sortByDateDesc(items, field = "updatedAt") {
  return [...items].sort(
    (a, b) =>
      new Date(b[field] || b.createdAt || 0) -
      new Date(a[field] || a.createdAt || 0),
  );
}

function AccountMiniTable({ accounts, emptyTitle, emptyMessage }) {
  if (!accounts.length)
    return <EmptyState title={emptyTitle} message={emptyMessage} />;

  return (
    <div className="vault-table-wrap compact-table">
      <table className="vault-table">
        <thead>
          <tr>
            <th>Tài khoản</th>
            <th>Gói</th>
            <th>Trạng thái</th>
            <th>Gia hạn</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((account) => (
            <tr key={account._id}>
              <td>
                <div className="user-cell">
                  <strong>{account.accountName || "Chưa đặt tên"}</strong>
                  <small>{account.loginEmail || account.ownerName}</small>
                </div>
              </td>
              <td>
                <span className="vault-badge plan">
                  {getPlanLabel(account.planVersion)}
                </span>
              </td>
              <td>
                <span
                  className={`vault-badge ${getStatusClassName(account.status)}`}
                >
                  {getStatusLabel(account.status)}
                </span>
              </td>
              <td>
                <span className="updated-cell">
                  {account.renewalDate
                    ? formatDateTime(account.renewalDate)
                    : "Chưa đặt"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ServicesPage({ accounts, stats, setFilters, onNavigate }) {
  const byPlan = stats?.byPlan || countBy(accounts, "planVersion");
  const byStatus =
    stats?.byStatus || countBy(accounts, "status", normalizeStatus);
  const total = Math.max(stats?.total || accounts.length, 1);

  const paidAccounts = useMemo(
    () =>
      accounts.filter((item) =>
        ["plus", "pro", "team", "enterprise"].includes(item.planVersion),
      ),
    [accounts],
  );

  const planHealth = useMemo(() => {
    return PLAN_OPTIONS.map((plan) => {
      const planAccounts = accounts.filter(
        (item) => item.planVersion === plan.value,
      );
      const active = planAccounts.filter(
        (item) => normalizeStatus(item.status) === "active",
      ).length;
      const attention = planAccounts.filter((item) =>
        ["expired", "disabled"].includes(normalizeStatus(item.status)),
      ).length;
      return { ...plan, count: byPlan[plan.value] || 0, active, attention };
    });
  }, [accounts, byPlan]);

  function openPlan(plan) {
    setFilters?.((prev) => ({ ...prev, planVersion: plan, status: "all" }));
    onNavigate?.("accounts");
  }

  function openStatus(status) {
    setFilters?.((prev) => ({ ...prev, status, planVersion: "all" }));
    onNavigate?.("accounts");
  }

  return (
    <div className="page-stack">
      <section className="hero-panel mini-hero">
        <div>
          <p className="tool-eyebrow">SERVICE CENTER</p>
          <h1>
            Quản lý gói dịch vụ theo số lượng, trạng thái và lịch gia hạn.
          </h1>
          <span>
            Từng gói có thể bấm để lọc thẳng sang kho tài khoản, giúp kiểm tra
            Plus/Pro/Team nhanh hơn.
          </span>
        </div>
        <div className="hero-actions">
          <button
            className="btn-tool-primary"
            type="button"
            onClick={() => openPlan("plus")}
          >
            <Layers3 size={18} /> Lọc Plus
          </button>
          <button
            className="btn-tool-ghost"
            type="button"
            onClick={() => openPlan("pro")}
          >
            <Sparkles size={18} /> Lọc Pro
          </button>
        </div>
      </section>

      <div className="metric-grid four">
        <MetricTile
          label="Tổng tài khoản"
          value={stats?.total ?? accounts.length}
          helper="Toàn bộ bản ghi"
          icon={BarChart3}
        />
        <MetricTile
          label="Tài khoản trả phí"
          value={stats?.paidAccounts ?? paidAccounts.length}
          helper="Plus / Pro / Team"
          icon={CheckCircle2}
          tone="success"
        />
        <MetricTile
          label="Đang active"
          value={stats?.activeAccounts ?? (byStatus.active || 0)}
          helper="Có thể dùng ngay"
          icon={ShieldCheck}
          tone="success"
        />
        <MetricTile
          label="Cần xử lý"
          value={
            stats?.needsAttention ??
            (byStatus.expired || 0) + (byStatus.disabled || 0)
          }
          helper="Expired / Disabled"
          icon={AlertTriangle}
          tone="warning"
        />
      </div>

      <Panel
        eyebrow="PLAN DISTRIBUTION"
        title="Bảng gói dịch vụ"
        icon={ListChecks}
        subtitle="Click vào từng card để mở danh sách tài khoản thuộc gói đó."
      >
        <div className="plan-grid detailed">
          {planHealth.map((plan) => {
            const percent = Math.round(((plan.count || 0) / total) * 100);
            return (
              <button
                className="plan-card detailed"
                key={plan.value}
                type="button"
                onClick={() => openPlan(plan.value)}
              >
                <span>{getPlanLabel(plan.value)}</span>
                <strong>{plan.count}</strong>
                <small>{percent}% tổng tài khoản</small>
                <div className="mini-kpi-row">
                  <em>{plan.active} active</em>
                  <em>{plan.attention} cần xử lý</em>
                </div>
                <div className="progress-track">
                  <i style={{ width: `${percent}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      </Panel>

      <div className="two-column-grid">
        <Panel
          eyebrow="STATUS HEALTH"
          title="Trạng thái sử dụng"
          icon={CheckCircle2}
        >
          <div className="progress-list">
            {STATUS_OPTIONS.map((status, index) => (
              <ProgressLine
                key={status.value}
                label={status.label}
                value={byStatus[status.value] || 0}
                total={total}
                tone={index % 2 ? "blue" : "green"}
              />
            ))}
          </div>
          <div className="quick-filter-row">
            <button
              className="btn-tool-ghost small"
              type="button"
              onClick={() => openStatus("active")}
            >
              <Filter size={15} /> Active
            </button>
            <button
              className="btn-tool-ghost small"
              type="button"
              onClick={() => openStatus("expired")}
            >
              <Filter size={15} /> Expired
            </button>
            <button
              className="btn-tool-ghost small"
              type="button"
              onClick={() => openStatus("new")}
            >
              <Filter size={15} /> New
            </button>
          </div>
        </Panel>

        <Panel
          eyebrow="RECENT PAID"
          title="Gói trả phí mới cập nhật"
          icon={Layers3}
        >
          <AccountMiniTable
            accounts={sortByDateDesc(paidAccounts).slice(0, 6)}
            emptyTitle="Chưa có tài khoản trả phí"
            emptyMessage="Khi thêm Plus, Pro, Team hoặc Enterprise, danh sách sẽ hiện tại đây."
          />
        </Panel>
      </div>
    </div>
  );
}

export function GuidePage({ isAdmin = false, visitorName = "", onNavigate }) {
  const steps = [
    {
      title: "1. Vào Quản lý tài khoản",
      text: "Ở chế độ thường, bạn vẫn xem được danh sách tài khoản nhưng email thật và mật khẩu sẽ bị khóa.",
    },
    {
      title: "2. Bấm Xin quyền ở đúng tài khoản",
      text: "Mỗi yêu cầu chỉ áp dụng cho một tài khoản. Tên gửi yêu cầu lấy từ hồ sơ MongoDB của bạn.",
    },
    {
      title: "3. Chờ admin duyệt",
      text: "Admin đăng nhập bằng mật khẩu admin rồi mở Quản lý Admin để cấp quyền hoặc từ chối yêu cầu.",
    },
    {
      title: "4. Sau khi được cấp quyền",
      text: "Bạn được xem email, mật khẩu và chỉ sửa trạng thái. Khi lấy OTP, bấm Done sau khi đăng nhập được để Chủ sở hữu chuyển sang tên bạn.",
    },
  ];

  const lockedItems = [
    "Quản lý Admin",
    "Bảo mật",
    "Sao lưu dữ liệu",
    "Thêm tài khoản",
    "Manager OTP",
  ];

  return (
    <div className="page-stack">
      <section className="hero-panel mini-hero guide-hero">
        <div>
          <p className="tool-eyebrow">USER GUIDE</p>
          <h1>
            Hướng dẫn dùng AccountHub và xin quyền admin theo từng tài khoản.
          </h1>
          <span>
            Xin chào <b>{visitorName || "người dùng"}</b>. Trang này giải thích
            rõ quyền admin tổng, quyền riêng từng tài khoản, thông báo và các
            mục bị khóa ở chế độ thường.
          </span>
        </div>
        <div className="hero-actions">
          <button
            className="btn-tool-primary"
            type="button"
            onClick={() => onNavigate?.("accounts")}
          >
            <DatabaseBackup size={18} /> Mở danh sách
          </button>
          <button
            className="btn-tool-ghost"
            type="button"
            onClick={() => onNavigate?.("notifications")}
          >
            <Bell size={18} /> Xem thông báo
          </button>
        </div>
      </section>

      <div className="metric-grid four">
        <MetricTile
          label="Chế độ hiện tại"
          value={isAdmin ? "ADMIN" : "USER"}
          helper={isAdmin ? "Đang mở toàn quyền" : "Chỉ quyền riêng"}
          icon={isAdmin ? ShieldCheck : UserCheck}
          tone={isAdmin ? "success" : "blue"}
        />
        <MetricTile
          label="Xin quyền"
          value="Theo acc"
          helper="Không mở toàn hệ thống"
          icon={KeyRound}
          tone="warning"
        />
        <MetricTile
          label="Cài đặt"
          value="MongoDB"
          helper="Riêng theo hồ sơ người dùng"
          icon={Settings}
        />
        <MetricTile
          label="Thông báo"
          value="Có badge"
          helper="Mất khi đã xem"
          icon={Bell}
          tone="blue"
        />
      </div>

      <div className="two-column-grid">
        <Panel
          eyebrow="HOW TO USE"
          title="Quy trình xin quyền"
          icon={BookOpenText}
          subtitle="Luồng này dành cho người không có admin tổng."
        >
          <div className="security-steps guide-steps">
            {steps.map((step, index) => (
              <div key={step.title}>
                <span>{index + 1}</span>
                <b>{step.title}</b>
                <p>{step.text}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          eyebrow="LOCKED AREA"
          title="Các mục bị khóa khi không phải admin"
          icon={Lock}
          subtitle="Trên sidebar sẽ có biểu tượng khóa để tránh thao tác nhầm."
        >
          <div className="auth-rule-list compact-list">
            {lockedItems.map((item) => (
              <div className="auth-rule" key={item}>
                <b>
                  <Lock size={14} />
                </b>
                <span>{item}: cần đăng nhập admin tổng mới mở được.</span>
              </div>
            ))}
          </div>
          <p className="panel-note mt-3 mb-0">
            Quyền riêng từng tài khoản không thay thế admin tổng. Nó chỉ mở nút
            xem email/mật khẩu và sửa trạng thái của tài khoản được duyệt.
          </p>
        </Panel>
      </div>

      <Panel
        eyebrow="PERMISSION DETAIL"
        title="Bảng phân quyền dễ hiểu"
        icon={UsersRound}
      >
        <div className="permission-matrix extended">
          <div className="matrix-head">
            <span>Tính năng</span>
            <b>Admin tổng</b>
            <b>Được cấp theo acc</b>
            <b>Chưa được cấp</b>
          </div>
          <div className="matrix-row">
            <span>Xem danh sách tài khoản</span>
            <b className="yes">Cho phép</b>
            <b className="yes">Cho phép</b>
            <b className="yes">Cho phép</b>
          </div>
          <div className="matrix-row">
            <span>Xem email thật + mật khẩu</span>
            <b className="yes">Cho phép</b>
            <b className="yes">Đúng tài khoản</b>
            <b className="no">Khóa</b>
          </div>
          <div className="matrix-row">
            <span>Sửa trạng thái</span>
            <b className="yes">Cho phép</b>
            <b className="yes">Đúng tài khoản</b>
            <b className="no">Khóa</b>
          </div>
          <div className="matrix-row">
            <span>Sửa toàn bộ thông tin</span>
            <b className="yes">Cho phép</b>
            <b className="no">Khóa</b>
            <b className="no">Khóa</b>
          </div>
          <div className="matrix-row">
            <span>Thêm / xóa / backup / bảo mật</span>
            <b className="yes">Cho phép</b>
            <b className="no">Khóa</b>
            <b className="no">Khóa</b>
          </div>
        </div>
      </Panel>
    </div>
  );
}

export function ActivityPage({
  isAdmin = false,
  visitorName = "",
  visitorId = "",
  adminToken = "",
  syncTick = 0,
}) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [query, setQuery] = useState("");

  async function loadLogs({ silent = false } = {}) {
    try {
      if (!silent) setLoading(true);
      setError("");
      const response = await activityService.getLogs(160, {
        adminToken,
        visitorName,
        visitorId,
      });
      setLogs(response.data || []);
    } catch (err) {
      setError(err.message || "Không tải được nhật ký");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs({ silent: syncTick > 0 });
  }, [isAdmin, visitorName, visitorId, adminToken, syncTick]);

  const actionOptions = useMemo(
    () => [
      "all",
      ...Array.from(new Set(logs.map((log) => log.action).filter(Boolean))),
    ],
    [logs],
  );
  const todayCount = useMemo(() => {
    const today = new Date().toDateString();
    return logs.filter(
      (log) => new Date(log.createdAt).toDateString() === today,
    ).length;
  }, [logs]);
  const revealCount = logs.filter(
    (log) => log.action === "password_reveal",
  ).length;
  const crudCount = logs.filter((log) =>
    ["account_create", "account_update", "account_delete"].includes(log.action),
  ).length;

  const filteredLogs = useMemo(() => {
    const text = query.trim().toLowerCase();
    return logs.filter((log) => {
      const matchAction = actionFilter === "all" || log.action === actionFilter;
      const searchable =
        `${log.action || ""} ${log.target || ""} ${log.description || ""}`.toLowerCase();
      return matchAction && (!text || searchable.includes(text));
    });
  }, [logs, actionFilter, query]);

  return (
    <div className="page-stack">
      <div className="metric-grid four">
        <MetricTile
          label="Tổng log"
          value={logs.length}
          helper={isAdmin ? "160 log gần nhất" : "Log riêng của bạn"}
          icon={ListChecks}
        />
        <MetricTile
          label="Hôm nay"
          value={todayCount}
          helper="Hoạt động mới"
          icon={Clock3}
          tone="success"
        />
        <MetricTile
          label="CRUD"
          value={crudCount}
          helper="Thêm / sửa / xóa"
          icon={Wrench}
          tone="blue"
        />
        <MetricTile
          label="Xem pass"
          value={revealCount}
          helper="Đã audit"
          icon={KeyRound}
          tone="warning"
        />
      </div>

      <Panel
        eyebrow="AUDIT LOG"
        title="Nhật ký hoạt động"
        icon={ListChecks}
        subtitle={
          isAdmin
            ? "Theo dõi đăng nhập admin, xem mật khẩu, thêm, sửa, xóa và backup."
            : "Bạn chỉ nhìn thấy nhật ký do chính hồ sơ MongoDB/tên hiển thị của bạn tạo ra."
        }
        actions={
          <button
            className="btn-tool-ghost small"
            type="button"
            onClick={loadLogs}
            disabled={loading}
          >
            <RefreshCw size={15} /> Làm mới
          </button>
        }
      >
        {error && <div className="tool-alert danger mb-3">{error}</div>}

        <div className="toolbar-grid mb-3">
          <label className="tool-field">
            <span>
              <Search size={15} /> Tìm log
            </span>
            <input
              className="tool-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo hành động, mục tiêu, mô tả..."
            />
          </label>
          <label className="tool-field">
            <span>
              <Filter size={15} /> Hành động
            </span>
            <select
              className="tool-input"
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
            >
              {actionOptions.map((action) => (
                <option key={action} value={action}>
                  {action === "all" ? "Tất cả hành động" : action}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <div className="vault-table-empty">
            <div className="spinner-border text-success" role="status" />
            <p>Đang tải nhật ký...</p>
          </div>
        ) : filteredLogs.length ? (
          <div className="activity-layout">
            <div className="activity-timeline">
              {filteredLogs.slice(0, 8).map((log) => (
                <div className="timeline-item" key={`timeline-${log._id}`}>
                  <span />
                  <div>
                    <b>{log.action}</b>
                    <p>{log.description || log.target || "System event"}</p>
                    <small>{formatDateTime(log.createdAt)}</small>
                  </div>
                </div>
              ))}
            </div>

            <div className="vault-table-wrap">
              <table className="vault-table">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Hành động</th>
                    <th>Mục tiêu</th>
                    <th>Mô tả</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log._id}>
                      <td>
                        <span className="updated-cell">
                          {formatDateTime(log.createdAt)}
                        </span>
                      </td>
                      <td>
                        <span className="vault-badge plan">{log.action}</span>
                      </td>
                      <td>{log.target || "system"}</td>
                      <td>{log.description || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState
            title="Không có log phù hợp"
            message="Thử đổi bộ lọc hoặc bấm Làm mới để tải log mới nhất."
          />
        )}
      </Panel>
    </div>
  );
}

export function SettingsPage({
  filters,
  setFilters,
  visitorName = "",
  visitorId = "",
  preferences: savedPreferences = DEFAULT_PREFERENCES,
  onChangeVisitorName,
  onSavePreferences,
}) {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
  const [preferences, setPreferences] = useState(() =>
    normalizePreferences(savedPreferences),
  );
  const [savedMessage, setSavedMessage] = useState("");
  const [displayName, setDisplayName] = useState(visitorName);

  useEffect(() => {
    setPreferences(normalizePreferences(savedPreferences));
    setDisplayName(visitorName);
  }, [visitorName, savedPreferences]);

  function updatePref(field, value) {
    setPreferences((prev) => ({ ...prev, [field]: value }));
  }

  async function savePreferences() {
    const nextOwner = displayName.trim().replace(/\s+/g, " ") || visitorName;

    try {
      if (nextOwner && nextOwner !== visitorName) {
        await onChangeVisitorName?.(nextOwner);
      }

      const storedPreferences = await onSavePreferences?.(preferences);
      setPreferences(normalizePreferences(storedPreferences || preferences));
      setSavedMessage(
        nextOwner !== visitorName
          ? `Đã đổi tên hiển thị của bạn thành ${nextOwner}. Chỉ tài khoản đã bấm Done sau khi lấy OTP mới cập nhật Chủ sở hữu theo tên mới.`
          : `Đã lưu cài đặt hiển thị vào MongoDB cho ${nextOwner || "người dùng này"}.`,
      );
      setTimeout(() => setSavedMessage(""), 3000);
    } catch (error) {
      setSavedMessage(error.message || "Không lưu được cài đặt.");
      setTimeout(() => setSavedMessage(""), 3000);
    }
  }

  function resetFilters() {
    setFilters?.({ search: "", status: "all", planVersion: "all" });
  }

  return (
    <div className="page-stack">
      <section className="hero-panel mini-hero">
        <div>
          <p className="tool-eyebrow">SYSTEM SETTINGS</p>
          <h1>Cài đặt hệ thống rõ ràng, dễ kiểm tra, dễ reset.</h1>
          <span>
            Các tùy chọn chỉ áp dụng cho hồ sơ MongoDB hiện tại. Đổi tên sẽ cập
            nhật Chủ sở hữu cho các tài khoản bạn đã lấy OTP và bấm Done.
          </span>
        </div>
        <div className="hero-actions">
          <button
            className="btn-tool-primary"
            type="button"
            onClick={savePreferences}
          >
            <Settings size={18} /> Lưu cài đặt
          </button>
          <button
            className="btn-tool-ghost"
            type="button"
            onClick={resetFilters}
          >
            <RefreshCw size={18} /> Reset filter
          </button>
        </div>
      </section>

      {savedMessage && <div className="tool-alert success">{savedMessage}</div>}

      <div className="two-column-grid">
        <Panel
          eyebrow="ENVIRONMENT"
          title="Kết nối backend"
          icon={Settings}
          subtitle="Dùng để debug nhanh khi frontend không gọi được API."
        >
          <div className="settings-card-list">
            <div className="settings-info-card">
              <span>API URL hiện tại</span>
              <strong>{apiUrl}</strong>
              <small>Đổi trong frontend/.env bằng VITE_API_URL.</small>
            </div>
            <div className="settings-info-card">
              <span>Bộ lọc hiện tại</span>
              <strong>{filters.search || "Không có tìm kiếm"}</strong>
              <small>
                status={filters.status || "all"}; plan=
                {filters.planVersion || "all"}
              </small>
            </div>
            <div className="settings-info-card">
              <span>Tên hiển thị MongoDB</span>
              <strong>{visitorName || "Chưa đặt"}</strong>
              <small>
                Dùng làm tên hiển thị trong giao diện; tài khoản chỉ đổi Chủ sở
                hữu theo tên này sau khi bạn lấy OTP và bấm Done.
              </small>
            </div>
            <div className="settings-info-card">
              <span>Visitor ID</span>
              <strong>{visitorId || "Chưa có"}</strong>
              <small>
                Trình duyệt chỉ giữ ID này; tên và cài đặt được lưu trong
                MongoDB.
              </small>
            </div>
            <div className="settings-info-card">
              <span>Frontend build</span>
              <strong>Vite + React + Bootstrap</strong>
              <small>Giao diện dark cyber theo AccountHub.</small>
            </div>
          </div>
        </Panel>

        <Panel
          eyebrow="PREFERENCES"
          title="Tùy chọn hiển thị"
          icon={Wrench}
          subtitle="Lưu vào MongoDB theo hồ sơ người dùng hiện tại."
        >
          <div className="settings-grid refined">
            <label className="tool-field">
              <span>Tên hiển thị của bạn</span>
              <input
                className="tool-input"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="VD: Minh"
              />
            </label>
            <label className="tool-field">
              <span>Gói mặc định khi nhập mới</span>
              <select
                className="tool-input"
                value={preferences.defaultPlan}
                onChange={(event) =>
                  updatePref("defaultPlan", event.target.value)
                }
              >
                {PLAN_OPTIONS.map((plan) => (
                  <option key={plan.value} value={plan.value}>
                    {plan.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="tool-field">
              <span>Trạng thái mặc định</span>
              <select
                className="tool-input"
                value={preferences.defaultStatus}
                onChange={(event) =>
                  updatePref("defaultStatus", event.target.value)
                }
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="tool-field">
              <span>Cảnh báo gia hạn trước</span>
              <input
                className="tool-input"
                type="number"
                min="1"
                max="365"
                value={preferences.reminderDays}
                onChange={(event) =>
                  updatePref("reminderDays", Number(event.target.value))
                }
              />
            </label>
            <label className="tool-field">
              <span>Mật độ bảng</span>
              <select
                className="tool-input"
                value={preferences.tableDensity}
                onChange={(event) =>
                  updatePref("tableDensity", event.target.value)
                }
              >
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
                <option value="spacious">Spacious</option>
              </select>
            </label>
            <label className="tool-field">
              <span>Độ nổi hiệu ứng</span>
              <select
                className="tool-input"
                value={preferences.themeGlow}
                onChange={(event) =>
                  updatePref("themeGlow", event.target.value)
                }
              >
                <option value="minimal">Minimal</option>
                <option value="balanced">Balanced</option>
                <option value="neon">Neon</option>
              </select>
            </label>
          </div>
        </Panel>
      </div>

      <Panel
        eyebrow="QUICK MAINTENANCE"
        title="Công cụ lọc nhanh"
        icon={Filter}
      >
        <div className="quick-filter-row wide">
          <button
            className="btn-tool-ghost"
            type="button"
            onClick={() => setFilters?.((prev) => ({ ...prev, status: "new" }))}
          >
            Tài khoản New
          </button>
          <button
            className="btn-tool-ghost"
            type="button"
            onClick={() =>
              setFilters?.((prev) => ({ ...prev, status: "expired" }))
            }
          >
            Tài khoản Expired
          </button>
          <button
            className="btn-tool-ghost"
            type="button"
            onClick={() =>
              setFilters?.((prev) => ({ ...prev, planVersion: "pro" }))
            }
          >
            Gói Pro
          </button>
          <button
            className="btn-tool-ghost"
            type="button"
            onClick={resetFilters}
          >
            Xóa toàn bộ filter
          </button>
        </div>
      </Panel>
    </div>
  );
}

const ACCESS_REASON_TEMPLATES = [
  "Vi phạm chính sách sử dụng hoặc có dấu hiệu dùng sai mục đích.",
  "Yêu cầu không đúng chủ sở hữu hoặc không đúng tài khoản cần truy cập.",
  "Thiếu thông tin xác minh, vui lòng liên hệ admin để bổ sung.",
  "Phát hiện IP/thiết bị/fingerprint trùng bất thường với hồ sơ khác.",
];

function getRiskTone(score = 0) {
  if (score >= 70) return "danger";
  if (score >= 35) return "warning";
  return "success";
}

function RequestRiskSummary({ request }) {
  const clientInfo = request?.clientInfo || {};
  const score = Number(clientInfo.riskScore || 0);
  const tone = getRiskTone(score);
  const flags = clientInfo.riskFlags || [];

  return (
    <div className="risk-mini-card">
      <span className={`vault-badge notify-${tone}`}>Risk {score}</span>
      <small>{clientInfo.ipPrefix || clientInfo.ip || "Không có IP"}</small>
      <small>
        {clientInfo.fingerprint
          ? `FP: ${clientInfo.fingerprint}`
          : "Thiếu fingerprint"}
      </small>
      {flags.slice(0, 2).map((flag) => (
        <em key={flag}>{flag}</em>
      ))}
    </div>
  );
}

function DecisionReasonDialog({ action, onClose, onConfirm }) {
  const [reason, setReason] = useState(ACCESS_REASON_TEMPLATES[0]);

  if (!action) return null;

  const title = "Thu hồi quyền";
  const confirmLabel = "Thu hồi quyền";

  async function submit() {
    const finalReason = reason.trim() || ACCESS_REASON_TEMPLATES[0];
    await onConfirm?.(action, finalReason);
    onClose?.();
  }

  return (
    <div className="modal-backdrop-custom" role="dialog" aria-modal="true">
      <section className="modal-card-custom reason-dialog-card">
        <div className="modal-card-header">
          <div>
            <p className="tool-eyebrow">ADMIN REASON</p>
            <h2>{title}</h2>
            <small>
              Chỉ thao tác thu hồi quyền mới cần nhập lý do để gửi về thông báo
              của người dùng.
            </small>
          </div>
          <button className="modal-close-btn" type="button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="reason-target-box">
          <strong>{action.request?.requesterName}</strong>
          <span>{action.account?.accountName}</span>
        </div>

        <div className="reason-template-grid">
          {ACCESS_REASON_TEMPLATES.map((template) => (
            <button
              key={template}
              className="btn-tool-ghost small"
              type="button"
              onClick={() => setReason(template)}
            >
              {template}
            </button>
          ))}
        </div>

        <label className="tool-field">
          <span>Lý do gửi cho người dùng</span>
          <textarea
            className="tool-input reason-textarea"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
          />
        </label>

        <div className="modal-actions-row">
          <button className="btn-tool-ghost" type="button" onClick={onClose}>
            Hủy
          </button>
          <button className="btn-tool-danger" type="button" onClick={submit}>
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export function AdminManagementPage({
  isAdmin,
  onLogout,
  expiresAt,
  accounts = [],
  visitorName = "",
  onApproveAccess,
  onRejectAccess,
  onRevokeAccess,
  onDeleteAccess,
}) {
  const [decisionAction, setDecisionAction] = useState(null);
  const remainingText = expiresAt
    ? formatDateTime(expiresAt)
    : "Chưa có phiên admin";
  const accessRows = accounts.flatMap((account) =>
    (account.accessRequests || [])
      .filter((request) => !request.hiddenFromAdmin)
      .map((request) => ({ account, request })),
  );
  const pendingRows = accessRows.filter(
    ({ request }) => request.status === "pending",
  );
  const approvedRows = accessRows.filter(
    ({ request }) => request.status === "approved",
  );
  const myApprovedRows = approvedRows.filter(
    ({ request }) =>
      String(request.requesterName || "")
        .trim()
        .toLowerCase() === visitorName.trim().toLowerCase(),
  );

  const permissions = [
    {
      label: "Xem danh sách tài khoản",
      admin: true,
      perAccount: true,
      readonly: true,
    },
    {
      label: "Xin quyền cho từng tài khoản",
      admin: true,
      perAccount: true,
      readonly: true,
    },
    {
      label: "Xem email + mật khẩu thật",
      admin: true,
      perAccount: true,
      readonly: false,
    },
    { label: "Sửa trạng thái", admin: true, perAccount: true, readonly: false },
    {
      label: "Sửa toàn bộ thông tin",
      admin: true,
      perAccount: false,
      readonly: false,
    },
    {
      label: "Thêm / xóa / backup",
      admin: true,
      perAccount: false,
      readonly: false,
    },
  ];

  function openReasonDialog(type, account, request) {
    setDecisionAction({ type, account, request });
  }

  async function confirmReason(action, reason) {
    if (!action) return;
    if (action.type === "revoke")
      await onRevokeAccess?.(action.account._id, action.request._id, reason);
  }

  return (
    <div className="page-stack">
      <section className="hero-panel mini-hero">
        <div>
          <p className="tool-eyebrow">ADMIN CONTROL</p>
          <h1>
            {isAdmin
              ? "Admin đang mở toàn quyền."
              : "Bạn đang ở chế độ chỉ xem."}
          </h1>
          <span>
            {isAdmin
              ? "Admin có thể duyệt quyền riêng từng tài khoản. Chủ sở hữu vẫn là admin cho tới khi người dùng lấy OTP và bấm Done xác nhận đăng nhập được."
              : "Read-only vẫn xem được dashboard và danh sách. Bấm Xin quyền ở từng tài khoản để chờ admin duyệt."}
          </span>
        </div>
        <div className="hero-actions">
          {isAdmin && (
            <button
              className="btn-tool-danger"
              type="button"
              onClick={onLogout}
            >
              <Lock size={17} /> Đăng xuất admin
            </button>
          )}
        </div>
      </section>

      <div className="metric-grid four">
        <MetricTile
          label="Trạng thái"
          value={isAdmin ? "ADMIN" : "READ-ONLY"}
          helper="Quyền hiện tại"
          icon={isAdmin ? ShieldCheck : ShieldOff}
          tone={isAdmin ? "success" : "warning"}
        />
        <MetricTile
          label="Tên hồ sơ"
          value={visitorName || "Chưa đặt"}
          helper="Lưu trong MongoDB"
          icon={UsersRound}
          tone="blue"
        />
        <MetricTile
          label="Chờ duyệt"
          value={pendingRows.length}
          helper="Yêu cầu xin quyền"
          icon={Clock3}
          tone="warning"
        />
        <MetricTile
          label="Đã cấp"
          value={approvedRows.length}
          helper="Quyền theo tài khoản"
          icon={KeyRound}
          tone="success"
        />
      </div>

      <Panel
        eyebrow="ACCESS REQUESTS"
        title="Duyệt quyền từng tài khoản"
        icon={UsersRound}
        subtitle="Cấp quyền chỉ mở quyền xem/sửa trạng thái. Chủ sở hữu chỉ chuyển sang người dùng sau khi họ lấy OTP và bấm Done."
      >
        {isAdmin ? (
          accessRows.length ? (
            <div className="vault-table-wrap compact-table">
              <table className="vault-table">
                <thead>
                  <tr>
                    <th>Người xin</th>
                    <th>Tài khoản</th>
                    <th>Trạng thái quyền</th>
                    <th>IP / Máy</th>
                    <th>Thời gian</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {accessRows.map(({ account, request }) => (
                    <tr key={`${account._id}-${request._id}`}>
                      <td>
                        <div className="user-cell">
                          <strong>{request.requesterName}</strong>
                          <small>
                            {request.requesterVisitorId
                              ? `ID: ${String(request.requesterVisitorId).slice(0, 14)}...`
                              : "hồ sơ MongoDB"}
                          </small>
                        </div>
                      </td>
                      <td>
                        <div className="user-cell">
                          <strong>{account.accountName}</strong>
                          <small>{account.ownerName}</small>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`vault-badge access-${request.status}`}
                        >
                          {request.status}
                        </span>
                        {request.decisionReason && (
                          <small className="d-block text-secondary-light">
                            Lý do: {request.decisionReason}
                          </small>
                        )}
                      </td>
                      <td>
                        <RequestRiskSummary request={request} />
                      </td>
                      <td>
                        <span className="updated-cell">
                          {formatDateTime(request.requestedAt)}
                        </span>
                      </td>
                      <td>
                        <div className="action-cell access-actions">
                          {request.status !== "approved" && (
                            <button
                              className="btn-tool-primary small"
                              type="button"
                              onClick={() =>
                                onApproveAccess?.(account._id, request._id)
                              }
                            >
                              Cấp quyền
                            </button>
                          )}
                          {request.status === "pending" && (
                            <button
                              className="btn-tool-ghost small"
                              type="button"
                              onClick={() =>
                                onRejectAccess?.(account._id, request._id)
                              }
                            >
                              Từ chối
                            </button>
                          )}
                          {request.status === "approved" && (
                            <button
                              className="btn-tool-danger small"
                              type="button"
                              onClick={() =>
                                openReasonDialog("revoke", account, request)
                              }
                            >
                              Thu hồi
                            </button>
                          )}
                          <button
                            className="btn-tool-danger small"
                            type="button"
                            title="Xóa khỏi list quản lý và gửi thông báo từ chối quyền"
                            onClick={() =>
                              onDeleteAccess?.(account._id, request._id)
                            }
                          >
                            <Trash2 size={14} /> Xóa khỏi list
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="Chưa có yêu cầu quyền"
              message="Khi người dùng bấm Xin quyền ở từng tài khoản, yêu cầu sẽ hiện tại đây."
            />
          )
        ) : myApprovedRows.length ? (
          <div className="vault-table-wrap compact-table">
            <table className="vault-table">
              <thead>
                <tr>
                  <th>Tài khoản đã được cấp</th>
                  <th>Chủ sở hữu</th>
                  <th>Trạng thái tài khoản</th>
                  <th>Ngày cấp</th>
                </tr>
              </thead>
              <tbody>
                {myApprovedRows.map(({ account, request }) => (
                  <tr key={`${account._id}-${request._id}`}>
                    <td>
                      <strong>{account.accountName}</strong>
                    </td>
                    <td>{account.ownerName}</td>
                    <td>
                      <span
                        className={`vault-badge ${getStatusClassName(account.status)}`}
                      >
                        {getStatusLabel(account.status)}
                      </span>
                    </td>
                    <td>
                      <span className="updated-cell">
                        {request.decidedAt
                          ? formatDateTime(request.decidedAt)
                          : "Đã cấp"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Chưa có quyền riêng"
            message="Quay lại Quản lý tài khoản, bấm Xin quyền ở tài khoản cần dùng rồi chờ admin duyệt."
          />
        )}
      </Panel>

      <div className="two-column-grid">
        <Panel
          eyebrow="PERMISSION MATRIX"
          title="Ma trận quyền"
          icon={UsersRound}
        >
          <div className="permission-matrix extended">
            <div className="matrix-head">
              <span>Tính năng</span>
              <b>Admin</b>
              <b>Được cấp</b>
              <b>Read-only</b>
            </div>
            {permissions.map((permission) => (
              <div className="matrix-row" key={permission.label}>
                <span>{permission.label}</span>
                <b className={permission.admin ? "yes" : "no"}>
                  {permission.admin ? "Cho phép" : "Khóa"}
                </b>
                <b className={permission.perAccount ? "yes" : "no"}>
                  {permission.perAccount ? "Cho phép" : "Khóa"}
                </b>
                <b className={permission.readonly ? "yes" : "no"}>
                  {permission.readonly ? "Cho phép" : "Khóa"}
                </b>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          eyebrow="ADMIN NOTES"
          title="Checklist quản trị"
          icon={ShieldCheck}
        >
          <div className="auth-rule-list compact-list">
            <div className="auth-rule">
              <b>1</b>
              <span>
                Đổi ADMIN_PASSWORD trong backend/.env trước khi dùng thật.
              </span>
            </div>
            <div className="auth-rule">
              <b>2</b>
              <span>
                Người dùng phải có tên trong hồ sơ MongoDB trước khi xin quyền.
              </span>
            </div>
            <div className="auth-rule">
              <b>3</b>
              <span>
                Kiểm tra Risk/IP/Fingerprint trước khi duyệt để hạn chế 1 người
                tạo nhiều hồ sơ.
              </span>
            </div>
            <div className="auth-rule">
              <b>4</b>
              <span>
                Khi dùng chung máy, bấm Đăng xuất admin sau khi thao tác xong.
              </span>
            </div>
          </div>
        </Panel>
      </div>

      <DecisionReasonDialog
        action={decisionAction}
        onClose={() => setDecisionAction(null)}
        onConfirm={confirmReason}
      />
    </div>
  );
}

export function SecurityPage({ isAdmin, accounts = [] }) {
  const expired = accounts.filter(
    (item) => normalizeStatus(item.status) === "expired",
  ).length;
  const disabled = accounts.filter(
    (item) => normalizeStatus(item.status) === "disabled",
  ).length;
  const missingRenewal = accounts.filter(
    (item) =>
      !item.renewalDate &&
      ["plus", "pro", "team", "enterprise"].includes(item.planVersion),
  ).length;
  const securityRules = [
    {
      label: "Danh sách chỉ trả passwordMasked, không trả mật khẩu thật",
      ok: true,
    },
    {
      label: "Mật khẩu được mã hóa AES-256-GCM trước khi lưu MongoDB",
      ok: true,
    },
    {
      label:
        "Thêm / xóa / backup cần admin session cookie; xem pass có thể dùng quyền riêng từng tài khoản",
      ok: true,
    },
    { label: "Route xem mật khẩu có rate-limit", ok: true },
    { label: "Backup cần giữ đúng ENCRYPTION_KEY để restore", ok: true },
    {
      label: "Tài khoản trả phí nên có ngày gia hạn",
      ok: missingRenewal === 0,
    },
  ];
  const score = Math.round(
    (securityRules.filter((rule) => rule.ok).length / securityRules.length) *
      100,
  );

  return (
    <div className="page-stack">
      <div className="metric-grid four">
        <MetricTile
          label="Security score"
          value={`${score}%`}
          helper="Theo checklist"
          icon={ShieldCheck}
          tone={score >= 80 ? "success" : "warning"}
        />
        <MetricTile
          label="Xem mật khẩu"
          value={isAdmin ? "Mở" : "Khóa"}
          helper="Theo phiên hiện tại"
          icon={KeyRound}
          tone={isAdmin ? "success" : "warning"}
        />
        <MetricTile
          label="Expired"
          value={expired}
          helper="Nên xử lý"
          icon={AlertTriangle}
          tone="warning"
        />
        <MetricTile
          label="Disabled"
          value={disabled}
          helper="Nên kiểm tra"
          icon={Lock}
          tone="danger"
        />
      </div>

      <div className="two-column-grid">
        <Panel
          eyebrow="SECURITY"
          title="Lớp bảo vệ"
          icon={KeyRound}
          subtitle="Tóm tắt các lớp bảo mật chính của project."
        >
          <div className="security-steps">
            <div>
              <span>1</span>
              <b>Client</b>
              <p>Chỉ nhận mật khẩu dạng mask trong bảng.</p>
            </div>
            <div>
              <span>2</span>
              <b>Admin session cookie</b>
              <p>
                httpOnly cookie + CSRF mở khóa quyền admin; quyền riêng chỉ mở
                đúng một tài khoản.
              </p>
            </div>
            <div>
              <span>3</span>
              <b>Backend</b>
              <p>Mã hóa/giải mã bằng ENCRYPTION_KEY.</p>
            </div>
            <div>
              <span>4</span>
              <b>MongoDB</b>
              <p>Lưu passwordEncrypted, không lưu plaintext.</p>
            </div>
          </div>
        </Panel>

        <Panel eyebrow="CHECKLIST" title="Điểm cần kiểm tra" icon={ListChecks}>
          <div className="security-check-list">
            {securityRules.map((rule) => (
              <div className={rule.ok ? "ok" : "warn"} key={rule.label}>
                {rule.ok ? (
                  <CheckCircle2 size={17} />
                ) : (
                  <AlertTriangle size={17} />
                )}
                <span>{rule.label}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel eyebrow="RISK WATCH" title="Cảnh báo dữ liệu" icon={AlertTriangle}>
        <div className="permission-grid wide">
          <div className={missingRenewal ? "blocked" : "allowed"}>
            Gói trả phí thiếu ngày gia hạn: {missingRenewal}
          </div>
          <div className={expired ? "blocked" : "allowed"}>
            Tài khoản hết hạn: {expired}
          </div>
          <div className={disabled ? "blocked" : "allowed"}>
            Tài khoản bị khóa: {disabled}
          </div>
          <div className="allowed">Audit log: Bật</div>
        </div>
      </Panel>
    </div>
  );
}

export function BackupPage({
  adminToken,
  isAdmin,
  onBlockedAction,
  onRefresh,
}) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    if (!isAdmin) return onBlockedAction?.("sao lưu dữ liệu");
    try {
      setBusy(true);
      setError("");
      const response = await backupService.exportBackup(adminToken);
      const blob = new Blob([JSON.stringify(response.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `account-vault-backup-${new Date().toISOString().slice(0, 10)}-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage("Đã xuất file backup JSON.");
      onRefresh?.();
    } catch (err) {
      setError(err.message || "Không xuất được backup");
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!isAdmin) return onBlockedAction?.("import backup");

    try {
      setBusy(true);
      setError("");
      const text = await file.text();
      const payload = JSON.parse(text);
      const response = await backupService.importBackup(payload, adminToken);
      setMessage(response.message || "Import backup thành công.");
      onRefresh?.();
    } catch (err) {
      setError(err.message || "Không import được backup");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="hero-panel mini-hero">
        <div>
          <p className="tool-eyebrow">BACKUP VAULT</p>
          <h1>Sao lưu và khôi phục dữ liệu an toàn.</h1>
          <span>
            Backup xuất dữ liệu hiện có. Khi restore sang máy khác, cần dùng lại
            đúng ENCRYPTION_KEY cũ để giải mã được mật khẩu.
          </span>
        </div>
        <div className="hero-actions">
          <button
            className="btn-tool-primary"
            type="button"
            onClick={handleExport}
            disabled={busy || !isAdmin}
          >
            <Download size={18} /> Xuất backup
          </button>
          <label
            className={`btn-tool-ghost ${busy || !isAdmin ? "disabled-like" : ""}`}
          >
            <Upload size={18} /> Import backup
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={handleImport}
              disabled={busy || !isAdmin}
            />
          </label>
        </div>
      </section>

      {message && <div className="tool-alert success">{message}</div>}
      {error && <div className="tool-alert danger">{error}</div>}

      <div className="metric-grid three">
        <MetricTile
          label="Quyền backup"
          value={isAdmin ? "Cho phép" : "Đang khóa"}
          helper="Cần admin session"
          icon={DatabaseBackup}
          tone={isAdmin ? "success" : "warning"}
        />
        <MetricTile
          label="Định dạng"
          value="JSON"
          helper="Dễ lưu và restore"
          icon={FileJson}
          tone="blue"
        />
        <MetricTile
          label="Trạng thái"
          value={busy ? "Đang xử lý" : "Sẵn sàng"}
          helper="Import / Export"
          icon={RefreshCw}
        />
      </div>

      <div className="two-column-grid">
        <Panel
          eyebrow="BACKUP GUIDE"
          title="Quy trình đề xuất"
          icon={DatabaseBackup}
        >
          <div className="security-steps backup-steps">
            <div>
              <span>1</span>
              <b>Export</b>
              <p>Tải file JSON sau mỗi lần cập nhật nhiều dữ liệu.</p>
            </div>
            <div>
              <span>2</span>
              <b>Store</b>
              <p>Lưu file ở nơi riêng tư, không gửi công khai.</p>
            </div>
            <div>
              <span>3</span>
              <b>Key</b>
              <p>Giữ ENCRYPTION_KEY cũ nếu chuyển máy.</p>
            </div>
            <div>
              <span>4</span>
              <b>Import</b>
              <p>Chọn file JSON để restore lại MongoDB.</p>
            </div>
          </div>
        </Panel>

        <Panel
          eyebrow="SAFETY"
          title="Lưu ý trước khi import"
          icon={AlertTriangle}
        >
          <div className="auth-rule-list compact-list">
            <div className="auth-rule">
              <b>!</b>
              <span>
                Import có thể thêm/cập nhật dữ liệu theo logic backend hiện tại.
              </span>
            </div>
            <div className="auth-rule">
              <b>!</b>
              <span>
                Không chỉnh sửa thủ công trường passwordEncrypted nếu không hiểu
                định dạng.
              </span>
            </div>
            <div className="auth-rule">
              <b>!</b>
              <span>
                Backup chứa dữ liệu nhạy cảm đã mã hóa, vẫn nên cất cẩn thận.
              </span>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

export function NotificationsPage({
  accounts,
  setFilters,
  onNavigate,
  isAdmin = false,
  visitorName = "",
  visitorId = "",
}) {
  function sameUser(value) {
    return (
      String(value || "")
        .trim()
        .toLowerCase() ===
      String(visitorName || "")
        .trim()
        .toLowerCase()
    );
  }

  function sameVisitor(request) {
    if (
      visitorId &&
      request?.requesterVisitorId &&
      request.requesterVisitorId === visitorId
    )
      return true;
    return sameUser(request?.requesterName);
  }

  const accessRows = useMemo(() => {
    return accounts.flatMap((account) =>
      (account.accessRequests || [])
        .filter(
          (request) =>
            (isAdmin && !request.hiddenFromAdmin) ||
            (!isAdmin && sameVisitor(request)),
        )
        .map((request) => {
          const labels = {
            pending: isAdmin
              ? "Yêu cầu đang chờ duyệt"
              : "Bạn đã gửi yêu cầu, đang chờ admin",
            approved: isAdmin
              ? "Đã cấp quyền cho người dùng"
              : "Admin đã cấp quyền cho bạn",
            rejected: isAdmin
              ? "Đã từ chối yêu cầu"
              : "Admin đã từ chối yêu cầu",
            revoked: isAdmin
              ? "Đã thu hồi quyền"
              : "Admin đã thu hồi quyền của bạn",
          };
          const tone =
            request.status === "approved"
              ? "success"
              : request.status === "pending"
                ? "warning"
                : "danger";
          return {
            key: `access-${account._id}-${request._id}-${request.status}-${request.decidedAt || request.requestedAt}`,
            source: "Admin / Quyền truy cập",
            type: labels[request.status] || "Cập nhật quyền truy cập",
            tone,
            account,
            status: request.status,
            createdAt: request.decidedAt || request.requestedAt,
            detail: isAdmin
              ? `${request.requesterName} · ${account.accountName}`
              : account.accountName,
            reason: request.decisionReason || "",
            priority:
              request.status === "pending"
                ? 1
                : request.status === "approved"
                  ? 2
                  : 3,
          };
        }),
    );
  }, [accounts, isAdmin, visitorName, visitorId]);

  const scopedAccounts = useMemo(() => {
    if (isAdmin) return accounts;
    return accounts.filter((account) =>
      (account.accessRequests || []).some(
        (request) => sameVisitor(request) && request.status === "approved",
      ),
    );
  }, [accounts, isAdmin, visitorName, visitorId]);

  const systemRows = useMemo(() => {
    const makeRow = (account, type, priority, tone = "warning") => ({
      key: `system-${account._id}-${type}`,
      source: "Hệ thống",
      type,
      tone,
      account,
      status: account.status,
      createdAt: account.updatedAt || account.createdAt,
      days: daysUntil(account.renewalDate),
      detail: account.renewalDate
        ? formatDateTime(account.renewalDate)
        : "Chưa đặt ngày",
      priority,
    });

    const expired = scopedAccounts.filter(
      (item) =>
        normalizeStatus(item.status) === "expired" ||
        daysUntil(item.renewalDate) < 0,
    );
    const due7 = scopedAccounts.filter((item) => {
      const days = daysUntil(item.renewalDate);
      return days !== null && days >= 0 && days <= 7;
    });
    const due30 = scopedAccounts.filter((item) => {
      const days = daysUntil(item.renewalDate);
      return days !== null && days > 7 && days <= 30;
    });
    const missingRenewal = scopedAccounts.filter(
      (item) =>
        !item.renewalDate &&
        ["plus", "pro", "team", "enterprise"].includes(item.planVersion),
    );
    const newAccounts = scopedAccounts.filter(
      (item) => normalizeStatus(item.status) === "new",
    );

    return [
      ...expired.map((account) =>
        makeRow(account, "Đã hết hạn / cần kiểm tra", 1, "danger"),
      ),
      ...due7.map((account) =>
        makeRow(account, "Sắp đến hạn trong 7 ngày", 2, "warning"),
      ),
      ...due30.map((account) =>
        makeRow(account, "Sắp đến hạn trong 30 ngày", 3, "blue"),
      ),
      ...missingRenewal.map((account) =>
        makeRow(account, "Gói trả phí thiếu ngày gia hạn", 4, "warning"),
      ),
      ...newAccounts.map((account) =>
        makeRow(account, "Tài khoản mới chưa kích hoạt", 5, "default"),
      ),
    ];
  }, [scopedAccounts]);

  const rows = useMemo(() => {
    return [...accessRows, ...systemRows]
      .filter(
        (row, index, arr) =>
          arr.findIndex((item) => item.key === row.key) === index,
      )
      .sort(
        (a, b) =>
          a.priority - b.priority ||
          new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
      );
  }, [accessRows, systemRows]);

  const accessGranted = accessRows.filter(
    (row) => row.status === "approved",
  ).length;
  const accessPending = accessRows.filter(
    (row) => row.status === "pending",
  ).length;
  const accessRevoked = accessRows.filter(
    (row) => row.status === "revoked" || row.status === "rejected",
  ).length;
  const systemCount = systemRows.length;

  function openStatus(status) {
    setFilters?.((prev) => ({ ...prev, status }));
    onNavigate?.("accounts");
  }

  return (
    <div className="page-stack">
      <section className="hero-panel mini-hero">
        <div>
          <p className="tool-eyebrow">NOTIFICATION CENTER</p>
          <h1>
            {isAdmin
              ? "Theo dõi cảnh báo hệ thống và yêu cầu quyền."
              : "Thông báo riêng của bạn từ admin và hệ thống."}
          </h1>
          <span>
            {isAdmin
              ? "Admin thấy toàn bộ cảnh báo tài khoản và các yêu cầu xin quyền đang chờ xử lý."
              : "Người dùng thường chỉ thấy thông báo liên quan đến hồ sơ MongoDB của mình và các tài khoản đã được cấp quyền."}
          </span>
        </div>
        <div className="hero-actions">
          <button
            className="btn-tool-ghost"
            type="button"
            onClick={() => openStatus("expired")}
          >
            <CalendarClock size={18} /> Xem Expired
          </button>
          <button
            className="btn-tool-primary"
            type="button"
            onClick={() => openStatus("new")}
          >
            <Bell size={18} /> Xem New
          </button>
        </div>
      </section>

      <div className="metric-grid four">
        <MetricTile
          label="Cấp quyền"
          value={accessGranted}
          helper={isAdmin ? "Đã duyệt" : "Bạn được cấp"}
          icon={CheckCircle2}
          tone="success"
        />
        <MetricTile
          label="Chờ duyệt"
          value={accessPending}
          helper="Yêu cầu quyền"
          icon={Clock3}
          tone="warning"
        />
        <MetricTile
          label="Thu hồi/Từ chối"
          value={accessRevoked}
          helper="Cập nhật từ admin"
          icon={ShieldOff}
          tone="danger"
        />
        <MetricTile
          label="Hệ thống"
          value={systemCount}
          helper={isAdmin ? "Toàn bộ cảnh báo" : "Tài khoản được cấp"}
          icon={Bell}
          tone="blue"
        />
      </div>

      <Panel
        eyebrow="ALERT QUEUE"
        title="Danh sách thông báo"
        icon={Bell}
        subtitle="Các thông báo chưa xem sẽ hiện badge ở sidebar. Badge tự mất sau khi mở trang này."
        actions={
          <button
            className="btn-tool-ghost small"
            type="button"
            onClick={() => openStatus("active")}
          >
            <CheckCircle2 size={15} /> Xem Active
          </button>
        }
      >
        {rows.length ? (
          <div className="vault-table-wrap">
            <table className="vault-table">
              <thead>
                <tr>
                  <th>Thông báo</th>
                  <th>Tài khoản</th>
                  <th>Nguồn</th>
                  <th>Chi tiết</th>
                  <th>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td>
                      <span className={`vault-badge notify-${row.tone}`}>
                        {row.type}
                      </span>
                      {row.days !== undefined && row.days !== null && (
                        <small className="d-block text-secondary-light">
                          {row.days < 0
                            ? `Quá hạn ${Math.abs(row.days)} ngày`
                            : `Còn ${row.days} ngày`}
                        </small>
                      )}
                    </td>
                    <td>
                      <div className="user-cell">
                        <strong>{row.account.accountName}</strong>
                        <small>
                          {isAdmin
                            ? row.account.loginEmail
                            : row.account.ownerName}
                        </small>
                      </div>
                    </td>
                    <td>{row.source}</td>
                    <td>
                      {row.detail || "-"}
                      {row.reason && (
                        <small className="d-block text-secondary-light">
                          Lý do: {row.reason}
                        </small>
                      )}
                    </td>
                    <td>
                      {row.createdAt
                        ? formatDateTime(row.createdAt)
                        : "Chưa có"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Không có thông báo mới"
            message={
              isAdmin
                ? "Chưa có yêu cầu quyền hoặc cảnh báo hệ thống cần xử lý."
                : "Khi admin cấp/thu hồi quyền hoặc tài khoản được cấp có cảnh báo, thông báo sẽ hiện ở đây."
            }
          />
        )}
      </Panel>
    </div>
  );
}

export function OtpManagerPage({
  isAdmin = false,
  adminToken = "",
  visitorName = "",
  visitorId = "",
  syncTick = 0,
}) {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
  const backendToolUrl = apiUrl.replace(/\/api\/?$/, "") + "/mail-tool";
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({
    imapEmail: "",
    appPassword: "",
    imapHost: "imap.gmail.com",
    imapPort: 993,
    senderEmail: "noreply@tm.openai.com, noreply@tm1.openai.com",
    mailbox: "INBOX",
    searchDays: 30,
    fetchLimit: 300,
    enabled: false,
  });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function applyConfig(nextConfig = {}) {
    setConfig(nextConfig);
    setForm((prev) => ({
      ...prev,
      imapEmail: nextConfig.imapEmail || "",
      appPassword: "",
      imapHost: nextConfig.imapHost || "imap.gmail.com",
      imapPort: nextConfig.imapPort || 993,
      senderEmail:
        (Array.isArray(nextConfig.senderEmails) &&
        nextConfig.senderEmails.length
          ? nextConfig.senderEmails.join(", ")
          : nextConfig.senderEmail) ||
        "noreply@tm.openai.com, noreply@tm1.openai.com",
      mailbox: nextConfig.mailbox || "INBOX",
      searchDays: nextConfig.searchDays || 30,
      fetchLimit: nextConfig.fetchLimit || 300,
      enabled: Boolean(nextConfig.enabled),
    }));
  }

  async function loadOtpData({ silent = false } = {}) {
    try {
      if (!silent) setLoading(true);
      setError("");
      const requests = [
        otpService.getLogs({ adminToken, visitorName, visitorId, limit: 240 }),
      ];
      if (isAdmin) requests.unshift(otpService.getConfig(adminToken));
      const results = await Promise.all(requests);
      if (isAdmin) {
        applyConfig(results[0].data || {});
        setLogs(results[1].data || []);
      } else {
        setLogs(results[0].data || []);
      }
    } catch (err) {
      setError(err.message || "Không tải được OTP Manager");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOtpData({ silent: syncTick > 0 });
  }, [isAdmin, adminToken, visitorName, visitorId, syncTick]);

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function saveConfig() {
    if (!isAdmin) return;
    try {
      setBusy(true);
      setError("");
      setMessage("");
      const response = await otpService.saveConfig(form, adminToken);
      applyConfig(response.data || {});
      setMessage(response.message || "Đã lưu cấu hình mail.");
    } catch (err) {
      setError(err.message || "Không lưu được cấu hình mail.");
    } finally {
      setBusy(false);
    }
  }

  async function testConfig() {
    if (!isAdmin) return;
    try {
      setBusy(true);
      setError("");
      setMessage("Đang test IMAP...");
      const response = await otpService.testConfig(adminToken);
      applyConfig(response.data || {});
      setMessage(response.message || "Test IMAP thành công.");
    } catch (err) {
      setMessage("");
      setError(err.message || "Test IMAP thất bại.");
    } finally {
      setBusy(false);
    }
  }

  const successCount = logs.filter((log) =>
    ["success", "login_confirmed"].includes(log.status),
  ).length;
  const failCount = logs.filter((log) =>
    ["error", "not_found", "config_missing"].includes(log.status),
  ).length;
  const bindCount = logs.filter((log) => log.status === "bound").length;
  const cooldownCount = logs.filter((log) => log.status === "cooldown").length;
  const uniqueUsers = new Set(
    logs
      .map((log) => log.requesterVisitorId || log.requesterName)
      .filter(Boolean),
  ).size;

  const statusClass = (status) => {
    if (status === "success" || status === "login_confirmed")
      return "notify-success";
    if (
      status === "not_found" ||
      status === "bound" ||
      status === "login_not_confirmed" ||
      status === "cooldown"
    )
      return "notify-warning";
    return "notify-danger";
  };

  return (
    <div className="page-stack">
      <section className="hero-panel mini-hero">
        <div>
          <p className="tool-eyebrow">OTP MANAGER</p>
          <h1>Quản lý lấy OTP theo đúng email đăng nhập từng tài khoản.</h1>
          <span>
            Khi người dùng mở khung xem mật khẩu, backend gán email đăng nhập
            của tài khoản đó cho phiên lấy OTP. Nút Get OTP sẽ lấy mail mới nhất
            từ ChatGPT &lt;noreply@tm.openai.com&gt; hoặc
            &lt;noreply@tm1.openai.com&gt; và check đúng toàn bộ email người
            nhận theo header To/Delivered-To/Received, kể cả phần +tag trước
            @gmail.com. Hệ thống không lấy cache log cũ mà quét mailbox mỗi lần
            bấm Get OTP, đồng thời có cooldown theo từng người dùng + từng tài
            khoản để tránh spam IMAP.
          </span>
        </div>
        <div className="hero-actions">
          <button
            className="btn-tool-ghost"
            type="button"
            onClick={loadOtpData}
            disabled={loading}
          >
            <RefreshCw size={18} /> Làm mới
          </button>
          {isAdmin && (
            <a
              className="btn-tool-primary"
              href={backendToolUrl}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={18} /> Backend Mail Tool
            </a>
          )}
        </div>
      </section>

      {message && <div className="tool-alert success">{message}</div>}
      {error && <div className="tool-alert danger">{error}</div>}

      <div className="metric-grid four">
        <MetricTile
          label="OTP thành công"
          value={successCount}
          helper="Lấy được mã"
          icon={KeyRound}
          tone="success"
        />
        <MetricTile
          label="Lỗi / Không thấy"
          value={failCount}
          helper="Cần kiểm tra mail"
          icon={AlertTriangle}
          tone="warning"
        />
        <MetricTile
          label="Đã gán nhãn"
          value={bindCount}
          helper="Từ thao tác xem pass"
          icon={Mail}
          tone="blue"
        />
        <MetricTile
          label="Cooldown"
          value={cooldownCount}
          helper="Bấm lại quá sớm"
          icon={Clock3}
          tone="warning"
        />
      </div>

      {isAdmin && (
        <Panel
          eyebrow="MAIL CONFIG"
          title="Cấu hình mail nhận OTP"
          icon={Mail}
          subtitle="Cấu hình này lưu MongoDB. Mã ứng dụng được mã hóa bằng ENCRYPTION_KEY và không hiển thị lại sau khi lưu."
          actions={
            <button
              className="btn-tool-ghost small"
              type="button"
              onClick={testConfig}
              disabled={busy || !config?.hasAppPassword}
            >
              {busy ? (
                <Loader2 size={15} className="spin-icon" />
              ) : (
                <ShieldCheck size={15} />
              )}{" "}
              Test IMAP
            </button>
          }
        >
          <div className="toolbar-grid otp-config-grid">
            <label className="tool-field">
              <span>Email mailbox</span>
              <input
                className="tool-input"
                value={form.imapEmail}
                onChange={(event) => setField("imapEmail", event.target.value)}
                placeholder="yourmail@gmail.com"
              />
            </label>
            <label className="tool-field">
              <span>Mã ứng dụng mail</span>
              <input
                className="tool-input"
                type="password"
                value={form.appPassword}
                onChange={(event) =>
                  setField("appPassword", event.target.value)
                }
                placeholder={
                  config?.hasAppPassword
                    ? "Để trống nếu không đổi mã"
                    : "Nhập mã ứng dụng Gmail"
                }
              />
            </label>
            <label className="tool-field">
              <span>IMAP Host</span>
              <input
                className="tool-input"
                value={form.imapHost}
                onChange={(event) => setField("imapHost", event.target.value)}
              />
            </label>
            <label className="tool-field">
              <span>IMAP Port</span>
              <input
                className="tool-input"
                type="number"
                value={form.imapPort}
                onChange={(event) => setField("imapPort", event.target.value)}
              />
            </label>
            <label className="tool-field">
              <span>Người gửi OTP</span>
              <input
                className="tool-input"
                value={form.senderEmail}
                onChange={(event) =>
                  setField("senderEmail", event.target.value)
                }
                placeholder="noreply@tm.openai.com, noreply@tm1.openai.com"
              />
            </label>
            <label className="tool-field">
              <span>Mailbox</span>
              <input
                className="tool-input"
                value={form.mailbox}
                onChange={(event) => setField("mailbox", event.target.value)}
              />
            </label>
            <label className="tool-field">
              <span>Số ngày quét</span>
              <input
                className="tool-input"
                type="number"
                min="1"
                max="365"
                value={form.searchDays}
                onChange={(event) => setField("searchDays", event.target.value)}
              />
            </label>
            <label className="tool-field">
              <span>Số email tối đa</span>
              <input
                className="tool-input"
                type="number"
                min="20"
                max="1000"
                value={form.fetchLimit}
                onChange={(event) => setField("fetchLimit", event.target.value)}
              />
            </label>
          </div>
          <div className="panel-actions mt-3 justify-content-between">
            <label className="toggle-line">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => setField("enabled", event.target.checked)}
              />{" "}
              Bật module lấy OTP
            </label>
            <button
              className="btn-tool-primary"
              type="button"
              onClick={saveConfig}
              disabled={busy}
            >
              {busy ? (
                <Loader2 size={17} className="spin-icon" />
              ) : (
                <Mail size={17} />
              )}{" "}
              Lưu cấu hình mail
            </button>
          </div>
          <p className="panel-note mt-3 mb-0">
            Với Gmail, hãy bật IMAP trong Gmail Settings và dùng App Password.
            Người gửi OTP có thể nhập nhiều mail, cách nhau bằng dấu phẩy. Hệ
            thống luôn so khớp exact người nhận như user+tag@gmail.com, không tự
            bỏ phần +tag.
          </p>
        </Panel>
      )}

      <Panel
        eyebrow="OTP HISTORY"
        title={isAdmin ? "Toàn bộ lịch sử Get OTP" : "Lịch sử Get OTP của bạn"}
        icon={ListChecks}
        subtitle={
          isAdmin
            ? "Admin xem toàn bộ người dùng, tài khoản, email nhận và kết quả OTP."
            : "Người dùng thường chỉ thấy lịch sử OTP của chính visitorId/tên hiển thị hiện tại."
        }
      >
        {loading ? (
          <div className="vault-table-empty">
            <div className="spinner-border text-success" role="status" />
            <p>Đang tải lịch sử OTP...</p>
          </div>
        ) : logs.length ? (
          <div className="vault-table-wrap otp-history-wrap">
            <table className="vault-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Trạng thái</th>
                  <th>Người dùng</th>
                  <th>Tài khoản</th>
                  <th>Email nhận</th>
                  <th>OTP</th>
                  <th>Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id}>
                    <td>
                      <span className="updated-cell">
                        {formatDateTime(log.createdAt)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`vault-badge ${statusClass(log.status)}`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td>
                      <div className="user-cell">
                        <strong>
                          {log.requesterName || log.requestedByRole || "-"}
                        </strong>
                        <small>{log.requesterVisitorId || "admin"}</small>
                      </div>
                    </td>
                    <td>{log.accountName || "-"}</td>
                    <td>{log.recipientEmail || log.loginEmail || "-"}</td>
                    <td>
                      {log.otpCode ? (
                        <b className="otp-code-table">{log.otpCode}</b>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <span>{log.subject || log.message || "-"}</span>
                      {log.receivedAt && (
                        <small className="d-block text-secondary-light">
                          Mail: {formatDateTime(log.receivedAt)}
                        </small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Chưa có lịch sử OTP"
            message="Khi bấm Get OTP ở khung xem mật khẩu, kết quả sẽ được lưu vào MongoDB và hiển thị tại đây."
          />
        )}
      </Panel>
    </div>
  );
}
