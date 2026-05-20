import { Save, UserRound } from "lucide-react";
import { useState } from "react";

export default function VisitorNameGate({ onSave }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const cleanName = name.trim().replace(/\s+/g, " ");

    if (cleanName.length < 2) {
      setError("Nhập tên của bạn để hệ thống gắn quyền truy cập riêng.");
      return;
    }

    onSave(cleanName.slice(0, 80));
  }

  return (
    <main className="auth-page">
      <section className="visitor-gate-card" aria-label="Visitor name setup">
        <div className="auth-lock-icon">
          <UserRound size={30} />
        </div>
        <p className="tool-eyebrow mb-2">FIRST TIME SETUP</p>
        <h1>Bạn tên gì?</h1>
        <p>
          Nếu hồ sơ trong MongoDB đang là <b>non</b>, web sẽ hỏi tên ở đây. Tên
          này được lưu vào MongoDB để tự điền chủ sở hữu và để admin cấp quyền
          riêng cho từng tài khoản.
        </p>

        {error && <div className="tool-alert danger mb-3">{error}</div>}

        <form onSubmit={handleSubmit} className="visitor-name-form">
          <label className="tool-field">
            <span>Tên hiển thị</span>
            <input
              className="tool-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="VD: Minh"
              autoFocus
              data-testid="visitor-name-input"
            />
          </label>
          <button
            className="btn-tool-primary"
            type="submit"
            data-testid="visitor-name-save"
          >
            <Save size={18} /> Lưu và vào web
          </button>
        </form>
      </section>
    </main>
  );
}
