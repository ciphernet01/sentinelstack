import puppeteer from 'puppeteer';
import { Assessment, User, Finding, Severity } from '@prisma/client';

interface ReportData {
    assessment: Assessment & { user?: User, findings: Finding[] };
    riskScore: number;
    severityCounts: Record<Severity, number>;
}

export const generatePdf = async (htmlContent: string): Promise<Buffer> => {
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'] // Important for running in Docker
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
            top: '20px',
            right: '20px',
            bottom: '20px',
            left: '20px'
        }
    });
    await browser.close();
    return pdf;
};

// This function is no longer used as we are rendering the report page via Next.js
// but we keep it here for reference or potential future use in a different context.
export const getReportTemplate = (data: ReportData): string => {
    const { assessment, riskScore, severityCounts } = data;
    const generationDate = new Date().toLocaleDateString();

    return `
        <!DOCTYPE html>
        <html lang="en">
        <body>
            <h1>This is a placeholder. The actual report is rendered by a Next.js page.</h1>
            <p>Report for: ${assessment.name}</p>
        </body>
        </html>
    `;
};
