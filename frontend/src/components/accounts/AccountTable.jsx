import {
  ExternalLink,
  Eye,
  Lock,
  Pencil,
  ShieldPlus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { formatDateTime } from "../../utils/date";
import {
  getPlanLabel,
  getStatusClassName,
  getStatusLabel,
} from "../../utils/labels";

function normalizeExternalUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(raw)) return `https://${raw}`;
  return "";
}

function siteInitial(account) {
  const source =
    account.accountName || account.loginEmail || account.ownerName || "?";
  return source.trim().slice(0, 1).toUpperCase();
}

function maskLogin(login = "") {
  const value = String(login || "").trim();
  if (!value) return "Không có";

  const [local, domain] = value.includes("@")
    ? value.split(/@(.+)/)
    : [value, ""];
  const keepCount = Math.max(1, Math.ceil(local.length / 2));
  const maskCount = Math.max(1, local.length - keepCount);
  const maskedLocal = `${"*".repeat(maskCount)}${local.slice(maskCount)}`;
  return domain ? `${maskedLocal}@${domain}` : maskedLocal;
}

function requestMatchesVisitor(request, visitorName = "", visitorId = "") {
  if (!request) return false;
  if (
    visitorId &&
    request.requesterVisitorId &&
    request.requesterVisitorId === visitorId
  )
    return true;
  return (
    String(request.requesterName || "")
      .trim()
      .toLowerCase() ===
    String(visitorName || "")
      .trim()
      .toLowerCase()
  );
}

function getMyRequest(account, visitorName, visitorId = "") {
  if (!visitorName && !visitorId) return null;
  const matches = (account.accessRequests || []).filter((request) =>
    requestMatchesVisitor(request, visitorName, visitorId),
  );
  return (
    matches.find((request) => request.status === "approved") ||
    matches.find((request) => request.status === "pending") ||
    matches[0] ||
    null
  );
}

function canUseAccount(
  account,
  visitorName,
  visitorId,
  canFullManage,
  allowUserActions = true,
) {
  if (canFullManage) return true;
  if (!allowUserActions) return false;
  return (account.accessRequests || []).some(
    (request) =>
      requestMatchesVisitor(request, visitorName, visitorId) &&
      request.status === "approved",
  );
}

function requestLabel(status) {
  if (status === "approved") return "Đã cấp quyền";
  if (status === "pending") return "Đang chờ";
  if (status === "rejected") return "Xin lại quyền";
  if (status === "revoked") return "Xin lại quyền";
  return "Xin quyền";
}

function isAdminOwner(account) {
  return Boolean(
    account?.ownerIsAdmin ||
    account?.ownerRole === "admin" ||
    account?.ownerType === "admin",
  );
}

