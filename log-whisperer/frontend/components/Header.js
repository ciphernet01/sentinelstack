'use client';

import { AlertCircle, Activity, Settings, LogOut } from 'lucide-react';

export default function Header({ backendUp, refreshing, onRefresh, onSettings }) {
  return (
    <header className="bg-white dark:bg-slate-950 border-b border-gray-200 dark:border-slate-800 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Branding */}
          <div className="flex items-center gap-3">
            {/* SentinelStack Logo */}
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  SentinelStack
                </h1>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-2 py-1 rounded-full border border-gray-300 dark:border-gray-700">
                  Log Whisperer
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Intelligent Log Analysis & Anomaly Detection
              </p>
            </div>
          </div>

          {/* Status & Controls */}
          <div className="flex items-center gap-4">
            {/* Backend Status */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-slate-900">
              <div
                className={`w-3 h-3 rounded-full ${
                  backendUp ? 'bg-emerald-500' : 'bg-red-500'
                } ${backendUp ? 'deeplink-pulse' : ''}`}
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {backendUp ? 'Backend Online' : 'Offline'}
              </span>
            </div>

            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
            >
              {refreshing ? 'Loading...' : 'Refresh'}
            </button>

            {/* Settings Button */}
            <button
              onClick={onSettings}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-900 rounded-lg transition-all"
              title="Upload Logs"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
