import {
  CheckCircle2,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";

export default function RevealPasswordModal({
  account,
  onClose,
  onReveal,
  onGetOtp,
  onOtpLoginDone,
  canManage = false,
  visitorName = "",
}) {
  const [revealed, setRevealed] = useState(null);
  const [showPlain, setShowPlain] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpData, setOtpData] = useState(null);
  const [otpConfirmLoading, setOtpConfirmLoading] = useState(false);
  const [otpConfirmError, setOtpConfirmError] = useState("");
  const [otpCooldownRemaining, setOtpCooldownRemaining] = useState(0);
  const [otpCooldownAvailableAt, setOtpCooldownAvailableAt] = useState("");

  useEffect(() => {
    if (!account) {
      setRevealed(null);
      setShowPlain(true);
      setError("");
      setCopied("");
      setOtpError("");
      setOtpData(null);
      setOtpConfirmError("");
      setOtpConfirmLoading(false);
      setOtpCooldownRemaining(0);
      setOtpCooldownAvailableAt("");
      return;
    }

    let ignore = false;

    async function loadSecret() {
      try {
        setLoading(true);
        setError("");
        setRevealed(null);
        setCopied("");
        setOtpError("");
        setOtpData(null);
        setOtpConfirmError("");
        setOtpConfirmLoading(false);
        setOtpCooldownRemaining(0);
        setOtpCooldownAvailableAt("");
        const data = await onReveal(account._id);
        if (!ignore) setRevealed(data);
      } catch (err) {
        if (!ignore)
          setError(err.message || "Không thể xem tài khoản/mật khẩu");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadSecret();

    return () => {
      ignore = true;
    };
  }, [account, onReveal]);

  useEffect(() => {
    if (!otpCooldownRemaining && !otpCooldownAvailableAt) return undefined;

    function syncRemaining() {
      if (otpCooldownAvailableAt) {
        const next = Math.max(
          0,
          Math.ceil(
            (new Date(otpCooldownAvailableAt).getTime() - Date.now()) / 1000,
          ),
        );
        setOtpCooldownRemaining(next);
        if (next <= 0) setOtpCooldownAvailableAt("");
        return;
      }
      setOtpCooldownRemaining((prev) => Math.max(0, prev - 1));
    }

    const timer = window.setInterval(syncRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [otpCooldownRemaining, otpCooldownAvailableAt]);

  if (!account) return null;

  async function copyText(value, label) {
    if (!value) return;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(label);
      setTimeout(() => setCopied(""), 1500);
      return true;
    } catch {
      setError("Trình duyệt không cho phép copy. Hãy copy thủ công.");
      return false;
    }
  }

  async function handleGetOtp() {
    if (!revealed || !onGetOtp) return;

    try {
      setOtpLoading(true);
      setOtpError("");
      setOtpData(null);
      setOtpConfirmError("");
      const response = await onGetOtp(account._id);
      setOtpData(response);
      setOtpCooldownRemaining(
        Number(
          response?.cooldownRemainingSeconds || response?.cooldownSeconds || 0,
        ),
      );
      setOtpCooldownAvailableAt(response?.cooldownAvailableAt || "");
    } catch (err) {
      setOtpError(err.message || "Không lấy được OTP từ mail.");
      if (err.cooldownRemainingSeconds || err.cooldownAvailableAt) {
        setOtpCooldownRemaining(Number(err.cooldownRemainingSeconds || 0));
        setOtpCooldownAvailableAt(err.cooldownAvailableAt || "");
      }
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleCopyOtp() {
    if (!otpData?.otpCode) return;
    await copyText(otpData.otpCode, "OTP");
  }

  async function handleOtpDone() {
    if (!onOtpLoginDone || !account?._id) {
      setOtpConfirmError("Frontend chưa cấu hình hàm xác nhận OTP Done.");
      return;
    }

    try {
      setOtpConfirmLoading(true);
      setOtpConfirmError("");
      await onOtpLoginDone(account._id, otpData?.logId || "");
    } catch (err) {
      setOtpConfirmError(
        err.message || "Không xác nhận được trạng thái đăng nhập OTP.",
      );
    } finally {
      setOtpConfirmLoading(false);
    }
  }

  const accountName =
    revealed?.accountName || account.accountName || "Chưa đặt tên";
  const loginEmail = revealed?.loginEmail || account.loginEmail || "";
  const password = revealed?.password || "";
  const getOtpDisabled = otpLoading || otpCooldownRemaining > 0;
  const getOtpLabel =
    otpCooldownRemaining > 0
      ? `Chờ ${otpCooldownRemaining}s`
      : otpLoading
        ? "Đang lấy OTP..."
        : "Get OTP";

  return (
    <>
      <div className="modal fade show d-block" tabIndex="-1" role="dialog">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content tool-modal">
            <div className="modal-header">
              <div>
                <p className="tool-eyebrow mb-1">REVEAL SECRET</p>
                <h5 className="modal-title d-flex align-items-center gap-2">
                  <KeyRound size={20} /> Tài khoản, mật khẩu & OTP
                </h5>
                <small>{accountName}</small>
              </div>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={onClose}
                aria-label="Close"
              />
            </div>

            <div className="modal-body">
              <div className="tool-alert success mb-3">
                {canManage
                  ? "Admin mode đang bật nên bạn có thể xem dữ liệu và lấy OTP theo tài khoản này."
                  : `Bạn đã được admin cấp quyền riêng cho tài khoản này${visitorName ? `, ${visitorName}` : ""}.`}
              </div>

              {error && <div className="tool-alert danger mb-3">{error}</div>}

              {loading && (
                <div className="vault-table-empty py-4">
                  <div className="spinner-border text-success" role="status" />
                  <p>Đang giải mã tài khoản và mật khẩu...</p>
                </div>
              )}

              {revealed && !loading && (
                <div className="secret-reveal-box secret-reveal-stack">
                  <div className="secret-info-row">
                    <span>
                      <UserRound size={16} /> Tài khoản / dịch vụ
                    </span>
                    <strong>{accountName}</strong>
                  </div>

                  <div className="secret-info-row">
                    <span>
                      <Mail size={16} /> Email hoặc tên đăng nhập
                    </span>
                    <div className="secret-input-wrap mt-2">
                      <input
                        className="tool-input secret-input normal-spacing"
                        type="text"
                        readOnly
                        value={loginEmail}
                      />
                      <button
                        className="input-icon-btn"
                        type="button"
                        onClick={() => copyText(loginEmail, "tài khoản")}
                        title="Copy tài khoản"
                      >
                        <Copy size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="secret-info-row">
                    <span>
                      <KeyRound size={16} /> Mật khẩu
                    </span>
                    <div className="secret-input-wrap mt-2">
                      <input
                        className="tool-input secret-input"
                        type={showPlain ? "text" : "password"}
                        readOnly
                        value={password}
                      />
                      <button
                        className="input-icon-btn"
                        type="button"
                        onClick={() => setShowPlain((prev) => !prev)}
                        title={showPlain ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      >
                        {showPlain ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                      <button
                        className="input-icon-btn"
                        type="button"
                        onClick={() => copyText(password, "mật khẩu")}
                        title="Copy mật khẩu"
                      >
                        <Copy size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="otp-box-inline">
                    <div>
                      <span>
                        <ShieldCheck size={16} /> OTP liên kết với email này
                      </span>
                      <small>
                        - Server sẽ quét OTP mới nhất của ChatGPT từ:{" "}
                        <span style={{ color: "green" }}>
                          <b>{loginEmail}</b>
                        </span>{" "}
                        và sau gửi bên dưới cho bạn.
                      </small>
                      <small>
                        - OTP chỉ có giá trị trong{" "}
                        <span style={{ color: "white" }}>5 phút</span> kể từ khi
                        nhận được mail, sau đó sẽ tự hết hạn.
                      </small>
                      <small>
                        - Hãy <span style={{ color: "white" }}>xác nhận</span>{" "}
                        đăng nhập sau khi login acc thành công.
                      </small>
                    </div>
                    <button
                      className="btn-tool-primary small"
                      type="button"
                      onClick={handleGetOtp}
                      disabled={getOtpDisabled}
                    >
                      {otpLoading ? (
                        <Loader2 size={16} className="spin-icon" />
                      ) : otpCooldownRemaining > 0 ? (
                        <Clock3 size={16} />
                      ) : (
                        <KeyRound size={16} />
                      )}
                      {getOtpLabel}
                    </button>
                    {otpCooldownRemaining > 0 && (
                      <div className="tool-alert warning mt-2 w-100">
                        Server đã khóa quét lại OTP cho tài khoản này trong{" "}
                        {otpCooldownRemaining}s để tránh spam IMAP/mailbox.
                      </div>
                    )}
                    {otpError && (
                      <div className="tool-alert danger mt-2 w-100">
                        {otpError}
                      </div>
                    )}
                    {otpData?.otpCode && (
                      <div className="otp-result-card">
                        <span>Mã OTP mới nhất đúng email nhận</span>
                        <strong>{otpData.otpCode}</strong>
                        <div className="otp-login-actions">
                          <button
                            className="btn-tool-ghost small"
                            type="button"
                            onClick={handleCopyOtp}
                          >
                            Copy OTP
                          </button>
                          <button
                            className="btn-tool-primary small"
                            type="button"
                            onClick={handleOtpDone}
                            disabled={otpConfirmLoading}
                          >
                            {otpConfirmLoading ? (
                              <Loader2 size={15} className="spin-icon" />
                            ) : (
                              <CheckCircle2 size={15} />
                            )}
                            Done đã đăng nhập
                          </button>
                        </div>
                        <small>
                          {otpData.receivedAt
                            ? `Nhận lúc ${new Date(otpData.receivedAt).toLocaleString("vi-VN")}`
                            : "Không có thời gian nhận mail"}
                        </small>
                        {otpConfirmError && (
                          <div className="tool-alert danger mt-2 w-100">
                            {otpConfirmError}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {copied && (
                    <div className="copy-note">
                      Đã copy {copied} vào clipboard
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
