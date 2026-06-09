'use client';

import { AuditLogsViewer } from '@/components/monitoring/AuditLogsViewer';
import { Card } from '@/components/shared/Card';

export default function MonitoringPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Monitoring</h1>
        <p className="text-gray-600 mt-2">Consultez les logs d'administration et l'audit des actions</p>
      </div>

      <Card>
        <h2 className="text-xl font-semibold mb-6">Journaux d'audit</h2>
        <AuditLogsViewer />
      </Card>
    </div>
  );
}
