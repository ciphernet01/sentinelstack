'use client';

import { useEffect, useState, useCallback } from 'react';
import { UploadCloud, Eye, EyeOff } from 'lucide-react';
import Header from '@/components/Header';
import StatsPanel from '@/components/StatsPanel';
import AnomalyFeed from '@/components/AnomalyFeed';
import CrashReportPanel from '@/components/CrashReportPanel';
import RealtimeAnomalyStream from '@/components/RealtimeStream';
import LogUploadModal from '@/components/LogUploadModal';
import FilterControls from '@/components/FilterControls';
import { AnomalyTrendChart, ServiceAnomalyChart, EventDistributionChart } from '@/components/Charts';
import { api } from '@/lib/api';

export default function Dashboard() {
  const [data, setData] = useState({
    health: null,
    status: null,
    anomalies: [],
    crashReport: null,
    error: null,
  });

  const [ui, setUI] = useState({
    loading: true,
    refreshing: false,
    showUploadModal: false,
    showRealtimeStream: true,
    showAllAnomalies: false,
    filters: {},
    filteredAnomalies: [],
  });

  // Fetch dashboard data
  const fetchDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setUI((prev) => ({ ...prev, refreshing: true }));

    try {
      const results = await Promise.allSettled([
        api.health(),
        api.status(),
        api.getLatestAnomalies(50),
        api.getLatestCrashReport(),
      ]);

      const [healthResult, statusResult, anomaliesResult, reportResult] = results;

      const health = healthResult.status === 'fulfilled' ? healthResult.value : { status: 'offline' };
      const status = statusResult.status === 'fulfilled' ? statusResult.value : { events_ingested: 0, windows_processed: 0, anomalies_detected: 0 };
      const anomalies = anomaliesResult.status === 'fulfilled' ? (anomaliesResult.value || []) : [];
      const crashReport = reportResult.status === 'fulfilled' ? reportResult.value : null;

      setData({
        health,
        status,
        anomalies: Array.isArray(anomalies) ? anomalies : [],
        crashReport,
        error: null,
      });
    } catch (error) {
      console.error('Dashboard fetch error:', error);
      setData((prev) => ({
        ...prev,
        error: error.message || 'Failed to load dashboard',
      }));
    } finally {
      setUI((prev) => ({
        ...prev,
        loading: false,
        refreshing: false,
      }));
    }
  }, []);

  // Auto-refresh
  useEffect(() => {
    fetchDashboard();
    const intervalId = setInterval(() => fetchDashboard(true), 5000);
    return () => clearInterval(intervalId);
  }, [fetchDashboard]);

  // Apply filters
  useEffect(() => {
    let filtered = data.anomalies;

    if (ui.filters.service) {
      filtered = filtered.filter((a) => (a.service || '').toLowerCase().includes(ui.filters.service.toLowerCase()));
    }

    if (ui.filters.minScore !== undefined) {
      filtered = filtered.filter((a) => (a.anomaly_score || a.score || 0) >= ui.filters.minScore);
    }

    if (ui.filters.maxScore !== undefined) {
      filtered = filtered.filter((a) => (a.anomaly_score || a.score || 0) <= ui.filters.maxScore);
    }

    setUI((prev) => ({
      ...prev,
      filteredAnomalies: filtered,
    }));
  }, [data.anomalies, ui.filters]);

  const backendUp = data.health?.status === 'ok';
  const displayedAnomalies = ui.showAllAnomalies ? ui.filteredAnomalies : ui.filteredAnomalies.slice(0, 10);
  const uniqueServices =Array.from(new Set(data.anomalies.map((a) => a.service || 'unknown'))).filter(
    (s) => s !== 'unknown'
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <Header
        backendUp={backendUp}
        refreshing={ui.refreshing}
        onRefresh={() => fetchDashboard(true)}
        onSettings={() => setUI((prev) => ({ ...prev, showUploadModal: true }))}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Error Banner */}
        {data.error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900 dark:text-red-200">Error</p>
              <p className="text-red-700 dark:text-red-300 text-sm">{data.error}</p>
            </div>
          </div>
        )}

        {/* Stats Panel */}
        <StatsPanel status={data.status} />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-8">
          {/* Left Column - Anomalies & Charts */}
          <div className="space-y-6">
            {/* Anomaly Trend Chart */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Anomaly Trends</h2>
              <AnomalyTrendChart data={data.anomalies} />
            </div>

            {/* Service Comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Service Analysis</h2>
                <ServiceAnomalyChart data={data.anomalies} />
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Event Distribution</h2>
                <EventDistributionChart data={data.anomalies} />
              </div>
            </div>

            {/* Real-time Stream */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Live Anomaly Stream</h2>
                <button
                  onClick={() =>
                    setUI((prev) => ({
                      ...prev,
                      showRealtimeStream: !prev.showRealtimeStream,
                    }))
                  }
                  className="p-1 text-gray-600 hover:text-gray-900"
                >
                  {ui.showRealtimeStream ? (
                    <Eye className="w-5 h-5" />
                  ) : (
                    <EyeOff className="w-5 h-5" />
                  )}
                </button>
              </div>
              <RealtimeAnomalyStream
                isEnabled={ui.showRealtimeStream}
                onNewAnomaly={() => fetchDashboard(true)}
              />
            </div>
          </div>
        </div>

        {/* Anomalies Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Anomalies ({ui.filteredAnomalies.length})
            </h2>
            <div className="flex items-center gap-2">
              <FilterControls
                services={uniqueServices}
                isDirty={Object.values(ui.filters).some((v) => v !== '' && v !== 0 && v !== 100)}
                onFilterChange={(filters) => setUI((prev) => ({ ...prev, filters }))}
                onReset={() => setUI((prev) => ({ ...prev, filters: {} }))}
              />
              {ui.filteredAnomalies.length > 10 && (
                <button
                  onClick={() =>
                    setUI((prev) => ({
                      ...prev,
                      showAllAnomalies: !prev.showAllAnomalies,
                    }))
                  }
                  className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {ui.showAllAnomalies
                    ? 'Show Less'
                    : `Show All (${ui.filteredAnomalies.length})`}
                </button>
              )}
            </div>
          </div>

          <AnomalyFeed anomalies={displayedAnomalies} isLoading={ui.loading} />
        </div>

        {/* Crash Report & ML Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Latest Crash Report</h2>
            <CrashReportPanel
              report={data.crashReport}
              isLoading={ui.loading}
              onRefresh={() => fetchDashboard(true)}
            />
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 p-6 flex flex-col">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
            <button
              onClick={() => setUI((prev) => ({ ...prev, showUploadModal: true }))}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-medium transition-all shadow-sm hover:shadow-md mb-3"
            >
              <UploadCloud className="w-5 h-5" />
              Upload Logs
            </button>
            <button
              onClick={() => fetchDashboard(true)}
              className="flex items-center justify-center px-4 py-3 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-900 dark:text-white rounded-lg font-medium transition-all"
            >
              Refresh Data
            </button>
          </div>
        </div>
      </main>

      {/* Upload Modal */}
      <LogUploadModal
        isOpen={ui.showUploadModal}
        onClose={() => setUI((prev) => ({ ...prev, showUploadModal: false }))}
        onSuccess={() => fetchDashboard(true)}
      />
    </div>
  );
}
