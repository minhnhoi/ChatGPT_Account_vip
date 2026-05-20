import {
  Eye,
  EyeOff,
  Globe2,
  KeyRound,
  LogIn,
  Mail,
  ShieldCheck,
  Sparkles,
  Terminal,
  UserPlus,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { authService } from "../../services/authService";

const accessRules = [
  "Admin: đăng nhập bằng tài khoản role admin trong MongoDB để mở toàn bộ quyền.",
  "User: đăng ký/đăng nhập để xin quyền, xem pass sau khi admin duyệt và cập nhật trạng thái.",
  "Khách: chỉ xem danh sách, tìm kiếm và mở các link công khai; không thao tác dữ liệu.",
];

function cleanUsername(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

export default function AdminGate({
  onAuthenticated,
  onGuest,
  onUnlock,
  onReadOnly,
}) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    username: "",
    displayName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isRegister = mode === "register";
  const title = isRegister ? "Tạo tài khoản người dùng" : "Đăng nhập tài khoản";
  const description = isRegister
    ? "Tài khoản mới dùng để xin quyền từng account."
    : "Đăng nhập user để thao tác quyền người dùng, hoặc đăng nhập admin để mở toàn bộ dashboard.";

  const passwordStrength = useMemo(() => {
    const value = form.password || "";
    let score = 0;
    if (value.length >= 6) score += 1;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
    if (/\d/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;
    return Math.min(4, score);
  }, [form.password]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function validateForm() {
    const username = cleanUsername(form.username);
    const password = String(form.password || "");

    if (!username || !password) return "Nhập tên đăng nhập và mật khẩu.";
    if (isRegister) {
      if (!/^[a-z0-9._-]{3,40}$/.test(username))
        return "Username cần 3-40 ký tự: chữ thường, số, ., _, -.";
      if (String(form.displayName || "").trim().length < 2)
        return "Nhập họ và tên ít nhất 2 ký tự.";
      if (password.length < 6) return "Mật khẩu cần ít nhất 6 ký tự.";
      if (password !== form.confirmPassword)
        return "Mật khẩu nhập lại chưa khớp.";
    }

    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = {
      username: cleanUsername(form.username),
      password: form.password,
      displayName: form.displayName.trim().replace(/\s+/g, " "),
      email: form.email.trim(),
    };

    try {
      setLoading(true);

      if (isRegister) {
        const response = await authService.register(payload);
        setMode("login");
        setShowPassword(false);
        setForm((current) => ({
          ...current,
          username: payload.username,
          password: "",
          confirmPassword: "",
        }));
        setSuccess(
          response.message ||
            "Đăng ký thành công. Hãy đăng nhập bằng tài khoản vừa tạo.",
        );
        return;
      }

      const response = await authService.login(payload);
      const data = response.data || {};
      if (onAuthenticated) onAuthenticated(data);
      else if (data?.admin?.isAdmin && onUnlock) onUnlock(data.admin);
      else if (onReadOnly) onReadOnly("Đã đăng nhập user mode.");
    } catch (err) {
      setError(
        err.message ||
          (isRegister ? "Đăng ký thất bại." : "Đăng nhập thất bại."),
      );
    } finally {
      setLoading(false);
    }
  }

  function handleGuest() {
    const message =
      "Bạn đang dùng chế độ khách: chỉ xem danh sách/tìm kiếm/mở link, không xin quyền, không xem pass, không sửa dữ liệu.";
    if (onGuest) onGuest(message);
    else onReadOnly?.(message);
  }

  return (
    <main className="auth-page">
      <section
        className="auth-shell auth-shell-upgraded"
        aria-label="Account authentication"
      >
        <div className="auth-intro-panel auth-animated-panel">
          <div className="auth-brand-line">
            <span className="brand-mark brand-mark-glow">
              <Terminal size={26} />
            </span>
            <div>
              <strong>VAULT TOOL</strong>
              <small>MongoDB account gateway</small>
            </div>
          </div>

          <div className="auth-headline">
            <span className="status-dot pulse-dot" />
            <p>SECURE LOGIN GATEWAY</p>
            <h1>ChatGPT Account Clone.</h1>
            <span>
              User đăng ký riêng để xin quyền và sử dụng logic cấp quyền cũ;
              khách chỉ xem an toàn. Hãy đọc kĩ thỏa thuận để tránh bị khóa tài
              khoản. Vui lòng không lợi dụng lập tài khoản để mục đích khác.
            </span>
          </div>

          <div className="auth-rule-list">
            {accessRules.map((rule, index) => (
              <div
                className="auth-rule auth-rule-float"
                key={rule}
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <b>0{index + 1}</b>
                <span>{rule}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="auth-card-panel auth-card-upgraded">
          <div className="terminal-titlebar compact">
            <div className="window-dots" aria-hidden="true">
              <span className="dot dot-red" />
              <span className="dot dot-yellow" />
              <span className="dot dot-green" />
            </div>
            <div className="terminal-title">
              <Terminal size={14} />
              <span>vault@mongo: auth</span>
            </div>
            <span className="ready-badge">LIVE</span>
          </div>

          <div className="auth-card-body auth-card-body-upgraded">
            <div
              className="auth-mode-switch"
              role="tablist"
              aria-label="Auth mode"
            >
              <button
                className={mode === "login" ? "active" : ""}
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                  setSuccess("");
                }}
              >
                <LogIn size={16} /> Đăng nhập
              </button>
              <button
                className={mode === "register" ? "active" : ""}
                type="button"
                onClick={() => {
                  setMode("register");
                  setError("");
                  setSuccess("");
                }}
              >
                <UserPlus size={16} /> Đăng ký
              </button>
            </div>

            <div className="auth-lock-icon auth-lock-orb">
              {isRegister ? <UserPlus size={30} /> : <ShieldCheck size={30} />}
            </div>
            <p className="tool-eyebrow mb-2">
              {isRegister ? "CREATE USER" : "ACCOUNT LOGIN"}
            </p>
            <h2>{title}</h2>
            <p className="auth-card-desc">{description}</p>

            {success && (
              <div className="tool-alert success mb-3 auth-success-pop">
                {success}
              </div>
            )}
            {error && (
              <div className="tool-alert danger mb-3 auth-shake">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="auth-form-grid">
              <div className="tool-field">
                <label htmlFor="auth-username">
                  <UserRound size={15} /> Tên đăng nhập
                </label>
                <input
                  id="auth-username"
                  className="tool-input"
                  value={form.username}
                  onChange={(event) =>
                    updateField("username", event.target.value)
                  }
                  placeholder="VD: minh hoặc admin"
                  autoFocus
                  autoComplete="username"
                />
              </div>

              {isRegister && (
                <>
                  <div className="tool-field">
                    <label htmlFor="auth-display-name">
                      <Sparkles size={15} /> Họ và tên
                    </label>
                    <input
                      id="auth-display-name"
                      className="tool-input"
                      value={form.displayName}
                      onChange={(event) =>
                        updateField("displayName", event.target.value)
                      }
                      placeholder="VD: Minh"
                      autoComplete="name"
                    />
                  </div>
                  <div className="tool-field">
                    <label htmlFor="auth-email">
                      <Mail size={15} /> Email tùy chọn
                    </label>
                    <input
                      id="auth-email"
                      className="tool-input"
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        updateField("email", event.target.value)
                      }
                      placeholder="name@example.com"
                      autoComplete="email"
                    />
                  </div>
                </>
              )}

              <div className="tool-field">
                <label htmlFor="auth-password">
                  <KeyRound size={15} /> Mật khẩu
                  {isRegister && <span>{passwordStrength}/4</span>}
                </label>
                <div className="secret-input-wrap">
                  <input
                    id="auth-password"
                    className="tool-input secret-input"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(event) =>
                      updateField("password", event.target.value)
                    }
                    placeholder={
                      isRegister ? "Tối thiểu 6 ký tự" : "Nhập mật khẩu"
                    }
                    autoComplete={
                      isRegister ? "new-password" : "current-password"
                    }
                  />
                  <button
                    className="input-icon-btn"
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {isRegister && (
                  <div className="strength-meter" aria-hidden="true">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <i
                        key={index}
                        className={index < passwordStrength ? "on" : ""}
                      />
                    ))}
                  </div>
                )}
              </div>

              {isRegister && (
                <div className="tool-field">
                  <label htmlFor="auth-confirm-password">
                    <KeyRound size={15} /> Nhập lại mật khẩu
                  </label>
                  <input
                    id="auth-confirm-password"
                    className="tool-input secret-input"
                    type={showPassword ? "text" : "password"}
                    value={form.confirmPassword}
                    onChange={(event) =>
                      updateField("confirmPassword", event.target.value)
                    }
                    placeholder="Nhập lại mật khẩu"
                    autoComplete="new-password"
                  />
                </div>
              )}

              <div className="auth-actions">
                <button
                  className="btn-tool-primary"
                  type="submit"
                  disabled={loading}
                >
                  {isRegister ? <UserPlus size={18} /> : <LogIn size={18} />}
                  {loading
                    ? "Đang xử lý..."
                    : isRegister
                      ? "Tạo tài khoản"
                      : "Đăng nhập"}
                </button>
                <button
                  className="btn-tool-ghost"
                  type="button"
                  onClick={handleGuest}
                  disabled={loading}
                >
                  <Globe2 size={18} /> Vào bằng khách
                </button>
              </div>
            </form>

            <div className="auth-meta-row">
              <span>MongoDB users</span>
              <span>admin auto seed</span>
              <span>guest safe mode</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
