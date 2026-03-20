'use client';

// Score color mapping
export function getAnomalyColor(score) {
  if (score < 25) return 'text-green-600';
  if (score < 50) return 'text-yellow-600';
  if (score < 75) return 'text-orange-600';
  return 'text-red-600';
}

export function getAnomalyBgColor(score) {
  if (score < 25) return 'bg-green-50 border-green-200';
  if (score < 50) return 'bg-yellow-50 border-yellow-200';
  if (score < 75) return 'bg-orange-50 border-orange-200';
  return 'bg-red-50 border-red-200';
}

export function getAnomalyBadgeColor(score) {
  if (score < 25) return 'bg-green-100 text-green-800';
  if (score < 50) return 'bg-yellow-100 text-yellow-800';
  if (score < 75) return 'bg-orange-100 text-orange-800';
  return 'bg-red-100 text-red-800';
}

export function getSeverityLabel(score) {
  if (score < 25) return 'Low';
  if (score < 50) return 'Medium';
  if (score < 75) return 'High';
  return 'Critical';
}

// Format timestamps
export function formatTime(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    hour12: false 
  });
}

export function formatDateTime(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
}

export function formatRelativeTime(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return formatDateTime(timestamp);
}

// Format numbers
export function formatNumber(num) {
  if (!Number.isFinite(num)) return '-';
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function formatPercent(value, decimals = 1) {
  if (!Number.isFinite(value)) return '-';
  return `${(value * 100).toFixed(decimals)}%`;
}

// Extract anomaly details
export function getAnomalyDetails(anomaly) {
  return {
    id: anomaly.id || anomaly.window || anomaly.timestamp,
    service: anomaly.service || anomaly.service_name || 'unknown',
    score: anomaly.anomaly_score ?? anomaly.score ?? 0,
    timestamp: anomaly.timestamp || anomaly.window_start,
    eventCount: anomaly.event_count || 0,
    errorRate: anomaly.error_rate || 0,
    latency: anomaly.latency_ms || 0,
    models: anomaly.model_scores || {},
    features: anomaly.features || {},
  };
}

// Extract log details
export function getLogDetails(log) {
  return {
    id: log.id || log.timestamp || log.window_start,
    service: log.service || log.service_name || 'unknown',
    timestamp: log.timestamp || log.window_start,
    eventCount: log.event_count || 0,
    errorRate: log.error_rate || 0,
    latency: log.latency_ms || 0,
    level: log.level || 'INFO',
    message: log.message || log.text || '',
  };
}

// Extract crash report details
export function getCrashReportDetails(report) {
  return {
    id: report.id || report.report_id,
    rootCause: report.root_cause || 'Unknown',
    firstAnomaly: report.first_anomaly_timestamp || report.timestamp,
    affectedServices: report.affected_services || [],
    timeline: report.timeline || [],
    recommendations: report.recommendations || [],
    confidence: report.confidence || 0,
  };
}

// Query builders
export function buildDateRange(startDate, endDate) {
  return {
    start_time: startDate?.toISOString(),
    end_time: endDate?.toISOString(),
  };
}

export function buildAnomalyFilter(filters) {
  const params = { ...filters };
  if (filters.minScore !== undefined) params.threshold = filters.minScore;
  return params;
}

export default {
  getAnomalyColor,
  getAnomalyBgColor,
  getAnomalyBadgeColor,
  getSeverityLabel,
  formatTime,
  formatDateTime,
  formatRelativeTime,
  formatNumber,
  formatPercent,
  getAnomalyDetails,
  getLogDetails,
  getCrashReportDetails,
  buildDateRange,
  buildAnomalyFilter,
};
