import { useEffect, useMemo, useState } from "react";
import Navbar from "./components/common/Navbar";
import AiChatBox from "./components/common/AiChatBox";
import AppFooter from "./components/common/AppFooter";
import AlertBox from "./components/common/AlertBox";
import EditAccountModal from "./components/accounts/EditAccountModal";
import RevealPasswordModal from "./components/accounts/RevealPasswordModal";
import ConfirmModal from "./components/common/ConfirmModal";
import AdminGate from "./components/common/AdminGate";
import VisitorNameGate from "./components/common/VisitorNameGate";
import PermissionBanner from "./components/common/PermissionBanner";
import LockedPanel from "./components/common/LockedPanel";
import DashboardPage from "./pages/DashboardPage";
import AccountsPage from "./pages/AccountsPage";
import CreateAccountPage from "./pages/CreateAccountPage";
import {
  ActivityPage,
  AdminManagementPage,
  BackupPage,
  GuidePage,
  NotificationsPage,
  OtpManagerPage,
  SecurityPage,
  ServicesPage,
  SettingsPage,
} from "./pages/SystemPages";
import { useAccounts } from "./hooks/useAccounts";
import { useRealtimeSync } from "./hooks/useRealtimeSync";
import { profileService } from "./services/profileService";
import { adminService } from "./services/adminService";
import { authService } from "./services/authService";
import { otpService } from "./services/otpService";
import { DEFAULT_PREFERENCES, normalizePreferences } from "./utils/preferences";

function isUnsetName(value) {
  return (
    !String(value || "").trim() ||
    String(value || "")
      .trim()
      .toLowerCase() === "non"
  );
}

function sameName(a, b) {
  return (
    String(a || "")
      .trim()
      .toLowerCase() ===
    String(b || "")
      .trim()
      .toLowerCase()
  );
}

function getMyAccessRequest(account, visitorName, visitorId = "") {
  if (!account || (!visitorName && !visitorId)) return null;
  return (
    (account.accessRequests || []).find((request) => {
      if (
        visitorId &&
        request.requesterVisitorId &&
        request.requesterVisitorId === visitorId
      )
        return true;
      return visitorName && sameName(request.requesterName, visitorName);
    }) || null
  );
}

function hasAccountAccess(account, visitorName, visitorId = "") {
  if (!account) return false;
  return (account.accessRequests || []).some((request) => {
    const matchesVisitor =
      (visitorId &&
        request.requesterVisitorId &&
        request.requesterVisitorId === visitorId) ||
      (visitorName && sameName(request.requesterName, visitorName));
    return matchesVisitor && request.status === "approved";
  });
}

function normalizeStatus(status) {
  if (status === "in_use") return "active";
  if (status === "old") return "expired";
  if (status === "lost") return "disabled";
  return status || "new";
}

