'use client';

import { TrendingUp, AlertTriangle, FileText, Zap } from 'lucide-react';

function StatCard({ icon: Icon, label, value, unit, color = 'blue' }) {
  const colorClasses = {
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    green: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
    orange: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
    red: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  };

  return (
    <div className={`rounded-lg border p-6 transition-all hover:shadow-md ${colorClasses[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">{label}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900 dark:text-white">{value || '-'}</span>
            {unit && <span className="text-sm text-gray-600 dark:text-gray-400">{unit}</span>}
          </div>
        </div>
        <Icon className="w-8 h-8 opacity-40" />
      </div>
    </div>
  );
}

export default function StatsPanel({ status }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={FileText}
        label="Events Ingested"
        value={status?.events_ingested || 0}
        unit="logs"
        color="blue"
      />
      <StatCard
        icon={TrendingUp}
        label="Windows Processed"
        value={status?.windows_processed || 0}
        unit="windows"
        color="green"
      />
      <StatCard
        icon={AlertTriangle}
        label="Anomalies Detected"
        value={status?.anomalies_count || 0}
        unit="anomalies"
        color="orange"
      />
      <StatCard
        icon={Zap}
        label="Alert Threshold"
        value={status?.alert_threshold || 75}
        unit="score"
        color="red"
      />
    </div>
  );
}
