import { Router, Response, NextFunction } from 'express';
import { apiKeyAuth, requireScope, ApiKeyRequest } from '../middleware/api-key';
import { prisma } from '../config/db';
import { scanQueueService } from '../services/scanQueue.service';

const router = Router();

// All public API routes require API key authentication
router.use(apiKeyAuth);

// GET /api/v1/assessments - List assessments
router.get('/assessments', requireScope('READ_ASSESSMENTS'), async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.apiKey!;
    const { status, limit = '50', offset = '0' } = req.query;
    
    const where: any = { organizationId };
    if (status) {
      where.status = status;
    }
    
    const assessments = await prisma.assessment.findMany({
      where,
      take: Math.min(parseInt(limit as string) || 50, 100),
      skip: parseInt(offset as string) || 0,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        targetUrl: true,
        status: true,
        toolPreset: true,
        riskScore: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    const total = await prisma.assessment.count({ where });
    
    res.json({
      data: assessments,
      pagination: {
        total,
        limit: Math.min(parseInt(limit as string) || 50, 100),
        offset: parseInt(offset as string) || 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/assessments/:id - Get assessment details
router.get('/assessments/:id', requireScope('READ_ASSESSMENTS'), async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.apiKey!;
    
    const assessment = await prisma.assessment.findFirst({
      where: { id, organizationId },
      include: {
        findings: {
          select: {
            id: true,
            title: true,
            severity: true,
            toolName: true,
            description: true,
            remediation: true,
            createdAt: true,
          },
        },
      },
    });
    
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }
    
    res.json({ data: assessment });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/assessments - Create new assessment (start scan)
router.post('/assessments', requireScope('WRITE_ASSESSMENTS'), async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
  try {
    const { organizationId, userId } = req.apiKey!;
    const { name, targetUrl, toolPreset = 'basic' } = req.body;
    
    if (!name || !targetUrl) {
      return res.status(400).json({ error: 'name and targetUrl are required' });
    }
    
    // Validate URL
    try {
      new URL(targetUrl);
    } catch {
      return res.status(400).json({ error: 'Invalid targetUrl' });
    }
    
    // Create assessment
    const assessment = await prisma.assessment.create({
      data: {
        name,
        targetUrl,
        toolPreset,
        authorizationConfirmed: true,
        status: 'PENDING',
        organizationId,
        userId,
        scannerConfig: {
          scope: 'WEB',
          scanOptions: {},
          capturedAt: new Date().toISOString(),
        } as any,
      },
      select: {
        id: true,
        name: true,
        targetUrl: true,
        status: true,
        toolPreset: true,
        createdAt: true,
      },
    });

    await scanQueueService.enqueueForAssessment(assessment.id);
    
    res.status(201).json({ 
      data: assessment,
      message: 'Assessment created. Use the queue endpoint or webhook to track progress.',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/reports - List reports
router.get('/reports', requireScope('READ_REPORTS'), async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.apiKey!;
    const { limit = '50', offset = '0' } = req.query;
    
    // Reports are linked through assessments
    const reports = await prisma.report.findMany({
      where: {
        assessment: { organizationId },
      },
      take: Math.min(parseInt(limit as string) || 50, 100),
      skip: parseInt(offset as string) || 0,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        filePath: true,
        storageType: true,
        createdAt: true,
        assessment: {
          select: {
            id: true,
            name: true,
            targetUrl: true,
          },
        },
      },
    });
    
    const total = await prisma.report.count({
      where: {
        assessment: { organizationId },
      },
    });
    
    res.json({
      data: reports,
      pagination: {
        total,
        limit: Math.min(parseInt(limit as string) || 50, 100),
        offset: parseInt(offset as string) || 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/reports/:id - Get report details
router.get('/reports/:id', requireScope('READ_REPORTS'), async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.apiKey!;
    
    const report = await prisma.report.findFirst({
      where: {
        id,
        assessment: { organizationId },
      },
      include: {
        assessment: {
          select: {
            id: true,
            name: true,
            targetUrl: true,
            status: true,
            riskScore: true,
          },
        },
      },
    });
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    res.json({ data: report });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/webhooks - List webhooks
router.get('/webhooks', requireScope('READ_WEBHOOKS'), async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.apiKey!;
    
    const webhooks = await prisma.webhook.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        enabled: true,
        createdAt: true,
      },
    });
    
    res.json({ data: webhooks });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/webhooks - Create webhook
router.post('/webhooks', requireScope('WRITE_WEBHOOKS'), async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
  try {
    const { organizationId, userId } = req.apiKey!;
    const { name, url, events, secret } = req.body;
    
    if (!name || !url || !events) {
      return res.status(400).json({ error: 'name, url, and events are required' });
    }
    
    const webhook = await prisma.webhook.create({
      data: {
        name,
        url,
        events,
        secret: secret || require('crypto').randomBytes(32).toString('hex'),
        organizationId,
        createdById: userId,
      },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        enabled: true,
        createdAt: true,
      },
    });
    
    res.status(201).json({ data: webhook });
  } catch (error) {
    next(error);
  }
});

// API Info endpoint
router.get('/', (req: ApiKeyRequest, res: Response) => {
  res.json({
    name: 'SentinelStack Public API',
    version: '1.0.0',
    documentation: 'https://docs.sentinel-stack.tech/api',
    endpoints: {
      assessments: {
        list: 'GET /api/v1/assessments',
        get: 'GET /api/v1/assessments/:id',
        create: 'POST /api/v1/assessments',
      },
      reports: {
        list: 'GET /api/v1/reports',
        get: 'GET /api/v1/reports/:id',
      },
      webhooks: {
        list: 'GET /api/v1/webhooks',
        create: 'POST /api/v1/webhooks',
      },
    },
    scopes: req.apiKey?.scopes || [],
  });
});

export default router;
