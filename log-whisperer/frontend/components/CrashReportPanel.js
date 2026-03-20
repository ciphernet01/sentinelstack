'use client';

import { AlertTriangle, Clock, Activity, TrendingDown, Lightbulb } from 'lucide-react';
import { formatDateTime, formatRelativeTime } from '@/lib/utils';

export default function CrashReportPanel({ report, isLoading = false, onRefresh }) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/2"></div>
          <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-3/4"></div>
          <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!report || !report.root_cause) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-slate-400 text-sm">No crash reports yet</p>
        <p className="text-gray-400 dark:text-slate-500 text-xs mt-1">Reports are generated when critical anomalies are detected</p>
        <button
          onClick={onRefresh}
          className="mt-4 px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
        >
          Refresh
        </button>
      </div>
    );
  }

  const affectedServices = report.affected_services || [];
  const timeline = report.timeline || [];
  const recommendations = report.recommendations || [];
  const confidence = report.confidence || 0;

  return (
    <div className="space-y-4">
      {/* Root Cause */}
      <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-red-900 dark:text-red-300 mb-1">Root Cause Analysis</h3>
            <p className="text-sm text-red-800 dark:text-red-200 mb-2">{report.root_cause}</p>
            <div className="text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
              <span>Confidence: {Math.round(confidence * 100)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Affected Services */}
      {affectedServices.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            Affected Services
          </h3>
          <div className="flex flex-wrap gap-2">
            {affectedServices.map((service, idx) => (
              <span
                key={`${service}-${idx}`}
                className="px-3 py-1 bg-orange-100 dark:bg-orange-950/30 text-orange-800 dark:text-orange-300 text-xs font-medium rounded-full border border-orange-200 dark:border-orange-900/50"
              >
                {service}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      {timeline.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Event Timeline
          </h3>
          <div className="space-y-2">
            {timeline.slice(0, 5).map((event, idx) => (
              <div key={idx} className="text-xs border-l-2 border-blue-300 dark:border-blue-600/50 pl-3 py-1">
                <div className="font-medium text-gray-900 dark:text-white">{event.type || 'Event'}</div>
                <div className="text-gray-600 dark:text-slate-400">{event.description || event.details}</div>
                {event.timestamp && (
                  <div className="text-gray-500 dark:text-slate-500 mt-1">{formatRelativeTime(event.timestamp)}</div>
                )}
              </div>
            ))}
            {timeline.length > 5 && (
              <p className="text-xs text-gray-500 dark:text-slate-500 pt-2">+{timeline.length - 5} more events</p>
            )}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-3 text-sm flex items-center gap-2">
            <Lightbulb className="w-4 h-4" />
            Recommendations
          </h3>
          <ul className="space-y-2">
            {recommendations.slice(0, 4).map((rec, idx) => (
              <li key={idx} className="text-xs text-blue-800 dark:text-blue-200 flex gap-2">
                <span className="text-blue-600 dark:text-blue-400 font-bold flex-shrink-0">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Report Timestamp */}
      <div className="text-xs text-gray-500 dark:text-slate-500 flex items-center gap-1">
        <Clock className="w-3 h-3" />
        Generated: {formatDateTime(report.timestamp || report.generated_at)}
      </div>
    </div>
  );
}
