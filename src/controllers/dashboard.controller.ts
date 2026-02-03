
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../config/db';
import { calculateRiskScore } from '../services/riskScoring.service';
import type { Finding } from '@prisma/client';

const getStatsForPeriod = (assessments: any[]) => {
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let totalRiskScore = 0;
  let scoredAssessmentsCount = 0;
  let totalFindings = 0;

  assessments.forEach(assessment => {
    if (assessment.status === 'COMPLETED' && assessment.findings.length > 0) {
      totalRiskScore += assessment.riskScore ?? 0;
      scoredAssessmentsCount++;
    }

    assessment.findings.forEach((finding: Finding) => {
      totalFindings++;
      switch (finding.severity) {
        case 'CRITICAL':
          criticalCount++;
          break;
        case 'HIGH':
          highCount++;
          break;
        case 'MEDIUM':
          mediumCount++;
          break;
      }
    });
  });

  const overallRiskScore = scoredAssessmentsCount > 0 ? totalRiskScore / scoredAssessmentsCount : 0;

  return {
    totalAssessments: assessments.length,
    criticalCount,
    highCount,
    mediumCount,
    overallRiskScore: Math.round(overallRiskScore),
    totalFindings,
  };
};

const calculateDelta = (current: number, previous: number) => {
  if (previous === 0) {
    return current > 0 ? 100 : 0; // If previous is 0, any increase is "infinite" but we'll show 100%
  }
  return ((current - previous) / previous) * 100;
};

const severityCountsForAssessment = (assessment: { findings: Array<Pick<Finding, 'severity'>> }) => {
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  let infoCount = 0;

  for (const f of assessment.findings ?? []) {
    switch (f.severity) {
      case 'CRITICAL':
        criticalCount++;
        break;
      case 'HIGH':
        highCount++;
        break;
      case 'MEDIUM':
        mediumCount++;
        break;
      case 'LOW':
        lowCount++;
        break;
      case 'INFO':
        infoCount++;
        break;
    }
  }

  return {
    totalFindings: (assessment.findings ?? []).length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    infoCount,
  };
};

const findingKey = (finding: Pick<Finding, 'toolName' | 'title'>) =>
  `${String(finding.toolName).toLowerCase()}::${String(finding.title).toLowerCase()}`;

const severityWeight = (severity: Finding['severity']) => {
  switch (severity) {
    case 'CRITICAL':
      return 5;
    case 'HIGH':
      return 4;
    case 'MEDIUM':
      return 3;
    case 'LOW':
      return 2;
    case 'INFO':
      return 1;
    default:
      return 0;
  }
};

const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
};

