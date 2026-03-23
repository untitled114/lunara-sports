import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { BarChart3, Activity, LineChart } from "lucide-react";

const ADMIN_BASE = "https://admin.lunara-app.com";

const TABS = [
  {
    key: "analytics",
    label: "Analytics",
    icon: BarChart3,
    src: `${ADMIN_BASE}/metabase/public/dashboard/eb478443-9dd6-4cb5-a6de-305fccfa62aa`,
  },
  {
    key: "pipeline",
    label: "Pipeline Ops",
    icon: Activity,
    src: `${ADMIN_BASE}/grafana/d/pipeline-ops/pipeline-operations?orgId=1&kiosk`,
  },
  {
    key: "models",
    label: "Model Performance",
    icon: LineChart,
    src: `${ADMIN_BASE}/grafana/d/model-perf/model-performance?orgId=1&kiosk`,
  },
];

export default function AdminPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("analytics");
  const current = TABS.find((t) => t.key === activeTab);

  // Guard: only show to authenticated users (add role check if needed)
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-white/40 text-sm">Sign in to access the admin dashboard.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 max-w-[1600px] mx-auto w-full">
      {/* Tab bar */}
      <div className="flex gap-2 items-center">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                active
                  ? "bg-white/10 text-white border border-white/10"
                  : "text-white/30 hover:text-white/50 border border-transparent"
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
        <a
          href={ADMIN_BASE}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-[10px] text-white/20 hover:text-white/40 transition-colors"
        >
          Open full dashboard
        </a>
      </div>

      {/* Embedded iframe */}
      <div className="liquid-mirror rounded-2xl border border-white/5 overflow-hidden" style={{ height: "calc(100vh - 180px)" }}>
        <iframe
          src={current.src}
          title={current.label}
          className="w-full h-full border-0"
          style={{ background: "#1a1a2e" }}
          allow="fullscreen"
        />
      </div>
    </div>
  );
}
