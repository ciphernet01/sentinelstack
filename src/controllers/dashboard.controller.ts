
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
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const last60Days = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
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

      const currentPeriodAssessments = allAssessments.filter(a => new Date(a.createdAt) > last30Days);
      const previousPeriodAssessments = allAssessments.filter(
        a => new Date(a.createdAt) <= last30Days && new Date(a.createdAt) > last60Days
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

      res.status(200).json({
        stats: {
          ...getStatsForPeriod(allAssessments),
          deltas,
        },
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
}

export const dashboardController = new DashboardController();
