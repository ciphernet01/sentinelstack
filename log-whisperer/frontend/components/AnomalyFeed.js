'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, TrendingUp, Clock } from 'lucide-react';
import { AnomalyScoreBadge } from './AnomalyScore';
import { formatRelativeTime, getSeverityLabel } from '@/lib/utils';

export default function AnomalyFeed({ anomalies = [], isLoading = false, onAnomalyClick }) {
  const [displayAnomalies, setDisplayAnomalies] = useState(anomalies);

  useEffect(() => {
    setDisplayAnomalies(anomalies);
  }, [anomalies]);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 p-6">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!displayAnomalies.length) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-slate-400 text-sm">No anomalies detected yet</p>
        <p className="text-gray-400 dark:text-slate-500 text-xs mt-1">Check back when logs are ingested</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 overflow-hidden">
      <div className="divide-y divide-gray-200 dark:divide-slate-800">
        {displayAnomalies.map((anomaly, idx) => {
          const score = anomaly.anomaly_score ?? anomaly.score ?? 0;
          const service = anomaly.service || anomaly.service_name || 'unknown';
          const timestamp = anomaly.timestamp || anomaly.window_start;
          const severity = getSeverityLabel(score);

          return (
            <button
              key={`${anomaly.id || service}-${idx}`}
              onClick={() => onAnomalyClick?.(anomaly)}
              className="w-full text-left p-4 hover:bg-blue-50 dark:hover:bg-slate-800/50 transition-colors border-l-4 hover:border-l-blue-500 dark:hover:border-l-blue-400"
              style={{
                borderColor: score < 25 ? '#10b981' : score < 50 ? '#f59e0b' : score < 75 ? '#f97316' : '#ef4444',
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900 dark:text-white truncate">{service}</span>
                    <span className="text-xs text-gray-600 dark:text-slate-400 px-2 py-0.5 bg-gray-100 dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700">
                      {severity}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-slate-400 mb-2">
                    Events: {anomaly.event_count || 0} | Error Rate: {(anomaly.error_rate || 0).toFixed(1)}% | Latency: {anomaly.latency_ms || 0}ms
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-500">
                    <Clock className="w-3 h-3" />
                    {formatRelativeTime(timestamp)}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <AnomalyScoreBadge score={score} />
                </div>
              </div>

              {/* Model Breakdown (if available) */}
              {anomaly.model_scores && Object.keys(anomaly.model_scores).length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-slate-700 text-xs text-gray-600 dark:text-slate-400">
                  <div className="grid grid-cols-2 gap-1">
                    {Object.entries(anomaly.model_scores).slice(0, 4).map(([model, value]) => (
                      <span key={model}>
                        {model}: {Math.round(value || 0)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
