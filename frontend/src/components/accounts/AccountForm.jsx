import { Eye, EyeOff, KeyRound, Save, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { PLAN_OPTIONS, STATUS_OPTIONS } from "../../utils/labels";
import { formatDateInput } from "../../utils/date";
import {
  DEFAULT_PREFERENCES,
  normalizePreferences,
} from "../../utils/preferences";

const emptyForm = {
  ownerName: "",
  loginEmail: "",
  password: "",
  accountName: "",
  serviceUrl: "",
  planVersion: "free",
  status: "new",
  renewalDate: "",
  tags: "",
  note: "",
};

const passwordChars =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*_-+=?";

function readFormDefaults(visitorName = "", preferences = DEFAULT_PREFERENCES) {
  const prefs = normalizePreferences(preferences);
  return {
    ...emptyForm,
    ownerName: visitorName,
    planVersion: prefs.defaultPlan || emptyForm.planVersion,
    status: prefs.defaultStatus || emptyForm.status,
  };
}

function createPassword(length = 18) {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(
    values,
    (value) => passwordChars[value % passwordChars.length],
  ).join("");
}

export default function AccountForm({
  initialData,
  mode = "create",
  onSubmit,
  onCancel,
  visitorName = "",
  lockOwnerName = true,
  limitedStatusOnly = false,
  preferences = DEFAULT_PREFERENCES,
}) {
  const [form, setForm] = useState(() =>
    initialData ? emptyForm : readFormDefaults(visitorName, preferences),
  );
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (initialData) {
      setForm({
        ownerName:
          lockOwnerName && visitorName
            ? visitorName
            : initialData.ownerName || visitorName || "",
        loginEmail: initialData.loginEmail || "",
        password: "",
        accountName: initialData.accountName || "",
        serviceUrl: initialData.serviceUrl || "",
        planVersion: initialData.planVersion || "free",
        status: initialData.status || "new",
        renewalDate: formatDateInput(initialData.renewalDate),
        tags: Array.isArray(initialData.tags)
          ? initialData.tags.join(", ")
          : "",
        note: initialData.note || "",
      });
    } else {
      setForm(readFormDefaults(visitorName, preferences));
    }
  }, [initialData, visitorName, lockOwnerName, preferences]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleGeneratePassword() {
    setForm((prev) => ({ ...prev, password: createPassword() }));
    setShowPassword(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    if (limitedStatusOnly) {
      try {
        setSaving(true);
        await onSubmit({ status: form.status });
      } catch (err) {
        setFormError(err?.message || "Có lỗi xảy ra khi lưu trạng thái.");
      } finally {
        setSaving(false);
      }
      return;
    }

    const ownerName =
      lockOwnerName && visitorName ? visitorName : form.ownerName;

    if (!ownerName.trim()) {
      setFormError("Bạn cần nhập/chọn chủ sở hữu tài khoản.");
      return;
    }

    if (!form.loginEmail.trim()) {
      setFormError("Bạn cần nhập email/tên đăng nhập.");
      return;
    }

    if (!form.accountName.trim()) {
      setFormError("Bạn cần nhập tên tài khoản/dịch vụ.");
      return;
    }

    if (mode === "create" && !form.password.trim()) {
      setFormError("Bạn cần nhập mật khẩu tài khoản.");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...form,
        ownerName,
        password: form.password.trim(),
        renewalDate: form.renewalDate || null,
      };

      if (mode === "edit" && !payload.password) {
        delete payload.password;
      }

      await onSubmit(payload);

      if (mode === "create") {
        setForm(readFormDefaults(visitorName, preferences));
        setShowPassword(false);
      }
    } catch (err) {
      setFormError(err?.message || "Có lỗi xảy ra khi lưu tài khoản.");
    } finally {
      setSaving(false);
    }
  }

  if (limitedStatusOnly) {
    return (
      <form className="account-form" onSubmit={handleSubmit}>
        {formError && <div className="tool-alert danger mb-3">{formError}</div>}
        <div className="form-section">
          <div>
            <p className="tool-eyebrow">LIMITED ACCESS</p>
            <h3>Chỉ sửa trạng thái</h3>
            <small>
              Admin đã cấp quyền riêng cho tài khoản này. Bạn chỉ được xem tài
              khoản/mật khẩu và cập nhật trạng thái.
            </small>
          </div>
          <div className="form-grid two">
            <label className="tool-field">
              <span>Chủ sở hữu</span>
              <input
                className="tool-input"
                value={visitorName || form.ownerName}
                readOnly
              />
            </label>
            <label className="tool-field">
              <span>Trạng thái</span>
              <select
                className="tool-input"
                name="status"
                value={form.status}
                onChange={handleChange}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="form-actions">
          <button
            className="btn-tool-primary"
            disabled={saving}
            type="submit"
            data-testid="account-form-submit"
          >
            <Save size={18} />
            {saving ? "Đang lưu..." : "Lưu trạng thái"}
          </button>

          {onCancel && (
            <button
              className="btn-tool-ghost"
              type="button"
              onClick={onCancel}
              data-testid="account-form-cancel"
            >
              <X size={18} /> Hủy
            </button>
          )}
        </div>
      </form>
    );
  }

  return (
    <form className="account-form" onSubmit={handleSubmit}>
      {formError && <div className="tool-alert danger mb-3">{formError}</div>}

      <div className="form-section">
        <div>
          <p className="tool-eyebrow">IDENTITY</p>
          <h3>Thông tin tài khoản</h3>
        </div>
        <div className="form-grid two">
          <label className="tool-field">
            <span>Chủ sở hữu</span>
            <input
              className="tool-input"
              name="ownerName"
              value={
                lockOwnerName && visitorName ? visitorName : form.ownerName
              }
              onChange={handleChange}
              placeholder="VD: Minh / Acc phụ / Người dùng"
              readOnly={lockOwnerName && Boolean(visitorName)}
            />
            {lockOwnerName && visitorName && (
              <small>Lấy từ hồ sơ người dùng trong MongoDB.</small>
            )}
          </label>

          <label className="tool-field">
            <span>Email hoặc tên đăng nhập</span>
            <input
              className="tool-input"
              name="loginEmail"
              value={form.loginEmail}
              onChange={handleChange}
              placeholder="VD: example@gmail.com"
            />
          </label>

          <label className="tool-field">
            <span>Tên tài khoản / dịch vụ</span>
            <input
              className="tool-input"
              name="accountName"
              value={form.accountName}
              onChange={handleChange}
              placeholder="VD: ChatGPT Plus / Gmail phụ"
            />
          </label>

          <label className="tool-field">
            <span>Link mở nhanh</span>
            <input
              className="tool-input"
              name="serviceUrl"
              value={form.serviceUrl}
              onChange={handleChange}
              placeholder="VD: https://chatgpt.com"
            />
            <small>Khách chỉ được bấm mở link này, không xem email/pass.</small>
          </label>

          <label className="tool-field">
            <span>Ngày hết hạn / gia hạn</span>
            <input
              className="tool-input"
              name="renewalDate"
              type="date"
              value={form.renewalDate}
              onChange={handleChange}
            />
          </label>
        </div>
      </div>

      <div className="form-section">
        <div>
          <p className="tool-eyebrow">SECRET</p>
          <h3>Mật khẩu & phân loại</h3>
        </div>
        <div className="form-grid three">
          <label className="tool-field secret-field">
            <span>
              <KeyRound size={15} /> Mật khẩu
            </span>
            <div className="secret-input-wrap">
              <input
                className="tool-input secret-input"
                name="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={handleChange}
                placeholder={
                  mode === "edit"
                    ? "Để trống nếu không đổi"
                    : "Mật khẩu sẽ được mã hóa ở backend"
                }
                autoComplete="new-password"
              />
              <button
                type="button"
                className="input-icon-btn"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button
              className="btn-tool-ghost small mt-2"
              type="button"
              onClick={handleGeneratePassword}
            >
              <Sparkles size={15} /> Tạo mật khẩu mạnh
            </button>
          </label>

          <label className="tool-field">
            <span>Gói / phiên bản</span>
            <select
              className="tool-input"
              name="planVersion"
              value={form.planVersion}
              onChange={handleChange}
            >
              {PLAN_OPTIONS.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="tool-field">
            <span>Trạng thái</span>
            <select
              className="tool-input"
              name="status"
              value={form.status}
              onChange={handleChange}
            >
              {STATUS_OPTIONS.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="form-section">
        <div>
          <p className="tool-eyebrow">DETAILS</p>
          <h3>Ghi chú thêm</h3>
        </div>
        <div className="form-grid">
          <label className="tool-field">
            <span>Tags</span>
            <input
              className="tool-input"
              name="tags"
              value={form.tags}
              onChange={handleChange}
              placeholder="VD: học tập, gmail phụ, khách hàng A"
            />
          </label>

          <label className="tool-field">
            <span>Ghi chú</span>
            <textarea
              className="tool-input"
              name="note"
              rows="4"
              value={form.note}
              onChange={handleChange}
              placeholder="VD: tài khoản dùng cho học tập, liên kết số điện thoại cũ..."
            />
          </label>
        </div>
      </div>

      <div className="form-actions">
        <button
          className="btn-tool-primary"
          disabled={saving}
          type="submit"
          data-testid="account-form-submit"
        >
          <Save size={18} />
          {saving
            ? "Đang lưu..."
            : mode === "edit"
              ? "Lưu thay đổi"
              : "Thêm tài khoản"}
        </button>

        {onCancel && (
          <button
            className="btn-tool-ghost"
            type="button"
            onClick={onCancel}
            data-testid="account-form-cancel"
          >
            <X size={18} /> Hủy
          </button>
        )}
      </div>
    </form>
  );
}
