'use client';

import { getAnomalyBadgeColor, getSeverityLabel, getAnomalyColor } from '@/lib/utils';

export function AnomalyScoreBadge({ score, size = 'md', showLabel = false }) {
  const sizes = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2',
  };

  return (
    <div className={`inline-flex items-center gap-2 ${getAnomalyBadgeColor(score)} rounded-full font-semibold ${sizes[size]}`}>
      <span>{Math.round(score)}</span>
      {showLabel && <span className="text-xs opacity-75">{getSeverityLabel(score)}</span>}
    </div>
  );
}

export function AnomalyScoreBar({ score, height = 'h-2', showScore = true }) {
  const colors = {
    low: 'bg-green-500',
    medium: 'bg-yellow-500',
    high: 'bg-orange-500',
    critical: 'bg-red-500',
  };

  const getColor = () => {
    if (score < 25) return colors.low;
    if (score < 50) return colors.medium;
    if (score < 75) return colors.high;
    return colors.critical;
  };

  return (
    <div className="w-full">
      <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${height}`}>
        <div
          className={`${getColor()} h-full transition-all duration-300`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
      {showScore && (
        <p className={`text-xs font-medium mt-1 ${getAnomalyColor(score)}`}>
          Score: {Math.round(score)}/100
        </p>
      )}
    </div>
  );
}

export function AnomalyScoreIndicator({ score, compact = false }) {
  const getSizeClass = () => {
    if (score < 25) return 'ring-green-300 bg-green-50';
    if (score < 50) return 'ring-yellow-300 bg-yellow-50';
    if (score < 75) return 'ring-orange-300 bg-orange-50';
    return 'ring-red-300 bg-red-50';
  };

  return (
    <div className={`flex items-center justify-center rounded-full ring-4 ${getSizeClass()} ${compact ? 'w-12 h-12' : 'w-16 h-16'}`}>
      <div className={compact ? 'text-base font-bold' : 'text-xl font-bold'}>
        {Math.round(score)}
      </div>
    </div>
  );
}

export default { AnomalyScoreBadge, AnomalyScoreBar, AnomalyScoreIndicator };
