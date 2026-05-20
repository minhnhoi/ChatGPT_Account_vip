import { Crown, Database, ShieldCheck, Sparkles } from "lucide-react";

export default function StatCards({ stats }) {
  const cards = [
    {
      label: "Tổng tài khoản",
      value: stats?.total ?? 0,
      sub: `+${stats?.createdThisMonth ?? 0} tài khoản mới`,
      icon: Database,
      tone: ""
    },
    {
      label: "Gói Plus",
      value: stats?.byPlan?.plus ?? 0,
      sub: `${stats?.total ? Math.round(((stats?.byPlan?.plus ?? 0) / stats.total) * 100) : 0}% tổng số`,
      icon: Sparkles,
      tone: "blue"
    },
    {
      label: "Gói Pro",
      value: stats?.byPlan?.pro ?? 0,
      sub: `${stats?.total ? Math.round(((stats?.byPlan?.pro ?? 0) / stats.total) * 100) : 0}% tổng số`,
      icon: Crown,
      tone: "purple"
    },
    {
      label: "Trạng thái New",
      value: stats?.newAccounts ?? 0,
      sub: stats?.newAccounts ? "Chưa kích hoạt" : "Không có tài khoản mới",
      icon: ShieldCheck,
      tone: "green"
    }
  ];

  return (
    <section className="vault-stats-grid" data-testid="dashboard-stat-cards">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article
            className={`vault-stat-card ${card.tone}`}
            key={card.label}
            data-testid={`stat-card-${card.label}`}
          >
            <div>
              <p>{card.label}</p>
              <strong>{card.value}</strong>
              <span>{card.sub}</span>
            </div>
            <Icon size={28} className="vault-stat-icon" />
          </article>
        );
      })}
    </section>
  );
}
