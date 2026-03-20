'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';

export function AnomalyTrendChart({ data = [] }) {
  const chartData = useMemo(() => {
    if (!data.length) return [];
    return data.slice(-20).map((item) => ({
      timestamp: new Date(item.timestamp || item.window_start).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      score: item.anomaly_score || item.score || 0,
      eventCount: item.event_count || 0,
      errorRate: ((item.error_rate || 0) * 100).toFixed(1),
    }));
  }, [data]);

  if (!chartData.length) {
    return (
      <div className="h-64 flex items-center justify-center bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-gray-200 dark:border-slate-700">
        <p className="text-gray-500 dark:text-slate-400 text-sm">No data to display</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="timestamp" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 12, fill: '#666' }} />
        <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#666' }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#666' }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #ddd', borderRadius: '8px' }}
          labelStyle={{ color: '#000' }}
        />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="score"
          stroke="#ef4444"
          dot={false}
          name="Anomaly Score"
          strokeWidth={2}
        />
        <Bar
          yAxisId="right"
          dataKey="eventCount"
          fill="#0066ff"
          opacity={0.7}
          name="Event Count"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function ServiceAnomalyChart({ data = [] }) {
  const chartData = useMemo(() => {
    const serviceMap = {};
    data.forEach((item) => {
      const service = item.service || 'unknown';
      if (!serviceMap[service]) serviceMap[service] = [];
      serviceMap[service].push(item.anomaly_score || item.score || 0);
    });

    return Object.entries(serviceMap)
      .map(([service, scores]) => ({
        service,
        avgScore: (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1),
        maxScore: Math.max(...scores),
        count: scores.length,
      }))
      .sort((a, b) => parseFloat(b.avgScore) - parseFloat(a.avgScore));
  }, [data]);

  if (!chartData.length) {
    return (
      <div className="h-64 flex items-center justify-center bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-gray-200 dark:border-slate-700">
        <p className="text-gray-500 dark:text-slate-400 text-sm">No data to display</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis type="number" tick={{ fontSize: 12, fill: '#666' }} />
        <YAxis dataKey="service" type="category" width={75} tick={{ fontSize: 11, fill: '#666' }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #ddd', borderRadius: '8px' }}
        />
        <Legend />
        <Bar dataKey="avgScore" fill="#f59e0b" name="Avg Score" />
        <Bar dataKey="maxScore" fill="#ef4444" name="Max Score" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function EventDistributionChart({ data = [] }) {
  const chartData = useMemo(() => {
    return data.slice(-10).map((item) => ({
      time: new Date(item.timestamp || item.window_start).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      events: item.event_count || 0,
      errors: Math.round((item.error_rate || 0) * (item.event_count || 0)),
      warnings: Math.round((item.event_count || 0) * 0.1),
    }));
  }, [data]);

  if (!chartData.length) {
    return (
      <div className="h-64 flex items-center justify-center bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-gray-200 dark:border-slate-700">
        <p className="text-gray-500 dark:text-slate-400 text-sm">No data to display</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="time" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 12, fill: '#666' }} />
        <YAxis tick={{ fontSize: 12, fill: '#666' }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #ddd', borderRadius: '8px' }}
        />
        <Legend />
        <Bar dataKey="events" stackId="a" fill="#0066ff" name="Events" />
        <Bar dataKey="errors" stackId="a" fill="#ef4444" name="Errors" />
        <Bar dataKey="warnings" stackId="a" fill="#f59e0b" name="Warnings" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default { AnomalyTrendChart, ServiceAnomalyChart, EventDistributionChart };
