import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { PLAN_OPTIONS, STATUS_OPTIONS } from "../../utils/labels";

export default function AccountFilters({ filters, onChange }) {
  function updateField(name, value) {
    onChange((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function resetFilters() {
    onChange({ search: "", status: "all", planVersion: "all" });
  }

  const hasFilter = Boolean(
    filters.search || filters.status !== "all" || filters.planVersion !== "all",
  );

  return (
    <div className="record-filters">
      <div className="filter-title">
        <SlidersHorizontal size={17} /> Bộ lọc nhanh
      </div>
      <div className="filter-grid">
        <label className="filter-search">
          <Search size={18} />
          <input
            value={filters.search}
            onChange={(event) => updateField("search", event.target.value)}
            placeholder="Tìm tên tài khoản, email, chủ sở hữu, ghi chú, tag..."
          />
        </label>

        <select
          value={filters.status}
          onChange={(event) => updateField("status", event.target.value)}
        >
          <option value="all">Tất cả trạng thái</option>
          {STATUS_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        <select
          value={filters.planVersion}
          onChange={(event) => updateField("planVersion", event.target.value)}
        >
          <option value="all">Tất cả gói</option>
          {PLAN_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        <button
          className="btn-tool-ghost filter-reset"
          type="button"
          onClick={resetFilters}
          disabled={!hasFilter}
        >
          <RotateCcw size={16} /> Reset
        </button>
      </div>
    </div>
  );
}
