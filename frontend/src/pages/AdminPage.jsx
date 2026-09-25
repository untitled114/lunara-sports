import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Segmented, PageState } from '@/components/ui';

const ADMIN_BASE = 'https://admin.lunara-app.com';

const TABS = [
  {
    key: 'analytics',
    label: 'Analytics',
    src: `${ADMIN_BASE}/metabase/public/dashboard/ff0a078f-d71c-4ced-a28c-79d9c12f976a`,
  },
  {
    key: 'pipeline',
    label: 'Pipeline ops',
    src: `${ADMIN_BASE}/grafana/d/pipeline-ops/pipeline-operations?orgId=1&kiosk`,
  },
  {
    key: 'models',
    label: 'Model performance',
    src: `${ADMIN_BASE}/grafana/d/model-perf/model-performance?orgId=1&kiosk`,
  },
];

export default function AdminPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('analytics');
  const current = TABS.find((t) => t.key === activeTab);

  // Guard: only show to authenticated users (add role check if needed)
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <h1 className="sr-only">Admin</h1>
        <PageState kind="empty" title="Sign in required" message="Sign in to access the admin dashboard." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 max-w-[1600px] mx-auto w-full">
      <h1 className="t-title text-text-1">Admin</h1>
      {/* Tab bar */}
      <div className="flex gap-2 items-center">
        <Segmented aria-label="Admin section" options={TABS.map((tab) => ({ id: tab.key, label: tab.label }))} value={activeTab} onChange={setActiveTab} />
        <a
          href={ADMIN_BASE}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto t-label text-text-3 hover:text-text-2 transition-colors"
        >
          Open full dashboard
        </a>
      </div>

      {/* Embedded iframe */}
      <div className="bg-surface-1 rounded-lg border border-border overflow-hidden" style={{ height: 'calc(100vh - 180px)' }}>
        <iframe
          src={current.src}
          title={current.label}
          className="w-full h-full border-0"
          style={{ background: 'var(--surface-1)' }}
          allow="fullscreen"
        />
      </div>
    </div>
  );
}