export default function AccountTable({
  accounts,
  loading,
  onEdit,
  onDelete,
  onReveal,
  onRequestAccess,
  canManage = false,
  visitorName = "",
  visitorId = "",
  onBlockedAction,
  canRequestAccess = false,
  compact = false,
}) {
  const [busyRow, setBusyRow] = useState("");
  const [rowError, setRowError] = useState("");

  function guardAdminOnly(actionName, callback) {
    if (!canManage) {
      onBlockedAction?.(actionName);
      return;
    }
    callback();
  }

  function handleOpenReveal(account) {
    const allowed = canUseAccount(
      account,
      visitorName,
      visitorId,
      canManage,
      canRequestAccess,
    );

    if (!allowed) {
      onBlockedAction?.(
        canRequestAccess
          ? "xem tài khoản/mật khẩu khi chưa được cấp quyền cho tài khoản này"
          : "xem tài khoản/mật khẩu bằng chế độ khách. Hãy đăng nhập tài khoản trước",
      );
      return;
    }

    onReveal?.(account);
  }

  async function handleRequestAccess(account) {
    try {
      setBusyRow(account._id);
      setRowError("");
      await onRequestAccess?.(account);
    } catch (err) {
      setRowError(err?.message || "Không gửi được yêu cầu quyền.");
    } finally {
      setBusyRow("");
    }
  }

  if (loading) {
    return (
      <div className="vault-table-empty">
        <div className="spinner-border text-success" role="status" />
        <p>Đang tải dữ liệu đã mã hóa...</p>
      </div>
    );
  }

  if (!accounts.length) {
    return (
      <div className="vault-table-empty">
        <h5>Chưa có tài khoản phù hợp</h5>
        <p>Thêm tài khoản mới hoặc xóa bộ lọc tìm kiếm hiện tại.</p>
      </div>
    );
  }

  return (
    <div className="vault-table-wrap">
      {rowError && <div className="tool-alert danger mb-3">{rowError}</div>}
      <table className="vault-table">
        <thead>
          <tr>
            <th>Tài khoản</th>
            <th>Email đăng nhập</th>
            <th>Mật khẩu</th>
            {!compact && <th>Gói</th>}
            <th>Trạng thái</th>
            <th>Cập nhật</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((account) => {
            const myRequest = getMyRequest(account, visitorName, visitorId);
            const hasAccountAccess = canUseAccount(
              account,
              visitorName,
              visitorId,
              canManage,
              canRequestAccess,
            );
            const requestPending = myRequest?.status === "pending";
            const showRequestButton = !canManage && canRequestAccess;
            const canAskAgain =
              !myRequest || ["rejected", "revoked"].includes(myRequest.status);
            const adminOwner = isAdminOwner(account);
            const serviceHref = normalizeExternalUrl(account.serviceUrl);

            return (
              <tr key={account._id}>
                <td data-label="Tài khoản">
                  <div className="site-cell">
                    <span className="site-avatar">{siteInitial(account)}</span>
                    <div>
                      <strong>{account.accountName || "Chưa đặt tên"}</strong>
                      <small
                        className={`owner-label ${adminOwner ? "admin-owner-label" : "user-owner-label"}`}
                      >
                        <span
                          className={
                            adminOwner
                              ? "hard-admin-owner-name"
                              : "normal-owner-name"
                          }
                        >
                          {account.ownerName ||
                            visitorName ||
                            "Không rõ chủ sở hữu"}
                        </span>
                        {adminOwner && (
                          <span className="admin-owner-flag">ADMIN</span>
                        )}
                      </small>
                      {serviceHref && (
                        <a
                          className="quick-link-pill"
                          href={serviceHref}
                          target="_blank"
                          rel="noreferrer noopener"
                          title="Mở link dịch vụ"
                        >
                          <ExternalLink size={12} /> Mở link
                        </a>
                      )}
                      {!compact && account.tags?.length > 0 && (
                        <em>
                          {account.tags
                            .slice(0, 3)
                            .map((tag) => `#${tag}`)
                            .join("  ")}
                        </em>
                      )}
                    </div>
                  </div>
                </td>
                <td data-label="Email đăng nhập">
                  <div className="password-cell email-secret-cell">
                    <span className="secret-masked">
                      {account.loginEmailMasked ||
                        maskLogin(account.loginEmail)}
                    </span>
                    <button
                      className={`icon-btn ${hasAccountAccess ? "" : "locked"}`}
                      type="button"
                      onClick={() => handleOpenReveal(account)}
                      disabled={busyRow === account._id}
                      title={
                        hasAccountAccess
                          ? "Mở khung xem tài khoản và mật khẩu"
                          : "Cần admin cấp quyền tài khoản này"
                      }
                    >
                      {hasAccountAccess ? (
                        <Eye size={17} />
                      ) : (
                        <Lock size={15} />
                      )}
                    </button>
                  </div>
                  {!compact && account.note && (
                    <small className="account-note-inline">
                      {account.note}
                    </small>
                  )}
                </td>
                <td data-label="Mật khẩu">
                  <div className="password-cell">
                    <span className="secret-masked">
                      {account.passwordMasked || "••••••••••••"}
                    </span>
                    <button
                      className={`icon-btn ${hasAccountAccess ? "" : "locked"}`}
                      type="button"
                      onClick={() => handleOpenReveal(account)}
                      disabled={busyRow === account._id}
                      title={
                        hasAccountAccess
                          ? "Mở khung xem tài khoản và mật khẩu"
                          : "Cần admin cấp quyền tài khoản này"
                      }
                    >
                      {hasAccountAccess ? (
                        <Eye size={17} />
                      ) : (
                        <Lock size={15} />
                      )}
                    </button>
                  </div>
                </td>
                {!compact && (
                  <td data-label="Gói">
                    <span className="vault-badge plan">
                      {getPlanLabel(account.planVersion)}
                    </span>
                  </td>
                )}
                <td data-label="Trạng thái">
                  <span
                    className={`vault-badge ${getStatusClassName(account.status)}`}
                  >
                    {getStatusLabel(account.status)}
                  </span>
                </td>
                <td data-label="Cập nhật">
                  <span className="updated-cell">
                    {formatDateTime(account.updatedAt || account.createdAt)}
                  </span>
                </td>
                <td data-label="Thao tác">
                  <div className="action-cell expanded-actions">
                    {showRequestButton && (
                      <button
                        className={`square-action request ${hasAccountAccess ? "approved" : ""}`}
                        type="button"
                        onClick={() =>
                          canAskAgain ? handleRequestAccess(account) : undefined
                        }
                        disabled={
                          busyRow === account._id ||
                          requestPending ||
                          hasAccountAccess
                        }
                        title={
                          hasAccountAccess
                            ? "Admin đã cấp quyền tài khoản này"
                            : "Xin quyền admin cho riêng tài khoản này"
                        }
                        data-testid={`account-request-${account._id}`}
                      >
                        <ShieldPlus size={16} />
                        {!compact && (
                          <span>{requestLabel(myRequest?.status)}</span>
                        )}
                      </button>
                    )}

                    <button
                      className={`square-action edit ${canManage || hasAccountAccess ? "" : "locked"}`}
                      type="button"
                      onClick={() => {
                        if (canManage || hasAccountAccess) onEdit(account);
                        else
                          onBlockedAction?.(
                            "sửa trạng thái khi chưa được cấp quyền cho tài khoản này",
                          );
                      }}
                      title={
                        canManage
                          ? "Sửa tài khoản"
                          : hasAccountAccess
                            ? "Sửa trạng thái tài khoản"
                            : "Chưa có quyền sửa"
                      }
                      data-testid={`account-edit-${account._id}`}
                    >
                      {canManage || hasAccountAccess ? (
                        <Pencil size={17} />
                      ) : (
                        <Lock size={15} />
                      )}
                    </button>
                    <button
                      className={`square-action delete ${canManage ? "" : "locked"}`}
                      type="button"
                      onClick={() =>
                        guardAdminOnly("xóa tài khoản", () => onDelete(account))
                      }
                      title={
                        canManage
                          ? "Xóa tài khoản"
                          : "Chỉ admin tổng mới được xóa"
                      }
                      data-testid={`account-delete-${account._id}`}
                    >
                      {canManage ? <Trash2 size={17} /> : <Lock size={15} />}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="vault-table-footer">
        <span>Hiển thị {accounts.length} bản ghi</span>
        <span>
          {canManage ? "Admin actions enabled" : "Per-account access mode"}
        </span>
      </div>
    </div>
  );
}
