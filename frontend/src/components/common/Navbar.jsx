import {
  Activity,
  Bell,
  BookOpenText,
  Database,
  DatabaseBackup,
  Eye,
  LayoutDashboard,
  ListChecks,
  KeyRound,
  Lock,
  LogOut,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  ShieldHalf,
  Terminal,
  UsersRound,
  X,
} from "lucide-react";

export default function Navbar({
  activePage,
  onNavigate,
  isAdmin,
  accessMode = "guest",
  onLogout,
  visitorName = "",
  onBlockedAction,
  totalRecords = 0,
  filters,
  setFilters,
  notificationCount = 0,
}) {
  const navItems = [
    { key: "dashboard", label: "Tổng quan", icon: LayoutDashboard },
    { key: "accounts", label: "Quản lý tài khoản", icon: Database },
    { key: "guide", label: "Hướng dẫn sử dụng", icon: BookOpenText },
    { key: "services", label: "Gói dịch vụ", icon: ListChecks },
    { key: "otp", label: "Manager OTP", icon: KeyRound, adminOnly: true },
    { key: "activity", label: "Nhật ký hoạt động", icon: Activity },
    { key: "settings", label: "Cài đặt hệ thống", icon: Settings },
    {
      key: "admins",
      label: "Quản lý Admin",
      icon: UsersRound,
      adminOnly: true,
    },
    { key: "security", label: "Bảo mật", icon: ShieldHalf, adminOnly: true },
    {
      key: "backup",
      label: "Sao lưu dữ liệu",
      icon: DatabaseBackup,
      adminOnly: true,
    },
    {
      key: "notifications",
      label: "Thông báo",
      icon: Bell,
      badge: notificationCount,
    },
    {
      key: "create",
      label: "Thêm tài khoản",
      icon: Plus,
      adminOnly: true,
      primary: true,
    },
  ];

  const pageTitles = {
    dashboard: "Tổng quan",
    accounts: "Quản lý tài khoản",
    guide: "Hướng dẫn sử dụng",
    services: "Gói dịch vụ",
    otp: "Manager OTP",
    activity: "Nhật ký hoạt động",
    settings: "Cài đặt hệ thống",
    admins: "Quản lý Admin",
    security: "Bảo mật",
    backup: "Sao lưu dữ liệu",
    notifications: "Thông báo",
    create: "Thêm tài khoản",
  };

  const lockedLabels = {
    admins: "mở Quản lý Admin",
    security: "mở Bảo mật",
    backup: "sao lưu dữ liệu",
    otp: "mở Manager OTP",
    create: "thêm tài khoản",
  };

  const searchValue = filters?.search || "";
  const isGuest = accessMode === "guest";
  const isUser = accessMode === "user";

  function handleNavigate(item) {
    if (item.adminOnly && !isAdmin) {
      onBlockedAction?.(lockedLabels[item.key] || item.label);
      return;
    }
    onNavigate(item.key);
  }

  function handleSearchChange(event) {
    setFilters?.((prev) => ({ ...prev, search: event.target.value }));
  }

  function handleSearchKeyDown(event) {
    if (event.key === "Enter" && activePage !== "accounts") {
      onNavigate("accounts");
    }
  }

  function clearSearch() {
    setFilters?.((prev) => ({ ...prev, search: "" }));
  }

  return (
    <>
      <aside className="vault-sidebar">
        <button
          className="vault-brand"
          type="button"
          onClick={() => onNavigate("dashboard")}
        >
          <span className="brand-terminal">
            <Terminal size={25} />
          </span>
          <span>
            <strong>AccountHub</strong>
            <small>v2.5.0 auth gateway</small>
          </span>
        </button>

        <nav className="vault-nav-list" aria-label="Main navigation">
          <span className="sidebar-section-title">Menu</span>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.key;
            const locked = item.adminOnly && !isAdmin;
            const count = Number(item.badge || 0);

            return (
              <button
                key={item.key}
                className={`vault-nav-item ${active ? "active" : ""} ${locked ? "locked" : ""} ${item.primary ? "nav-primary" : ""}`}
                type="button"
                onClick={() => handleNavigate(item)}
                title={
                  locked
                    ? "Tính năng này bị khóa, cần đăng nhập admin"
                    : item.label
                }
                data-testid={`nav-item-${item.key}`}
              >
                {locked ? <Lock size={19} /> : <Icon size={19} />}
                <span>{item.label}</span>
                {locked && (
                  <em className="nav-lock-dot">
                    <Lock size={12} />
                  </em>
                )}
                {!locked && item.key === "notifications" && count > 0 && (
                  <b className="nav-badge">{count > 99 ? "99+" : count}</b>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-spacer" />

        <div className="mode-card">
          <div className={`mode-icon ${isAdmin ? "admin" : "readonly"}`}>
            {isAdmin ? <ShieldCheck size={21} /> : <Eye size={21} />}
          </div>
          <div>
            <strong>
              {visitorName || (isAdmin ? "Admin actions" : "Read-only mode")}
            </strong>
            <small>
              {isAdmin
                ? "Admin actions enabled"
                : isUser
                  ? "User access mode"
                  : "Guest view only"}
            </small>
          </div>
        </div>

        <div className="sidebar-footer">
          <span>{totalRecords} records</span>
          <small>
            {isAdmin
              ? "Phiên admin có cookie bảo mật"
              : isUser
                ? "Tài khoản user MongoDB"
                : "Khách chỉ xem"}
          </small>
          {(isAdmin || isUser || isGuest) && (
            <button className="sidebar-logout" type="button" onClick={onLogout}>
              <LogOut size={15} /> {isGuest ? "Đăng nhập" : "Đăng xuất"}
            </button>
          )}
        </div>
      </aside>

      <header className="vault-topbar">
        <div className="topbar-title">
          <span className="status-dot" />
          <div>
            <strong>{pageTitles[activePage] || "AccountHub"}</strong>
            <small>
              {isAdmin
                ? `Admin access unlocked · ${visitorName}`
                : isUser
                  ? `User account · ${visitorName}`
                  : `Guest view only · ${visitorName}`}
            </small>
          </div>
        </div>

        <label className="top-search">
          <Search size={18} />
          <input
            aria-label="Tìm tài khoản"
            placeholder="Tìm kiếm nhanh..."
            value={searchValue}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            data-testid="topbar-search-input"
          />
          {searchValue ? (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Xóa tìm kiếm"
              data-testid="topbar-search-clear"
            >
              <X size={16} />
            </button>
          ) : (
            <kbd>⌘K</kbd>
          )}
        </label>

        <button
          className={`top-notification-button ${notificationCount > 0 ? "has-unread" : ""}`}
          type="button"
          onClick={() => onNavigate("notifications")}
          title={
            notificationCount > 0
              ? `${notificationCount} thông báo chưa xem`
              : "Thông báo"
          }
        >
          <Bell size={18} />
          {notificationCount > 0 && (
            <span>{notificationCount > 99 ? "99+" : notificationCount}</span>
          )}
        </button>

        <div className={`access-pill ${isAdmin ? "admin" : "readonly"}`}>
          {isAdmin ? <ShieldCheck size={17} /> : <Lock size={17} />}
          <span>{isAdmin ? "ADMIN" : isUser ? "USER" : "GUEST"}</span>
        </div>

        {(isAdmin || isUser || isGuest) && (
          <button
            className="topbar-logout"
            type="button"
            onClick={onLogout}
            title={isGuest ? "Đăng nhập tài khoản" : "Đăng xuất"}
          >
            <LogOut size={17} />
          </button>
        )}
      </header>
    </>
  );
}
