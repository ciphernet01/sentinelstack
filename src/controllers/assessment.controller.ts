
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../config/db';
import { Prisma } from '@prisma/client';
import { billingService } from '../services/billing.service';
import { scanQueueService } from '../services/scanQueue.service';
import { encryptScanOptions, hasSensitiveScanOptions, redactScanOptions } from '../services/scanSecrets.service';
import fs from 'fs';
import path from 'path';

const safeUnlinkReportFile = (relativePath: string) => {
  try {
    const reportsDir = path.join(process.cwd(), 'reports');
    const absolute = path.join(process.cwd(), relativePath);

    // Safety: only delete files inside ./reports
    const normalizedReportsDir = path.resolve(reportsDir) + path.sep;
    const normalizedAbsolute = path.resolve(absolute);
    if (!normalizedAbsolute.startsWith(normalizedReportsDir)) return;

    if (fs.existsSync(normalizedAbsolute)) {
      fs.unlinkSync(normalizedAbsolute);
    }
  } catch {
    // Best-effort cleanup only
  }
};

const normalizeToolPreset = (raw: unknown): string => {
  const key = String(raw || 'default').trim().toLowerCase();

  // Canonical presets
  if (key === 'default' || key === 'deep' || key === 'enterprise') return key;

  // Backwards-compatible aliases
  if (key === 'web' || key === 'api' || key === 'auth' || key === 'full') return key;

  // Access control quickscan aliases (what we market in the UI)
  if (key === 'access-control' || key === 'access_control') return 'access-control';
  if (key.includes('access') && key.includes('control')) return 'access-control';
  if (key.includes('idor')) return 'access-control';

  return key;
};

const allowedValues = <T extends string>(values: readonly T[], fallback: T) => {
  const allowed = new Set(values);
  return (raw: unknown): T => {
    const value = String(raw || fallback).trim().toUpperCase() as T;
    return allowed.has(value) ? value : fallback;
  };
};

const normalizeEnvironment = allowedValues(['PRODUCTION', 'STAGING', 'DEVELOPMENT', 'OTHER'] as const, 'PRODUCTION');
const normalizeCriticality = allowedValues(['LOW', 'MODERATE', 'HIGH', 'CRITICAL'] as const, 'MODERATE');
const normalizeClassification = allowedValues(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'REGULATED'] as const, 'INTERNAL');
const normalizeRateLimitProfile = allowedValues(['CONSERVATIVE', 'STANDARD', 'AGGRESSIVE'] as const, 'STANDARD');

const ALLOWED_FRAMEWORKS = new Set(['SOC2', 'ISO27001', 'PCI_DSS', 'HIPAA', 'GDPR', 'NIST_CSF', 'CIS', 'RBI', 'SEBI']);

const cleanString = (raw: unknown, maxLength: number): string | undefined => {
  if (typeof raw !== 'string') return undefined;
  const value = raw.trim();
  if (!value) return undefined;
  return value.slice(0, maxLength);
};