function daysUntil(value) {
  if (!value) return null;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil(
    (target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );
}

function buildNotificationKeys(accounts, visitorName, visitorId, isAdmin) {
  const keys = [];
  const relevantAccounts = isAdmin
    ? accounts
    : accounts.filter((account) =>
        hasAccountAccess(account, visitorName, visitorId),
      );

  accounts.forEach((account) => {
    (account.accessRequests || []).forEach((request) => {
      const isMine =
        (visitorId &&
          request.requesterVisitorId &&
          request.requesterVisitorId === visitorId) ||
        sameName(request.requesterName, visitorName);

      if (isAdmin) {
        if (request.status === "pending" && !request.hiddenFromAdmin) {
          keys.push(
            `access-${account._id}-${request._id}-${request.status}-${request.decidedAt || request.requestedAt}`,
          );
        }
      } else if (isMine) {
        keys.push(
          `access-${account._id}-${request._id}-${request.status}-${request.decidedAt || request.requestedAt}`,
        );
      }
    });
  });

  relevantAccounts.forEach((account) => {
    const status = normalizeStatus(account.status);
    const days = daysUntil(account.renewalDate);
    if (status === "expired" || (days !== null && days < 0))
      keys.push(`system-${account._id}-expired`);
    if (days !== null && days >= 0 && days <= 7)
      keys.push(`system-${account._id}-due7`);
    if (days !== null && days > 7 && days <= 30)
      keys.push(`system-${account._id}-due30`);
    if (
      !account.renewalDate &&
      ["plus", "pro", "team", "enterprise"].includes(account.planVersion)
    )
      keys.push(`system-${account._id}-missing-renewal`);
    if (status === "new") keys.push(`system-${account._id}-new`);
  });

  return Array.from(new Set(keys));
}

export default function App() {
  const [visitorId, setVisitorId] = useState("");
  const [visitorProfile, setVisitorProfile] = useState(null);
  const [visitorName, setVisitorName] = useState("non");
  const [userPreferences, setUserPreferences] = useState(DEFAULT_PREFERENCES);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [adminSessionLoading, setAdminSessionLoading] = useState(true);
  const [accessMode, setAccessMode] = useState("pending");
  const [authUser, setAuthUser] = useState(null);
  const [adminToken, setAdminToken] = useState("");
  const [adminExpiresAt, setAdminExpiresAt] = useState("");
  const [readOnlyMessage, setReadOnlyMessage] = useState("");
  const [activePage, setActivePage] = useState("dashboard");
  const [editingAccount, setEditingAccount] = useState(null);
  const [deletingAccount, setDeletingAccount] = useState(null);
  const [revealingAccount, setRevealingAccount] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [warningMessage, setWarningMessage] = useState("");
  const [seenNotificationKeys, setSeenNotificationKeys] = useState([]);
  const [realtimeTick, setRealtimeTick] = useState(0);

  const isAdmin = accessMode === "admin";
  const isGuest = accessMode === "guest";
  const isLoggedInUser = isAdmin || accessMode === "user";
  const notificationMode = isAdmin ? "admin" : "user";

  const {
    accounts,
    stats,
    loading,
    error,
    filters,
    setFilters,
    loadData,
    createAccount,
    updateAccount,
    deleteAccount,
    revealPassword,
    requestAccess,
    approveAccess,
    rejectAccess,
    revokeAccess,
    deleteAccess,
  } = useAccounts(adminToken, visitorName, visitorId);

  const realtimeEnabled = Boolean(
    visitorId &&
    !profileLoading &&
    !adminSessionLoading &&
    accessMode !== "pending",
  );

  useRealtimeSync({
    enabled: realtimeEnabled,
    pollingMs: 12000,
    onSync: async ({ payload = {} } = {}) => {
      await loadData();
      setRealtimeTick((value) => value + 1);

      const kind = String(payload.kind || "");
      const payloadVisitorId = String(payload.visitorId || "");
      if (
        kind.startsWith("profile:") &&
        (!payloadVisitorId || payloadVisitorId === visitorId)
      ) {
        const response = await profileService.getProfile();
        const profile = response.data || {};
        setVisitorId(profile.visitorId || "");
        setVisitorProfile(profile);
        setVisitorName(profile.displayName || "non");
        setUserPreferences(normalizePreferences(profile.preferences));
        setSeenNotificationKeys(
          profile.seenNotifications?.[notificationMode] || [],
        );
      }
    },
  });

  const notificationKeys = useMemo(
    () => buildNotificationKeys(accounts, visitorName, visitorId, isAdmin),
    [accounts, visitorName, visitorId, isAdmin],
  );
  const unreadNotificationCount = useMemo(
    () =>
      notificationKeys.filter((key) => !seenNotificationKeys.includes(key))
        .length,
    [notificationKeys, seenNotificationKeys],
  );

  useEffect(() => {
    let alive = true;

    async function loadProfile() {
      try {
        setProfileLoading(true);
        setProfileError("");
        const response = await profileService.getProfile();
        if (!alive) return;
        const profile = response.data || {};
        setVisitorId(profile.visitorId || "");
        setVisitorProfile(profile);
        setVisitorName(profile.displayName || "non");
        setUserPreferences(normalizePreferences(profile.preferences));
        const nextSeen = profile.seenNotifications?.[notificationMode] || [];
        setSeenNotificationKeys(nextSeen);
      } catch (err) {
        if (!alive) return;
        setProfileError(
          err.message || "Không tải được hồ sơ người dùng từ MongoDB.",
        );
      } finally {
        if (alive) setProfileLoading(false);
      }
    }

    loadProfile();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function restoreAuthSession() {
      try {
        const response = await authService.getSession();
        if (!alive) return;
        const sessionData = response.data || {};
        const user = sessionData.user || null;
        const profile = sessionData.profile || null;

        if (profile) {
          setVisitorId(profile.visitorId || "");
          setVisitorProfile(profile);
          setVisitorName(profile.displayName || user?.displayName || "non");
          setUserPreferences(normalizePreferences(profile.preferences));
        }

        if (sessionData.auth?.isAuthenticated && user) {
          setAuthUser(user);
          if (
            user.role === "admin" &&
            sessionData.admin?.isAdmin &&
            sessionData.admin?.csrfToken
          ) {
            setAdminToken(sessionData.admin.csrfToken);
            setAdminExpiresAt(sessionData.admin.expiresAt || "");
            setAccessMode("admin");
            setSuccessMessage(
              "Admin mode đã được khôi phục bằng tài khoản MongoDB.",
            );
          } else {
            setAdminToken("");
            setAdminExpiresAt("");
            setAccessMode("user");
            setReadOnlyMessage(
              "Bạn đang ở user mode: được xin quyền từng tài khoản và thao tác sau khi admin duyệt.",
            );
          }
        } else {
          setAuthUser(null);
          setAdminToken("");
          setAdminExpiresAt("");
          setAccessMode("pending");
        }
      } catch {
        if (!alive) return;
        setAuthUser(null);
        setAdminToken("");
        setAdminExpiresAt("");
        setAccessMode("pending");
      } finally {
        if (alive) setAdminSessionLoading(false);
      }
    }

    restoreAuthSession();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    setSeenNotificationKeys(
      visitorProfile?.seenNotifications?.[notificationMode] || [],
    );
  }, [visitorProfile, notificationMode]);

  useEffect(() => {
    if (activePage !== "notifications" || profileLoading || !visitorId) return;
    let alive = true;

    async function markSeen() {
      try {
        setSeenNotificationKeys(notificationKeys);
        const response = await profileService.markNotificationsSeen(
          visitorId,
          notificationMode,
          notificationKeys,
        );
        if (alive && response.data) setVisitorProfile(response.data);
      } catch {}
    }

    markSeen();
    return () => {
      alive = false;
    };
  }, [
    activePage,
    notificationKeys,
    visitorId,
    notificationMode,
    profileLoading,
  ]);

  useEffect(() => {
    if (!successMessage && !warningMessage) return;
    const timer = setTimeout(() => {
      setSuccessMessage("");
      setWarningMessage("");
    }, 3500);
    return () => clearTimeout(timer);
  }, [successMessage, warningMessage]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key !== "Escape") return;
      setEditingAccount(null);
      setDeletingAccount(null);
      setRevealingAccount(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function saveVisitorName(nextName) {
    const cleanName = String(nextName || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 80);
    if (!cleanName || sameName(cleanName, "non")) return;

    const previousName = visitorName;
    const response = await profileService.updateDisplayName(
      visitorId,
      cleanName,
      adminToken,
    );
    const profile = response.data || {};

    setVisitorProfile(profile);
    setVisitorName(profile.displayName || cleanName);
    setUserPreferences(normalizePreferences(profile.preferences));
    await loadData();

    if (!isUnsetName(previousName) && !sameName(previousName, cleanName)) {
      setSuccessMessage(
        `Đã đổi tên hiển thị của bạn từ ${previousName} thành ${cleanName}. Chỉ tài khoản đã bấm Done sau khi lấy OTP mới cập nhật Chủ sở hữu theo tên mới.`,
      );
    } else {
      setSuccessMessage(`Đã lưu tên ${cleanName} vào MongoDB.`);
    }
  }

  async function saveUserPreferences(nextPreferences) {
    const normalized = normalizePreferences(nextPreferences);
    const response = await profileService.updatePreferences(
      visitorId,
      normalized,
    );
    const profile = response.data || {};
    setVisitorProfile(profile);
    setUserPreferences(normalizePreferences(profile.preferences));
    return normalizePreferences(profile.preferences);
  }

  function applyProfileFromAuth(profile = {}, user = null) {
    if (!profile && !user) return;
    if (profile?.visitorId) setVisitorId(profile.visitorId || "");
    if (profile) {
      setVisitorProfile(profile);
      setVisitorName(profile.displayName || user?.displayName || "non");
      setUserPreferences(normalizePreferences(profile.preferences));
    } else if (user?.displayName) {
      setVisitorName(user.displayName);
    }
  }

  function handleAuthenticated(sessionData = {}) {
    const user = sessionData.user || null;
    setAuthUser(user);
    applyProfileFromAuth(sessionData.profile, user);

    if (user?.role === "admin") {
      const adminData = sessionData.admin || {};
      const csrfToken = adminData.csrfToken || "";
      const expiresAt = adminData.expiresAt || "";

      if (!csrfToken || !expiresAt) {
        setWarningMessage(
          "Backend chưa trả CSRF token cho phiên admin. Hãy thử đăng nhập lại.",
        );
        return;
      }

      setAdminToken(csrfToken);
      setAdminExpiresAt(expiresAt);
      setAccessMode("admin");
      setReadOnlyMessage("");
      setWarningMessage("");
      setSuccessMessage(
        `Đã đăng nhập admin${user?.displayName ? `: ${user.displayName}` : ""}`,
      );
      return;
    }

    setAdminToken("");
    setAdminExpiresAt("");
    setAccessMode("user");
    setReadOnlyMessage(
      "User mode: bạn có thể xin quyền từng tài khoản; sau khi admin duyệt mới xem pass/sửa trạng thái.",
    );
    setWarningMessage("");
    setSuccessMessage(
      `Đã đăng nhập user${user?.displayName ? `: ${user.displayName}` : ""}`,
    );
  }

  function handleUnlock(authData) {
    handleAuthenticated({
      user: { role: "admin", displayName: visitorName },
      admin: authData,
      profile: visitorProfile,
    });
  }

  function handleGuestMode(message) {
    setAuthUser(null);
    setAdminToken("");
    setAdminExpiresAt("");
    setAccessMode("guest");
    setReadOnlyMessage(message);
    if (isUnsetName(visitorName)) setVisitorName("Khách");
    setEditingAccount(null);
    setDeletingAccount(null);
    setRevealingAccount(null);
    if (["create", "backup", "admins", "security", "otp"].includes(activePage))
      setActivePage("dashboard");
  }

  function handleReadOnly(message) {
    handleGuestMode(message);
  }

  async function handleLogout() {
    const tokenSnapshot = adminToken;
    try {
      await authService.logout();
    } catch {}

    setAuthUser(null);
    setAdminToken("");
    setAdminExpiresAt("");
    setAccessMode("pending");
    setActivePage("dashboard");
    setEditingAccount(null);
    setDeletingAccount(null);
    setRevealingAccount(null);
    setSuccessMessage("");
    setWarningMessage("");
  }

  function showBlockedAction(actionName) {
    setSuccessMessage("");
    setWarningMessage(
      isGuest
        ? `Khách chưa thể ${actionName}. Hãy đăng nhập/đăng ký tài khoản trước.`
        : `Bạn chưa có quyền để ${actionName}. Hãy đăng nhập admin hoặc bấm Xin quyền ở đúng tài khoản cần dùng.`,
    );
  }

  function canEditThisAccount(account) {
    return (
      isAdmin ||
      (isLoggedInUser && hasAccountAccess(account, visitorName, visitorId))
    );
  }

  async function handleCreate(payload) {
    if (!isAdmin) {
      showBlockedAction("thêm tài khoản");
      return;
    }

    await createAccount({
      ...payload,
      ownerName: visitorName || payload.ownerName,
    });
    setSuccessMessage("Đã thêm tài khoản mới");
    setActivePage("accounts");
  }

  async function handleUpdate(id, payload) {
    const target =
      accounts.find((account) => account._id === id) || editingAccount;

    if (!target || !canEditThisAccount(target)) {
      showBlockedAction("sửa tài khoản này");
      return;
    }

    const nextPayload = isAdmin
      ? { ...payload, ownerName: visitorName || payload.ownerName }
      : { status: payload.status };
    await updateAccount(id, nextPayload);
    setSuccessMessage(
      isAdmin ? "Đã cập nhật tài khoản" : "Đã cập nhật trạng thái tài khoản",
    );
  }

  async function handleConfirmDelete() {
    if (!deletingAccount || !isAdmin) {
      showBlockedAction("xóa tài khoản");
      setDeletingAccount(null);
      return;
    }

    await deleteAccount(deletingAccount._id);
    setSuccessMessage("Đã xóa tài khoản");
    setDeletingAccount(null);
  }

  function handleOpenReveal(account) {
    if (!isAdmin && !isLoggedInUser) {
      showBlockedAction("xem tài khoản/mật khẩu này");
      return;
    }

    if (!isAdmin && !hasAccountAccess(account, visitorName, visitorId)) {
      showBlockedAction("xem tài khoản/mật khẩu này");
      return;
    }

    setRevealingAccount(account);
  }

  async function handleGetOtp(accountId) {
    const response = await otpService.getOtp(accountId, {
      adminToken,
      visitorName,
      visitorId,
    });
    return response.data;
  }

  async function handleOtpLoginDone(accountId, logId = "") {
    const response = await otpService.confirmLogin(accountId, {
      adminToken,
      visitorName,
      visitorId,
      logId,
    });
    await loadData();
    setSuccessMessage(
      response.message || "Đã xác nhận đăng nhập OTP thành công.",
    );
    setRevealingAccount(null);
    return response.data;
  }

  async function handleRequestAccess(account) {
    if (!isLoggedInUser) {
      setWarningMessage(
        "Khách chỉ được xem. Hãy đăng nhập/đăng ký tài khoản để xin quyền.",
      );
      return;
    }

    if (isUnsetName(visitorName)) {
      setWarningMessage("Bạn cần có tên hiển thị trước khi xin quyền.");
      return;
    }

    await requestAccess(account._id);
    setSuccessMessage(
      `Đã gửi yêu cầu quyền cho ${account.accountName}. Admin duyệt ở mục Quản lý Admin.`,
    );
  }

  async function handleApproveAccess(accountId, requestId) {
    if (!isAdmin) return showBlockedAction("cấp quyền");
    await approveAccess(accountId, requestId);
    setSuccessMessage("Đã cấp quyền cho yêu cầu này");
  }

  async function handleRejectAccess(accountId, requestId, reason = "") {
    if (!isAdmin) return showBlockedAction("từ chối quyền");
    await rejectAccess(accountId, requestId, reason);
    setSuccessMessage("Đã từ chối yêu cầu quyền");
  }

  async function handleRevokeAccess(accountId, requestId, reason = "") {
    if (!isAdmin) return showBlockedAction("thu hồi quyền");
    await revokeAccess(accountId, requestId, reason);
    setSuccessMessage("Đã thu hồi quyền tài khoản này");
  }

  async function handleDeleteAccess(accountId, requestId, reason = "") {
    if (!isAdmin)
      return showBlockedAction("xóa người dùng khỏi danh sách quyền");
    await deleteAccess(accountId, requestId, reason);
    setSuccessMessage(
      "Đã xóa khỏi list quản lý và gửi thông báo admin từ chối quyền.",
    );
  }

  if (profileLoading || adminSessionLoading) {
    return (
      <main className="auth-page">
        <section className="visitor-gate-card">
          <div className="spinner-border text-success" role="status" />
          <h1>Đang tải phiên bảo mật...</h1>
          <p>
            Web đang kiểm tra hồ sơ MongoDB và httpOnly cookie admin/visitor.
          </p>
        </section>
      </main>
    );
  }

  if (profileError) {
    return (
      <main className="auth-page">
        <section className="visitor-gate-card">
          <h1>Không kết nối được hồ sơ</h1>
          <p>{profileError}</p>
          <button
            className="btn-tool-primary"
            type="button"
            onClick={() => window.location.reload()}
          >
            Tải lại
          </button>
        </section>
      </main>
    );
  }

  if (accessMode === "pending") {
    return (
      <AdminGate
        onAuthenticated={handleAuthenticated}
        onGuest={handleGuestMode}
        onUnlock={handleUnlock}
        onReadOnly={handleReadOnly}
      />
    );
  }

  if (!isGuest && isUnsetName(visitorName)) {
    return <VisitorNameGate onSave={saveVisitorName} />;
  }

  const editingLimitedStatusOnly = Boolean(
    editingAccount &&
    !isAdmin &&
    hasAccountAccess(editingAccount, visitorName, visitorId),
  );

  return (
    <div className="app-shell vault-shell-bg">
      <div className="vault-layout">
        <Navbar
          activePage={activePage}
          onNavigate={setActivePage}
          isAdmin={isAdmin}
          accessMode={accessMode}
          visitorName={visitorName}
          onLogout={handleLogout}
          onBlockedAction={showBlockedAction}
          totalRecords={stats?.total || accounts.length}
          filters={filters}
          setFilters={setFilters}
          notificationCount={unreadNotificationCount}
        />

        <main className="vault-content">
          <PermissionBanner
            isAdmin={isAdmin}
            message={readOnlyMessage}
            expiresAt={adminExpiresAt}
          />
          <AlertBox type="danger" message={error} />
          <AlertBox
            type="warning"
            message={warningMessage}
            onClose={() => setWarningMessage("")}
          />
          <AlertBox
            type="success"
            message={successMessage}
            onClose={() => setSuccessMessage("")}
          />

          {activePage === "dashboard" && (
            <DashboardPage
              stats={stats}
              recentAccounts={accounts}
              loading={loading}
              onReveal={handleOpenReveal}
              onEdit={setEditingAccount}
              onDelete={setDeletingAccount}
              onRequestAccess={handleRequestAccess}
              onNavigate={setActivePage}
              canManage={isAdmin}
              visitorName={visitorName}
              visitorId={visitorId}
              onBlockedAction={showBlockedAction}
              canRequestAccess={isLoggedInUser}
            />
          )}

          {activePage === "accounts" && (
            <AccountsPage
              accounts={accounts}
              loading={loading}
              filters={filters}
              setFilters={setFilters}
              onReveal={handleOpenReveal}
              onEdit={setEditingAccount}
              onDelete={setDeletingAccount}
              onRequestAccess={handleRequestAccess}
              canManage={isAdmin}
              visitorName={visitorName}
              visitorId={visitorId}
              onBlockedAction={showBlockedAction}
              onNavigate={setActivePage}
              canRequestAccess={isLoggedInUser}
            />
          )}

          {activePage === "create" &&
            (isAdmin ? (
              <CreateAccountPage
                onCreate={handleCreate}
                onBack={() => setActivePage("accounts")}
                visitorName={visitorName}
                preferences={userPreferences}
              />
            ) : (
              <LockedPanel
                title="Không thể thêm tài khoản trong read-only mode"
                message="Bạn cần đăng nhập đúng mật khẩu admin để thêm dữ liệu mới. Quyền riêng từng tài khoản chỉ cho phép xem email/mật khẩu và sửa trạng thái."
                onBack={() => setActivePage("accounts")}
              />
            ))}

          {activePage === "guide" && (
            <GuidePage
              isAdmin={isAdmin}
              visitorName={visitorName}
              onNavigate={setActivePage}
            />
          )}

          {activePage === "services" && (
            <ServicesPage
              accounts={accounts}
              stats={stats}
              setFilters={setFilters}
              onNavigate={setActivePage}
            />
          )}
          {activePage === "otp" &&
            (isAdmin ? (
              <OtpManagerPage
                isAdmin={isAdmin}
                adminToken={adminToken}
                visitorName={visitorName}
                visitorId={visitorId}
                syncTick={realtimeTick}
              />
            ) : (
              <LockedPanel
                title="Manager OTP đang bị khóa"
                message="Mục Manager OTP chỉ dành cho admin tổng vì có cấu hình mail, lịch sử lấy mã và dữ liệu nhạy cảm. Người dùng thường chỉ dùng nút Get OTP trong khung xem mật khẩu của tài khoản đã được cấp quyền."
                onBack={() => setActivePage("accounts")}
              />
            ))}
          {activePage === "activity" && (
            <ActivityPage
              isAdmin={isAdmin}
              visitorName={visitorName}
              visitorId={visitorId}
              adminToken={adminToken}
              syncTick={realtimeTick}
            />
          )}
          {activePage === "settings" && (
            <SettingsPage
              filters={filters}
              setFilters={setFilters}
              visitorName={visitorName}
              visitorId={visitorId}
              preferences={userPreferences}
              onChangeVisitorName={saveVisitorName}
              onSavePreferences={saveUserPreferences}
            />
          )}
          {activePage === "admins" &&
            (isAdmin ? (
              <AdminManagementPage
                isAdmin={isAdmin}
                onLogout={handleLogout}
                expiresAt={adminExpiresAt}
                accounts={accounts}
                visitorName={visitorName}
                onApproveAccess={handleApproveAccess}
                onRejectAccess={handleRejectAccess}
                onRevokeAccess={handleRevokeAccess}
                onDeleteAccess={handleDeleteAccess}
              />
            ) : (
              <LockedPanel
                title="Quản lý Admin đang bị khóa"
                message="Mục này chỉ dành cho admin tổng. Người dùng thường hãy vào Quản lý tài khoản để bấm Xin quyền ở từng tài khoản cần dùng."
                onBack={() => setActivePage("guide")}
              />
            ))}
          {activePage === "security" &&
            (isAdmin ? (
              <SecurityPage isAdmin={isAdmin} accounts={accounts} />
            ) : (
              <LockedPanel
                title="Bảo mật đang bị khóa"
                message="Mục bảo mật chỉ mở cho admin tổng để tránh người thường thay đổi hoặc xem cấu hình nhạy cảm."
                onBack={() => setActivePage("guide")}
              />
            ))}
          {activePage === "backup" && (
            <BackupPage
              adminToken={adminToken}
              isAdmin={isAdmin}
              onBlockedAction={showBlockedAction}
              onRefresh={loadData}
            />
          )}
          {activePage === "notifications" && (
            <NotificationsPage
              accounts={accounts}
              setFilters={setFilters}
              onNavigate={setActivePage}
              isAdmin={isAdmin}
              visitorName={visitorName}
              visitorId={visitorId}
            />
          )}

          <AppFooter isAdmin={isAdmin} visitorName={visitorName} />
        </main>
      </div>

      <AiChatBox
        activePage={activePage}
        isAdmin={isAdmin}
        visitorName={visitorName}
        visitorId={visitorId}
        accounts={accounts}
        stats={stats}
        notificationCount={unreadNotificationCount}
        onNavigate={setActivePage}
      />

      <EditAccountModal
        account={
          editingAccount && canEditThisAccount(editingAccount)
            ? editingAccount
            : null
        }
        onClose={() => setEditingAccount(null)}
        onSubmit={handleUpdate}
        visitorName={visitorName}
        limitedStatusOnly={editingLimitedStatusOnly}
      />

      <RevealPasswordModal
        account={revealingAccount}
        onClose={() => setRevealingAccount(null)}
        onReveal={revealPassword}
        onGetOtp={handleGetOtp}
        onOtpLoginDone={handleOtpLoginDone}
        canManage={isAdmin}
        visitorName={visitorName}
      />

      <ConfirmModal
        open={Boolean(isAdmin && deletingAccount)}
        title="Xóa tài khoản?"
        message={
          deletingAccount
            ? `Bạn có chắc muốn xóa "${deletingAccount.accountName}"? Hành động này không thể hoàn tác.`
            : ""
        }
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingAccount(null)}
      />
    </div>
  );
}
