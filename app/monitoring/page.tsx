'use client';

import { AuditLogsViewer } from '@/components/monitoring/AuditLogsViewer';

export default function MonitoringPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Monitoring</h2>
        <p className="text-sm text-gray-500 mt-0.5">Journaux d&apos;audit et traçabilité des actions admin</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h3 className="text-sm font-semibold text-gray-900">Journaux d&apos;audit</h3>
        </div>
        <div className="p-5">
          <AuditLogsViewer />
        </div>
      </div>
    </div>
  );
}
