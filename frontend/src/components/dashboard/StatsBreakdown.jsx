import {
  PLAN_OPTIONS,
  STATUS_OPTIONS,
  getPlanLabel,
  getStatusLabel,
} from "../../utils/labels";

function BreakdownList({ title, data = {}, type, command }) {
  const source = type === "plan" ? PLAN_OPTIONS : STATUS_OPTIONS;
  const total = Object.values(data).reduce((sum, value) => sum + value, 0) || 1;

  return (
    <section className="tool-panel mini-panel">
      <div className="panel-heading compact">
        <div>
          <p className="tool-eyebrow">{command}</p>
          <h2>{title}</h2>
        </div>
      </div>

      <div className="breakdown-list">
        {source.map((item) => {
          const count = data[item.value] || 0;
          const percent = Math.round((count / total) * 100);
          const label =
            type === "plan"
              ? getPlanLabel(item.value)
              : getStatusLabel(item.value);

          return (
            <div className="breakdown-row" key={item.value}>
              <div>
                <span>{label}</span>
                <b>{count}</b>
              </div>
              <div
                className="progress thin-progress"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <div
                  className="progress-bar"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function StatsBreakdown({ stats }) {
  return (
    <div className="breakdown-grid">
      <BreakdownList
        title="Theo trạng thái"
        data={stats?.byStatus}
        type="status"
        command="STATUS"
      />
      <BreakdownList
        title="Theo gói"
        data={stats?.byPlan}
        type="plan"
        command="PLAN"
      />
    </div>
  );
}
