import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../config/db';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';
import puppeteer from 'puppeteer';

const buildClientUrlForPuppeteer = (): string => {
    const clientUrlRaw = process.env.CLIENT_URL || 'http://localhost:3000';
    const isDocker = fs.existsSync('/.dockerenv') || process.env.DOCKER === 'true';
    const dockerHostForClient = process.env.DOCKER_HOSTNAME_FOR_CLIENT || 'host.docker.internal';

    let clientUrl = clientUrlRaw.trim();
    try {
        const parsed = new URL(clientUrl);
        const host = parsed.hostname.toLowerCase();
        if (isDocker && (host === 'localhost' || host === '127.0.0.1')) {
            parsed.hostname = dockerHostForClient;
            clientUrl = parsed.toString();
        }
    } catch {
        // If CLIENT_URL isn't a valid URL, keep it as-is and let Puppeteer fail with a clear log.
    }

    return clientUrl.replace(/\/$/, '');
};

const renderAssessmentPdfFromClient = async (assessmentId: string): Promise<Buffer> => {
    const clientUrl = buildClientUrlForPuppeteer();
    const pdfRenderSecret = process.env.PDF_RENDER_SECRET;

    if (!pdfRenderSecret) {
        throw new Error('Server misconfigured: PDF_RENDER_SECRET is not set.');
    }

    const reportUrl = `${clientUrl}/print/report/${assessmentId}`;

    logger.info(`Rendering PDF from URL: ${reportUrl}`);

    const candidatePaths = [
        process.env.PUPPETEER_EXECUTABLE_PATH,
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
    ].filter(Boolean) as string[];

    const executablePath = candidatePaths.find((p) => fs.existsSync(p));

    const browser = await puppeteer.launch({
        headless: true,
        executablePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 794, height: 1123 });
        await page.setExtraHTTPHeaders({ 'x-internal-secret': pdfRenderSecret });

        const response = await page.goto(reportUrl, { waitUntil: 'networkidle0' });
        const status = response?.status();
        if (!status || status >= 400) {
            throw new Error(`Failed to render report page (status=${status ?? 'unknown'}): ${reportUrl}`);
        }
        await page.emulateMediaType('print');
        await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
        await page.addStyleTag({
            content: `
                    :root { color-scheme: light !important; }
                    html, body { background: #ffffff !important; }
                `,
        });

        await page.evaluate(() => {
            const fonts = (document as any).fonts;
            if (fonts?.ready) return fonts.ready;
            return Promise.resolve();
        });

        return await page.pdf({
            format: 'A4',
            landscape: (process.env.PDF_LANDSCAPE ?? 'false') === 'true',
            printBackground: true,
            preferCSSPageSize: true,
            displayHeaderFooter: true,
            headerTemplate: `
                    <div style="width:100%; padding: 0 20px; font-size: 9px; color: #6b7280; display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid #e5e7eb;">
                        <span>Sentinel Stack — Security Assessment Report</span>
                        <span>${new Date().toLocaleDateString()}</span>
                    </div>
                `,
            footerTemplate: `
                    <div style="width:100%; padding: 0 20px; font-size: 9px; color: #6b7280; display:flex; justify-content:space-between; align-items:center; border-top: 1px solid #e5e7eb;">
                        <span>Confidential</span>
                        <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
                    </div>
                `,
            margin: { top: '16mm', right: '14mm', bottom: '16mm', left: '14mm' },
        });
    } finally {
        await browser.close();
    }
};

class ReportController {
  
  async generateReport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const { id } = req.params; // assessmentId
    const user = req.user;
        const reportUrl = `${buildClientUrlForPuppeteer()}/print/report/${id}`;

    try {
      const assessment = await prisma.assessment.findUnique({ where: { id } });
      if (!assessment) {
        return res.status(404).json({ message: 'Assessment not found.' });
      }

            // Authorization check: Admin can access all. Otherwise must be in the same organization.
            if (user?.role !== 'ADMIN') {
                if (!user?.organizationId) {
                    return res.status(403).json({ message: 'Organization context missing for this user.' });
                }
                if (assessment.organizationId !== user.organizationId) {
                    return res.status(403).json({ message: 'Forbidden: You do not have permission to generate this report.' });
                }
            }
      
    logger.info(`Generating PDF for assessment ${id} from URL: ${reportUrl}`);

    const pdfBuffer = await renderAssessmentPdfFromClient(id);
      
      const reportsDir = path.join(process.cwd(), 'reports');
      if (!fs.existsSync(reportsDir)){
          fs.mkdirSync(reportsDir, { recursive: true });
          logger.info(`Created reports directory at: ${reportsDir}`);
      }

      const safeTs = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `assessment-report-${id}-${safeTs}.pdf`;
      const filePath = path.join('reports', fileName); // Store relative path
      fs.writeFileSync(path.join(process.cwd(), filePath), pdfBuffer);
      logger.info(`Report saved to: ${filePath}`);

      // Save report metadata to DB (overwrite if it already exists for this assessment)
      const report = await prisma.report.upsert({
          where: { assessmentId: id },
          update: {
              filePath: filePath,
              storageType: 'LOCAL',
          },
          create: {
              assessmentId: id,
              filePath: filePath,
              storageType: 'LOCAL',
          },
      });

      res.status(201).json({ message: 'Report generated successfully.', report });

    } catch (error) {
      logger.error(`Error generating report for assessment ${id}:`, error);
      next(error);
    }
  }

  async downloadReport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      const { id } = req.params; // This is the report ID
      const user = req.user;

      try {
          const report = await prisma.report.findUnique({
              where: { id },
              include: { assessment: true }
          });

          if (!report) {
              return res.status(404).json({ message: 'Report not found.' });
          }

                    // Authorization check: Admin can access all. Otherwise must be in the same organization.
                    if (user?.role !== 'ADMIN') {
                        if (!user?.organizationId) {
                            return res.status(403).json({ message: 'Organization context missing for this user.' });
                        }
                        if (!report.assessment || report.assessment.organizationId !== user.organizationId) {
                            return res.status(403).json({ message: 'Forbidden: You do not have access to this report.' });
                        }
                    }

          const absoluteFilePath = path.join(process.cwd(), report.filePath);
          
          if (fs.existsSync(absoluteFilePath)) {
              res.setHeader('Content-Type', 'application/pdf');
              res.setHeader('Content-Disposition', `attachment; filename=${path.basename(absoluteFilePath)}`);
              res.sendFile(absoluteFilePath);
          } else {
              // Serverless/container filesystems can be ephemeral (Cloud Run, etc.).
              // Instead of 404ing, regenerate the PDF from the canonical Next.js print route.
              logger.warn(`Report file missing at path: ${absoluteFilePath}. Regenerating on-demand.`);

                            const pdfBuffer = await renderAssessmentPdfFromClient(report.assessmentId);
              res.setHeader('Content-Type', 'application/pdf');
              res.setHeader(
                'Content-Disposition',
                `attachment; filename=sentinel-stack-report-${report.assessmentId}.pdf`
              );
              res.status(200).send(pdfBuffer);
          }

      } catch (error) {
          next(error);
      }
  }
}

export const reportController = new ReportController();