const cleanIsoDate = (raw: unknown): string | undefined => {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const normalizeAssessmentProfile = (raw: unknown) => {
  const profile = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const frameworks = Array.isArray(profile.complianceFrameworks)
    ? Array.from(new Set(
        profile.complianceFrameworks
          .map((value) => String(value || '').trim().toUpperCase())
          .filter((value) => ALLOWED_FRAMEWORKS.has(value)),
      ))
    : [];

  return {
    environment: normalizeEnvironment(profile.environment),
    businessCriticality: normalizeCriticality(profile.businessCriticality),
    dataClassification: normalizeClassification(profile.dataClassification),
    rateLimitProfile: normalizeRateLimitProfile(profile.rateLimitProfile),
    complianceFrameworks: frameworks,
    authorizedBy: cleanString(profile.authorizedBy, 160),
    authorizationTicket: cleanString(profile.authorizationTicket, 160),
    emergencyContact: cleanString(profile.emergencyContact, 200),
    testWindowStart: cleanIsoDate(profile.testWindowStart),
    testWindowEnd: cleanIsoDate(profile.testWindowEnd),
    outOfScope: cleanString(profile.outOfScope, 4000),
  };
};

class AssessmentController {
  
  async createAssessment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    // The 'scope' field drives the real assessment engine.
    // The 'toolPreset' field is required by the database schema.
    const { name, targetUrl, scope, toolPreset, authorizationConfirmed, notes, scanOptions, assessmentProfile } = req.body;
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId;

    if (!userId) {
      return res.status(401).json({ message: 'User not found.' });
    }

    if (!organizationId) {
      return res.status(403).json({ message: 'Organization context missing for this user.' });
    }

    try {
      // Check if organization can perform a scan based on their subscription
      const canScan = await billingService.canPerformScan(organizationId, req.user?.email);
      if (!canScan.allowed) {
        return res.status(402).json({ 
          message: canScan.reason || 'Scan limit reached. Please upgrade your plan.',
          code: 'SCAN_LIMIT_REACHED',
          upgradeUrl: '/pricing'
        });
      }

      const normalizedPreset = normalizeToolPreset(toolPreset);
      const normalizedProfile = normalizeAssessmentProfile(assessmentProfile);
      
      // Validate and sanitize scan options
      const validatedScanOptions: Record<string, unknown> = {};
      if (scanOptions && typeof scanOptions === 'object') {
        // Cookies: string like 'session=abc; token=xyz'
        if (typeof scanOptions.cookies === 'string' && scanOptions.cookies.trim()) {
          validatedScanOptions.cookies = scanOptions.cookies.trim();
        }
        // Headers: object like { "Authorization": "Bearer token" }
        if (scanOptions.headers && typeof scanOptions.headers === 'object') {
          validatedScanOptions.headers = scanOptions.headers;
        }
        // Wordlist: path to custom wordlist
        if (typeof scanOptions.wordlist === 'string' && scanOptions.wordlist.trim()) {
          validatedScanOptions.wordlist = scanOptions.wordlist.trim();
        }
      }

      let encryptedScanOptions: string | undefined;
      try {
        encryptedScanOptions = encryptScanOptions(validatedScanOptions);
      } catch (error) {
        return res.status(400).json({
          message: error instanceof Error ? error.message : 'Unable to secure scan credentials.',
          code: 'SCAN_SECRET_CONFIGURATION_REQUIRED',
        });
      }

      const scannerMetadata = {
        scope,
        preset: normalizedPreset,
        scanOptions: redactScanOptions(validatedScanOptions),
        encryptedScanOptions,
        assessmentProfile: normalizedProfile,
        engagement: {
          authorizationConfirmed: Boolean(authorizationConfirmed),
          authorizationRecordedAt: new Date().toISOString(),
          organizationId,
          requestedByUserId: userId,
          authenticatedScan: hasSensitiveScanOptions(validatedScanOptions),
        },
        capturedAt: new Date().toISOString(),
      };

      const assessment = await prisma.assessment.create({
        data: {
          name,
          targetUrl,
          toolPreset: normalizedPreset,
          authorizationConfirmed,
          notes,
          organizationId,
          userId,
          scannerConfig: scannerMetadata as any,
          // Status defaults to PENDING via schema
        },
      });

      // Increment scan usage for this organization
      await billingService.incrementScanUsage(organizationId);

      // Enqueue scan job (DB-backed) and return immediately.
      await scanQueueService.enqueueForAssessment(assessment.id);

      res.status(201).json(assessment);
    } catch (error) {
      next(error);
    }
  }

  async getAllAssessments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const organizationId = req.user?.organizationId;
    
    if (!userId) {
      return res.status(401).json({ message: 'User not found.' });
    }

    if (userRole !== 'ADMIN' && !organizationId) {
      return res.status(403).json({ message: 'Organization context missing for this user.' });
    }

    // Non-admin users see organization-scoped assessments (team collaboration)
    const whereClause = userRole === 'ADMIN' ? {} : { organizationId };

    try {
      const assessments = await prisma.assessment.findMany({
          where: whereClause,
          include: { report: { select: { id: true } } }, // Include report ID if it exists
          orderBy: { createdAt: 'desc' }
      });
      res.status(200).json(assessments);
    } catch (error) {
      next(error);
    }
  }

  async getAssessmentById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      const { id } = req.params;
      const user = req.user;

      try {
          const assessment = await prisma.assessment.findUnique({
              where: { id },
              select: {
                id: true,
                name: true,
                targetUrl: true,
                toolPreset: true,
                status: true,
                authorizationConfirmed: true,
                notes: true,
                riskScore: true,
                scannerConfig: true,
                endedEarly: true,
                endedEarlyReason: true,
                organizationId: true,
                userId: true,
                createdAt: true,
                updatedAt: true,
                findings: true,
                report: true,
              }
          });

          if (!assessment) {
              return res.status(404).json({ message: 'Assessment not found.' });
          }

          // Authorization check: Admin can see everything. Client can only see their own.
          if (user?.role !== 'ADMIN') {
            if (!user?.organizationId) {
              return res.status(403).json({ message: 'Organization context missing for this user.' });
            }
            if (assessment.organizationId !== user.organizationId) {
              return res.status(403).json({ message: 'Forbidden: You do not have access to this assessment.' });
            }
          }

          res.status(200).json(assessment);
      } catch (error) {
          next(error);
      }
  }

  async updateAssessmentStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status provided.' });
    }

    try {
        const updatedAssessment = await prisma.assessment.update({
            where: { id },
            data: { status }
        });
        res.status(200).json(updatedAssessment);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return res.status(404).json({ message: 'Assessment not found.' });
        }
        next(error);
    }
  }

  async addFindings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      const { id } = req.params;
      const findingsData = req.body; // Expects an array of finding objects

      if (!Array.isArray(findingsData)) {
          return res.status(400).json({ message: 'Request body must be an array of findings.' });
      }

      try {
          // Manually casting to any to satisfy Prisma's complex JsonValue type
          const createManyData = findingsData.map(finding => ({
              ...finding,
              assessmentId: id,
              evidence: finding.evidence as any,
          }));
          
          await prisma.finding.createMany({
              data: createManyData,
              skipDuplicates: true
          });

          res.status(201).json({ message: `${findingsData.length} findings added successfully.` });

      } catch (error) {
          next(error);
      }
  }

  // @route   POST /api/assessments/reset
  // @desc    DEV ONLY: Delete all assessments for the current org (and cascading findings/reports)
  // @access  Private
  async resetAssessmentsForOrg(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const allowDevReset =
        process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_RESET === 'true';

      if (!allowDevReset) {
        return res
          .status(404)
          .json({ message: 'Not found. (Set ENABLE_DEV_RESET=true to enable locally.)' });
      }

      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        return res.status(403).json({ message: 'Organization context missing for this user.' });
      }

      const assessments = await prisma.assessment.findMany({
        where: { organizationId },
        select: {
          id: true,
          report: { select: { filePath: true } },
        },
      });

      for (const a of assessments) {
        const filePath = a.report?.filePath;
        if (filePath) safeUnlinkReportFile(filePath);
      }

      const deleted = await prisma.assessment.deleteMany({ where: { organizationId } });

      return res.status(200).json({ deletedAssessments: deleted.count });
    } catch (error) {
      next(error);
    }
  }
}

export const assessmentController = new AssessmentController();
