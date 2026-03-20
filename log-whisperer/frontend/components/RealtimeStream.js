'use client';

import { useState, useEffect, useRef } from 'react';
import { createAnomalyStream } from '@/lib/api';
import { formatRelativeTime, getSeverityLabel } from '@/lib/utils';
import { AlertTriangle, Radio, Wifi, WifiOff } from 'lucide-react';
import { AnomalyScoreBadge } from './AnomalyScore';

const MAX_STREAM_ITEMS = 50;

export default function RealtimeAnomalyStream({ isEnabled = true, onNewAnomaly }) {
  const [streamAnomalies, setStreamAnomalies] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  useEffect(() => {
    if (!isEnabled) return;

    const setupStream = () => {
      try {
        wsRef.current = createAnomalyStream(
          (data) => {
            setStreamAnomalies((prev) => {
              const newAnomalies = Array.isArray(data) ? data : [data];
              const combined = [...newAnomalies, ...prev].slice(0, MAX_STREAM_ITEMS);
              onNewAnomaly?.(newAnomalies[0]);
              return combined;
            });
            setIsConnected(true);
            setConnectionError(null);
          },
          (error) => {
            console.error('Stream error:', error);
            setIsConnected(false);
            setConnectionError('Connection error, retrying...');
            // Try to reconnect after 3 seconds
            reconnectTimeoutRef.current = setTimeout(setupStream, 3000);
          },
          () => {
            setIsConnected(false);
            // Try to reconnect after 3 seconds
            reconnectTimeoutRef.current = setTimeout(setupStream, 3000);
          }
        );
        setIsConnected(true);
        setConnectionError(null);
      } catch (error) {
        console.error('Failed to setup stream:', error);
        setConnectionError('Failed to connect');
        reconnectTimeoutRef.current = setTimeout(setupStream, 3000);
      }
    };

    setupStream();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [isEnabled, onNewAnomaly]);

  if (!isEnabled) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 p-8 text-center">
        <Radio className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-slate-400 text-sm">Real-time stream disabled</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Connection Status */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
        {isConnected ? (
          <>
            <Wifi className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Live Stream Connected</span>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4 text-red-600 dark:text-red-400" />
            <span className="text-xs font-medium text-red-700 dark:text-red-300">
              {connectionError || 'Connecting...'}
            </span>
          </>
        )}
      </div>

      {/* Stream Items */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 overflow-hidden max-h-96 overflow-y-auto">
        {streamAnomalies.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-slate-400">
            <Radio className="w-8 h-8 text-gray-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm">Waiting for real-time anomalies...</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-slate-800">
            {streamAnomalies.map((anomaly, idx) => {
              const score = anomaly.anomaly_score ?? anomaly.score ?? 0;
              const service = anomaly.service || 'unknown';
              const timestamp = anomaly.timestamp || anomaly.window_start;

              return (
                <div
                  key={`${timestamp}-${service}-${idx}`}
                  className="p-3 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors border-l-4"
                  style={{
                    borderColor:
                      score < 25 ? '#10b981' : score < 50 ? '#f59e0b' : score < 75 ? '#f97316' : '#ef4444',
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                          {service}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded">
                          {getSeverityLabel(score)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-slate-400 truncate">
                        Events: {anomaly.event_count || 0} | Error: {(anomaly.error_rate || 0).toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">
                        {formatRelativeTime(timestamp)}
                      </div>
                    </div>
                    <AnomalyScoreBadge score={score} size="sm" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
