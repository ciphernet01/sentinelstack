'use client';

import { useState } from 'react';
import { Filter, X } from 'lucide-react';

export default function FilterControls({
  services = [],
  onFilterChange,
  isDirty = false,
  onReset,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState({
    service: '',
    minScore: 0,
    maxScore: 100,
    startDate: '',
    endDate: '',
  });

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  const handleReset = () => {
    setFilters({
      service: '',
      minScore: 0,
      maxScore: 100,
      startDate: '',
      endDate: '',
    });
    onReset?.();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
          isDirty
            ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
            : 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
        }`}
      >
        <Filter className="w-4 h-4" />
        <span className="text-sm font-medium">Filters</span>
        {isDirty && (
          <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400"></span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full mt-2 right-0 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg z-40 w-72 p-4 space-y-4">
          {/* Service Filter */}
          {services.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-2">
                Service
              </label>
              <select
                value={filters.service}
                onChange={(e) => handleFilterChange('service', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg text-sm"
              >
                <option value="">All Services</option>
                {services.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Score Range */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-2">
              Anomaly Score Range
            </label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={filters.minScore}
                  onChange={(e) => handleFilterChange('minScore', parseInt(e.target.value) || 0)}
                  className="flex-1 px-2 py-1 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded text-sm"
                  placeholder="Min"
                />
                <span className="text-gray-500 dark:text-slate-500">-</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={filters.maxScore}
                  onChange={(e) => handleFilterChange('maxScore', parseInt(e.target.value) || 100)}
                  className="flex-1 px-2 py-1 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded text-sm"
                  placeholder="Max"
                />
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={filters.minScore}
                onChange={(e) => handleFilterChange('minScore', parseInt(e.target.value))}
                className="w-full accent-blue-600 dark:accent-blue-500"
              />
            </div>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-2">
              Date Range
            </label>
            <div className="space-y-2">
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg text-sm"
              />
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-slate-700">
            <button
              onClick={handleReset}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              Reset
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="flex-1 px-3 py-2 text-sm bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-all"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