const clipText = (value: unknown, maxLen: number) => {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxLen) return normalized;
  const clipped = normalized.slice(0, maxLen);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, Math.max(0, lastSpace)).trim()}…`;
};


class DashboardController {
  
  async getDashboardSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const organizationId = req.user?.organizationId;

    if (!userId) {
      return res.status(401).json({ message: 'User not found.' });
    }

    if (userRole !== 'ADMIN' && !organizationId) {
      return res.status(403).json({ message: 'Organization context missing for this user.' });
    }

    try {
      const whereClause = userRole === 'ADMIN' ? {} : { organizationId };

      const now = new Date();
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const last60Days = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      const oneYearAgo = new Date(now.setFullYear(now.getFullYear() - 1));
      now.setFullYear(now.getFullYear() + 1); // Reset now

      const allAssessments = await prisma.assessment.findMany({
        where: whereClause,
        include: {
          findings: true,
        },
        orderBy: {
            createdAt: 'desc'
        }
      });
      
      const currentPeriodAssessments = allAssessments.filter(a => new Date(a.createdAt) > last30Days);
      const previousPeriodAssessments = allAssessments.filter(a => new Date(a.createdAt) <= last30Days && new Date(a.createdAt) > last60Days);
      
      const currentStats = getStatsForPeriod(currentPeriodAssessments);
      const previousStats = getStatsForPeriod(previousPeriodAssessments);
      
      const deltas = {
          overallRiskScore: calculateDelta(currentStats.overallRiskScore, previousStats.overallRiskScore),
          criticalCount: calculateDelta(currentStats.criticalCount, previousStats.criticalCount),
          highCount: calculateDelta(currentStats.highCount, previousStats.highCount),
          totalAssessments: currentStats.totalAssessments - previousStats.totalAssessments, // This is a raw number change
      };

      // Generate findings over time data
      const findingsForChart = await prisma.finding.findMany({
        where: {
          assessment: {
            ...whereClause,
            createdAt: {
              gte: oneYearAgo,
            },
          },
        },
        select: {
          createdAt: true,
        },
      });

      const monthlyCounts: Record<string, number> = {};
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

      for (let i = 0; i < 12; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthKey = `${monthNames[d.getMonth()]}`;
        monthlyCounts[monthKey] = 0;
      }
      
      findingsForChart.forEach(finding => {
        const month = finding.createdAt.getMonth();
        const monthKey = monthNames[month];
        if(monthlyCounts.hasOwnProperty(monthKey)) {
            monthlyCounts[monthKey]++;
        }
      });
      
      const findingsOverTime = Object.entries(monthlyCounts)
        .map(([name, total]) => ({ name, total }))
         // This assumes we want the chart to display months in chronological order leading to current month
        .sort((a,b) => {
            const aIndex = monthNames.indexOf(a.name);
            const bIndex = monthNames.indexOf(b.name);
            const currentMonth = new Date().getMonth();

            // Adjust index to be relative to the current month for correct sorting
            const aSort = (aIndex - currentMonth -1 + 12) % 12;
            const bSort = (bIndex - currentMonth - 1 + 12) % 12;

            return bSort - aSort;
        });


      const recentAssessments = allAssessments.slice(0, 5);

      res.status(200).json({
        stats: {
          ...getStatsForPeriod(allAssessments),
          deltas
        },
        recentAssessments,
        findingsOverTime
      });

    } catch (error) {
      next(error);
    }
  }

  async getRiskAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const organizationId = req.user?.organizationId;
    
    // Date range filter (default 30 days for deltas, configurable)
    const daysParam = parseInt(req.query.days as string, 10);
    const filterDays = !isNaN(daysParam) && daysParam > 0 ? daysParam : 30;

    if (!userId) {
      return res.status(401).json({ message: 'User not found.' });
    }

    if (userRole !== 'ADMIN' && !organizationId) {
      return res.status(403).json({ message: 'Organization context missing for this user.' });
    }

    try {
      const whereClause = userRole === 'ADMIN' ? {} : { organizationId };

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = (d: Date) => `${monthNames[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;

      const last12Months = (() => {
        const months: { key: string; label: string }[] = [];
        const cursor = new Date();
        cursor.setDate(1);
        cursor.setHours(0, 0, 0, 0);

        for (let i = 11; i >= 0; i--) {
          const d = new Date(cursor);
          d.setMonth(d.getMonth() - i);
          months.push({ key: monthKey(d), label: monthLabel(d) });
        }

        return months;
      })();

      const now = new Date();
      const currentPeriodStart = new Date(now.getTime() - filterDays * 24 * 60 * 60 * 1000);
      const previousPeriodStart = new Date(now.getTime() - (filterDays * 2) * 24 * 60 * 60 * 1000);
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const allAssessments = await prisma.assessment.findMany({
        where: whereClause,
        include: {
          findings: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      const currentPeriodAssessments = allAssessments.filter(a => new Date(a.createdAt) > currentPeriodStart);
      const previousPeriodAssessments = allAssessments.filter(
        a => new Date(a.createdAt) <= currentPeriodStart && new Date(a.createdAt) > previousPeriodStart
      );

      const currentStats = getStatsForPeriod(currentPeriodAssessments);
      const previousStats = getStatsForPeriod(previousPeriodAssessments);

      const deltas = {
        overallRiskScore: calculateDelta(currentStats.overallRiskScore, previousStats.overallRiskScore),
        criticalCount: calculateDelta(currentStats.criticalCount, previousStats.criticalCount),
        highCount: calculateDelta(currentStats.highCount, previousStats.highCount),
        totalAssessments: currentStats.totalAssessments - previousStats.totalAssessments,
      };

      // Severity distribution across all findings (scoped by user/admin)
      const severityGroup = await prisma.finding.groupBy({
        by: ['severity'],
        where: {
          assessment: {
            ...whereClause,
          },
        },
        _count: {
          severity: true,
        },
      });

      const severityDistribution = {
        CRITICAL: 0,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0,
        INFO: 0,
      } as Record<string, number>;

      for (const row of severityGroup) {
        severityDistribution[row.severity] = row._count.severity;
      }

      // Risk score trend (avg risk score per month for last 12 months)
      const scoreAssessments = await prisma.assessment.findMany({
        where: {
          ...whereClause,
          status: 'COMPLETED',
          riskScore: { not: null },
          createdAt: {
            gte: oneYearAgo,
          },
        },
        select: {
          createdAt: true,
          riskScore: true,
        },
      });

      const scoreBuckets = new Map<string, { sum: number; count: number }>();
      last12Months.forEach(m => scoreBuckets.set(m.key, { sum: 0, count: 0 }));
      for (const a of scoreAssessments) {
        const k = monthKey(a.createdAt);
        const bucket = scoreBuckets.get(k);
        if (!bucket) continue;
        bucket.sum += a.riskScore ?? 0;
        bucket.count += 1;
      }

      const riskScoreOverTime = last12Months.map(m => {
        const b = scoreBuckets.get(m.key)!;
        return {
          name: m.label,
          avgRiskScore: b.count > 0 ? Math.round(b.sum / b.count) : 0,
        };
      });

      // Findings over time + severity over time
      const findingsForChart = await prisma.finding.findMany({
        where: {
          assessment: {
            ...whereClause,
            createdAt: {
              gte: oneYearAgo,
            },
          },
        },
        select: {
          createdAt: true,
          severity: true,
        },
      });

      const findingsBuckets = new Map<string, number>();
      last12Months.forEach(m => findingsBuckets.set(m.key, 0));

      const severityBuckets = new Map<
        string,
        { CRITICAL: number; HIGH: number; MEDIUM: number; LOW: number; INFO: number }
      >();
      last12Months.forEach(m => severityBuckets.set(m.key, { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 }));

      findingsForChart.forEach(finding => {
        const k = monthKey(finding.createdAt);
        if (!findingsBuckets.has(k)) return;
        findingsBuckets.set(k, (findingsBuckets.get(k) ?? 0) + 1);

        const sb = severityBuckets.get(k);
        if (!sb) return;
        // finding.severity is a Prisma enum; it will be one of our keys.
        sb[finding.severity] += 1;
      });

      const findingsOverTime = last12Months.map(m => ({
        name: m.label,
        total: findingsBuckets.get(m.key) ?? 0,
      }));

      const severityOverTime = last12Months.map(m => {
        const sb = severityBuckets.get(m.key) ?? { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
        return {
          name: m.label,
          ...sb,
        };
      });

      // Top tools by findings count, plus severity breakdown
      const topToolTotals = await prisma.finding.groupBy({
        by: ['toolName'],
        where: {
          assessment: {
            ...whereClause,
          },
        },
        _count: { toolName: true },
        orderBy: { _count: { toolName: 'desc' } },
        take: 8,
      });

      const toolSeverityCounts = await prisma.finding.groupBy({
        by: ['toolName', 'severity'],
        where: {
          assessment: {
            ...whereClause,
          },
        },
        _count: { toolName: true },
      });

      const toolMap = new Map<string, { toolName: string; total: number; CRITICAL: number; HIGH: number; MEDIUM: number }>();
      for (const t of topToolTotals) {
        toolMap.set(t.toolName, { toolName: t.toolName, total: t._count.toolName, CRITICAL: 0, HIGH: 0, MEDIUM: 0 });
      }
      for (const row of toolSeverityCounts) {
        const entry = toolMap.get(row.toolName);
        if (!entry) continue;
        if (row.severity === 'CRITICAL') entry.CRITICAL = row._count.toolName;
        if (row.severity === 'HIGH') entry.HIGH = row._count.toolName;
        if (row.severity === 'MEDIUM') entry.MEDIUM = row._count.toolName;
      }
      const topTools = Array.from(toolMap.values());

      // Top targets by avg risk score
      const topTargetsGroup = await prisma.assessment.groupBy({
        by: ['targetUrl'],
        where: {
          ...whereClause,
          status: 'COMPLETED',
          riskScore: { not: null },
        },
        _avg: { riskScore: true },
        _count: { targetUrl: true },
        orderBy: { _avg: { riskScore: 'desc' } },
        take: 6,
      });

      const topTargets = topTargetsGroup.map(t => ({
        targetUrl: t.targetUrl,
        avgRiskScore: Math.round(t._avg.riskScore ?? 0),
        assessments: t._count.targetUrl,
      }));

      const recentHighRiskAssessmentsRaw = await prisma.assessment.findMany({
        where: {
          ...whereClause,
          status: 'COMPLETED',
          riskScore: { not: null },
        },
        select: {
          id: true,
          name: true,
          targetUrl: true,
          riskScore: true,
          createdAt: true,
          findings: {
            select: {
              severity: true,
            },
          },
        },
        orderBy: [{ riskScore: 'desc' }, { createdAt: 'desc' }],
        take: 8,
      });

      const recentHighRiskAssessments = recentHighRiskAssessmentsRaw.map(a => {
        let criticalCount = 0;
        let highCount = 0;
        let mediumCount = 0;
        let lowCount = 0;
        let infoCount = 0;

        for (const f of a.findings) {
          switch (f.severity) {
            case 'CRITICAL':
              criticalCount++;
              break;
            case 'HIGH':
              highCount++;
              break;
            case 'MEDIUM':
              mediumCount++;
              break;
            case 'LOW':
              lowCount++;
              break;
            case 'INFO':
              infoCount++;
              break;
          }
        }

        return {
          id: a.id,
          name: a.name,
          targetUrl: a.targetUrl,
          riskScore: a.riskScore ?? 0,
          createdAt: a.createdAt,
          totalFindings: a.findings.length,
          criticalCount,
          highCount,
          mediumCount,
          lowCount,
          infoCount,
        };
      });

      const completedAssessments = allAssessments
        .filter(a => a.status === 'COMPLETED')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const latest = completedAssessments[0];
      const previous = completedAssessments[1];

      const latestAssessmentComparison = (() => {
        if (!latest) return null;

        const latestCounts = severityCountsForAssessment(latest);
        const prevCounts = previous ? severityCountsForAssessment(previous) : null;

        const latestRiskScore = latest.riskScore ?? 0;
        const prevRiskScore = previous?.riskScore ?? 0;

        const delta = {
          riskScore: Math.round(latestRiskScore - prevRiskScore),
          totalFindings: latestCounts.totalFindings - (prevCounts?.totalFindings ?? 0),
          criticalCount: latestCounts.criticalCount - (prevCounts?.criticalCount ?? 0),
          highCount: latestCounts.highCount - (prevCounts?.highCount ?? 0),
          mediumCount: latestCounts.mediumCount - (prevCounts?.mediumCount ?? 0),
          lowCount: latestCounts.lowCount - (prevCounts?.lowCount ?? 0),
          infoCount: latestCounts.infoCount - (prevCounts?.infoCount ?? 0),
        };

        const topNewFindings = (() => {
          if (!previous) return [];
          const prevSet = new Set(previous.findings.map(f => findingKey(f)));
          const newOnes = latest.findings
            .filter(f => !prevSet.has(findingKey(f)))
            .sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity))
            .slice(0, 6)
            .map(f => ({
              toolName: f.toolName,
              title: f.title,
              severity: f.severity,
            }));
          return newOnes;
        })();

        const topResolvedFindings = (() => {
          if (!previous) return [];
          const latestSet = new Set(latest.findings.map(f => findingKey(f)));
          const resolved = previous.findings
            .filter(f => !latestSet.has(findingKey(f)))
            .sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity))
            .slice(0, 6)
            .map(f => ({
              toolName: f.toolName,
              title: f.title,
              severity: f.severity,
            }));
          return resolved;
        })();

        const regressions = (() => {
          if (!previous) return null;
          const prevSet = new Set(previous.findings.map(f => findingKey(f)));
          const newSevere = latest.findings
            .filter((f) => !prevSet.has(findingKey(f)))
            .filter((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH');

          const critical = newSevere.filter((f) => f.severity === 'CRITICAL');
          const high = newSevere.filter((f) => f.severity === 'HIGH');

          const top = [...newSevere]
            .sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity))
            .slice(0, 6)
            .map((f) => ({
              toolName: f.toolName,
              title: f.title,
              severity: f.severity,
            }));

          return {
            newCriticalCount: critical.length,
            newHighCount: high.length,
            topNewSevereFindings: top,
          };
        })();

        return {
          latest: {
            id: latest.id,
            name: latest.name,
            targetUrl: latest.targetUrl,
            createdAt: latest.createdAt,
            riskScore: latestRiskScore,
            ...latestCounts,
          },
          previous: previous
            ? {
                id: previous.id,
                name: previous.name,
                targetUrl: previous.targetUrl,
                createdAt: previous.createdAt,
                riskScore: prevRiskScore,
                ...(prevCounts ?? severityCountsForAssessment(previous)),
              }
            : null,
          delta,
          topNewFindings,
          topResolvedFindings,
          regressions,
        };
      })();

      // Remediation plan (top recurring/high-severity issues last 90 days)
      const remediationPlan = (() => {
        const since = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        const relevant = allAssessments
          .filter(a => a.status === 'COMPLETED' && new Date(a.createdAt) >= since)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const map = new Map<
          string,
          {
            toolName: string;
            title: string;
            severity: Finding['severity'];
            occurrencesLast90d: number;
            lastSeenAt: Date;
            lastSeenAssessmentId: string;
            remediationPreview: string;
          }
        >();

        for (const assessment of relevant) {
          for (const f of assessment.findings ?? []) {
            const key = findingKey(f);
            const existing = map.get(key);
            if (!existing) {
              map.set(key, {
                toolName: f.toolName,
                title: f.title,
                severity: f.severity,
                occurrencesLast90d: 1,
                lastSeenAt: assessment.createdAt as any,
                lastSeenAssessmentId: assessment.id,
                remediationPreview: clipText((f as any).remediation, 180),
              });
              continue;
            }

            existing.occurrencesLast90d += 1;
            if (severityWeight(f.severity) > severityWeight(existing.severity)) {
              existing.severity = f.severity;
            }
            const createdAt = new Date(assessment.createdAt);
            if (createdAt.getTime() > new Date(existing.lastSeenAt).getTime()) {
              existing.lastSeenAt = createdAt;
              existing.lastSeenAssessmentId = assessment.id;
              if (!existing.remediationPreview) {
                existing.remediationPreview = clipText((f as any).remediation, 180);
              }
            }
          }
        }

        const scored = Array.from(map.values()).sort((a, b) => {
          const aScore = severityWeight(a.severity) * 1000 + a.occurrencesLast90d;
          const bScore = severityWeight(b.severity) * 1000 + b.occurrencesLast90d;
          if (bScore !== aScore) return bScore - aScore;
          return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
        });

        return scored.slice(0, 6).map((x) => ({
          toolName: x.toolName,
          title: x.title,
          severity: x.severity,
          occurrencesLast90d: x.occurrencesLast90d,
          lastSeenAt: x.lastSeenAt,
          lastSeenAssessmentId: x.lastSeenAssessmentId,
          remediationPreview: x.remediationPreview,
        }));
      })();

      // Coverage gaps (stale targets / never-completed targets)
      const coverageGaps = (() => {
        const staleThresholdDays = 14;
        const byTarget = new Map<
          string,
          {
            lastAny?: { id: string; createdAt: Date; status: string };
            lastCompleted?: { id: string; createdAt: Date; riskScore: number | null };
          }
        >();

        for (const a of allAssessments) {
          const targetUrl = a.targetUrl;
          const entry = byTarget.get(targetUrl) ?? {};
          const createdAt = new Date(a.createdAt);

          if (!entry.lastAny || createdAt.getTime() > entry.lastAny.createdAt.getTime()) {
            entry.lastAny = { id: a.id, createdAt, status: a.status };
          }

          if (a.status === 'COMPLETED') {
            if (!entry.lastCompleted || createdAt.getTime() > entry.lastCompleted.createdAt.getTime()) {
              entry.lastCompleted = { id: a.id, createdAt, riskScore: a.riskScore ?? null };
            }
          }

          byTarget.set(targetUrl, entry);
        }

        const staleTargets: Array<{
          targetUrl: string;
          daysSinceLastCompleted: number;
          lastCompletedAt: Date;
          lastAssessmentId: string;
          lastRiskScore: number | null;
        }> = [];

        const neverCompletedTargets: Array<{
          targetUrl: string;
          lastAttemptAt: Date;
          lastAssessmentId: string;
          lastAttemptStatus: string;
        }> = [];

        for (const [targetUrl, entry] of byTarget.entries()) {
          if (entry.lastCompleted) {
            const daysSince = Math.floor((now.getTime() - entry.lastCompleted.createdAt.getTime()) / (24 * 60 * 60 * 1000));
            if (daysSince > staleThresholdDays) {
              staleTargets.push({
                targetUrl,
                daysSinceLastCompleted: daysSince,
                lastCompletedAt: entry.lastCompleted.createdAt,
                lastAssessmentId: entry.lastCompleted.id,
                lastRiskScore: entry.lastCompleted.riskScore,
              });
            }
          } else if (entry.lastAny) {
            neverCompletedTargets.push({
              targetUrl,
              lastAttemptAt: entry.lastAny.createdAt,
              lastAssessmentId: entry.lastAny.id,
              lastAttemptStatus: entry.lastAny.status,
            });
          }
        }

        staleTargets.sort((a, b) => b.daysSinceLastCompleted - a.daysSinceLastCompleted);
        neverCompletedTargets.sort((a, b) => b.lastAttemptAt.getTime() - a.lastAttemptAt.getTime());

        return {
          staleThresholdDays,
          staleTargets: staleTargets.slice(0, 8),
          neverCompletedTargets: neverCompletedTargets.slice(0, 6),
        };
      })();

      // MTTR / Resolution velocity (approximation from assessment-to-assessment presence)
      const mttr = (() => {
        if (completedAssessments.length < 2) return null;

        const since = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        const timeline = completedAssessments
          .filter(a => new Date(a.createdAt) >= since)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        if (timeline.length < 2) return null;

        const latestInWindow = timeline[timeline.length - 1];
        const latestKeys = new Set((latestInWindow.findings ?? []).map((f) => findingKey(f)));

        type RecordRow = {
          toolName: string;
          title: string;
          maxSeverity: Finding['severity'];
          firstSeenAt: Date;
          lastSeenAt: Date;
          lastSeenAssessmentId: string;
        };

        const byKey = new Map<string, RecordRow>();

        for (const a of timeline) {
          const createdAt = new Date(a.createdAt);
          for (const f of a.findings ?? []) {
            const key = findingKey(f);
            const existing = byKey.get(key);
            if (!existing) {
              byKey.set(key, {
                toolName: f.toolName,
                title: f.title,
                maxSeverity: f.severity,
                firstSeenAt: createdAt,
                lastSeenAt: createdAt,
                lastSeenAssessmentId: a.id,
              });
              continue;
            }

            existing.lastSeenAt = createdAt;
            existing.lastSeenAssessmentId = a.id;
            if (severityWeight(f.severity) > severityWeight(existing.maxSeverity)) {
              existing.maxSeverity = f.severity;
            }
          }
        }

        const perSeverity = new Map<
          Finding['severity'],
          {
            resolvedDurationsDays: number[];
            openAgesDays: number[];
          }
        >();

        const ensure = (sev: Finding['severity']) => {
          const existing = perSeverity.get(sev);
          if (existing) return existing;
          const created = { resolvedDurationsDays: [], openAgesDays: [] };
          perSeverity.set(sev, created);
          return created;
        };

        for (const [key, row] of byKey.entries()) {
          const bucket = ensure(row.maxSeverity);
          const first = new Date(row.firstSeenAt).getTime();
          const last = new Date(row.lastSeenAt).getTime();

          if (latestKeys.has(key)) {
            const ageDays = (now.getTime() - first) / (24 * 60 * 60 * 1000);
            bucket.openAgesDays.push(ageDays);
          } else {
            const durationDays = (last - first) / (24 * 60 * 60 * 1000);
            bucket.resolvedDurationsDays.push(durationDays);
          }
        }

        const severities: Finding['severity'][] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
        const bySeverityRows = severities
          .map((severity) => {
            const bucket = perSeverity.get(severity) ?? { resolvedDurationsDays: [], openAgesDays: [] };
            const resolved = bucket.resolvedDurationsDays;
            const open = bucket.openAgesDays;

            const avg = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

            return {
              severity,
              resolvedCount: resolved.length,
              openCount: open.length,
              avgResolvedDays: Math.round(avg(resolved) * 10) / 10,
              medianResolvedDays: Math.round(median(resolved) * 10) / 10,
              avgOpenAgeDays: Math.round(avg(open) * 10) / 10,
            };
          })
          .filter((r) => r.resolvedCount > 0 || r.openCount > 0);

        return {
          windowDays: 180,
          latestAssessmentId: latestInWindow.id,
          bySeverity: bySeverityRows,
        };
      })();

      res.status(200).json({
        stats: {
          ...getStatsForPeriod(allAssessments),
          deltas,
        },
        latestAssessmentComparison,
        remediationPlan,
        coverageGaps,
        mttr,
        findingsOverTime,
        severityOverTime,
        riskScoreOverTime,
        severityDistribution,
        topTools,
        topTargets,
        recentHighRiskAssessments,
      });
    } catch (error) {
      next(error);
    }
  }

  async getTargetAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const organizationId = req.user?.organizationId;

    if (!userId) {
      return res.status(401).json({ message: 'User not found.' });
    }

    if (userRole !== 'ADMIN' && !organizationId) {
      return res.status(403).json({ message: 'Organization context missing for this user.' });
    }

    const rawTarget = (req.query.targetUrl ?? req.query.target) as string | undefined;
    const targetUrl = String(rawTarget ?? '').trim();
    if (!targetUrl) {
      return res.status(400).json({ message: 'Missing required query param: targetUrl' });
    }

    try {
      const whereClause = userRole === 'ADMIN' ? {} : { organizationId };
      const now = new Date();
      const staleThresholdDays = 14;

      const allForTarget = await prisma.assessment.findMany({
        where: {
          ...whereClause,
          targetUrl,
        },
        include: {
          findings: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      const latestAttempt = allForTarget[0] ?? null;
      const completed = allForTarget
        .filter(a => a.status === 'COMPLETED')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const latestCompleted = completed[0] ?? null;
      const daysSinceLastCompleted = latestCompleted
        ? Math.floor((now.getTime() - new Date(latestCompleted.createdAt).getTime()) / (24 * 60 * 60 * 1000))
        : null;

      const riskTimeline = completed
        .slice(0, 12)
        .reverse()
        .map(a => {
          const counts = severityCountsForAssessment(a);
          return {
            id: a.id,
            name: a.name,
            createdAt: a.createdAt,
            riskScore: a.riskScore ?? 0,
            ...counts,
          };
        });

      const recurringFindings = (() => {
        const since = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        const inWindow = completed.filter(a => new Date(a.createdAt) >= since);

        const map = new Map<
          string,
          {
            toolName: string;
            title: string;
            maxSeverity: Finding['severity'];
            occurrences: number;
            lastSeenAt: Date;
            lastAssessmentId: string;
            remediationPreview: string;
          }
        >();

        for (const a of inWindow) {
          const createdAt = new Date(a.createdAt);
          for (const f of a.findings ?? []) {
            const key = findingKey(f);
            const existing = map.get(key);
            if (!existing) {
              map.set(key, {
                toolName: f.toolName,
                title: f.title,
                maxSeverity: f.severity,
                occurrences: 1,
                lastSeenAt: createdAt,
                lastAssessmentId: a.id,
                remediationPreview: clipText((f as any).remediation, 180),
              });
              continue;
            }

            existing.occurrences += 1;
            if (severityWeight(f.severity) > severityWeight(existing.maxSeverity)) {
              existing.maxSeverity = f.severity;
            }
            if (createdAt.getTime() > existing.lastSeenAt.getTime()) {
              existing.lastSeenAt = createdAt;
              existing.lastAssessmentId = a.id;
              if (!existing.remediationPreview) {
                existing.remediationPreview = clipText((f as any).remediation, 180);
              }
            }
          }
        }

        return Array.from(map.values())
          .sort((a, b) => {
            const aScore = severityWeight(a.maxSeverity) * 1000 + a.occurrences;
            const bScore = severityWeight(b.maxSeverity) * 1000 + b.occurrences;
            if (bScore !== aScore) return bScore - aScore;
            return b.lastSeenAt.getTime() - a.lastSeenAt.getTime();
          })
          .slice(0, 12)
          .map(r => ({
            toolName: r.toolName,
            title: r.title,
            severity: r.maxSeverity,
            occurrencesLast180d: r.occurrences,
            lastSeenAt: r.lastSeenAt,
            lastSeenAssessmentId: r.lastAssessmentId,
            remediationPreview: r.remediationPreview,
          }));
      })();

      res.status(200).json({
        targetUrl,
        staleThresholdDays,
        latestAttempt: latestAttempt
          ? {
              id: latestAttempt.id,
              status: latestAttempt.status,
              createdAt: latestAttempt.createdAt,
            }
          : null,
        latestCompleted: latestCompleted
          ? {
              id: latestCompleted.id,
              createdAt: latestCompleted.createdAt,
              riskScore: latestCompleted.riskScore ?? null,
            }
          : null,
        daysSinceLastCompleted,
        isStale: typeof daysSinceLastCompleted === 'number' ? daysSinceLastCompleted > staleThresholdDays : true,
        riskTimeline,
        recurringFindings,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const dashboardController = new DashboardController();
