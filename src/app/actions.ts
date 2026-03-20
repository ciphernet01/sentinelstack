"use server";

import { summarizeFindings } from "@/ai/flows/summarize-findings-with-ai";
import { translateTechnicalRiskToBusinessLanguage } from "@/ai/flows/translate-technical-risk-to-business-language";
import { generateReportSummary } from "@/ai/flows/ai-powered-report-summarization";

export async function getAiSummaryAction(findings: string) {
  try {
    const result = await summarizeFindings({ findings });
    return { success: true, summary: result.summary };
  } catch (error) {
    console.error("AI Summary Error:", error);
    return { success: false, error: "Failed to generate AI summary." };
  }
}

export async function getBusinessImpactAction(technicalRisk: string) {
    try {
        const result = await translateTechnicalRiskToBusinessLanguage(technicalRisk);
        return { success: true, businessImpact: result };
    } catch (error) {
        console.error("Business Impact Translation Error:", error);
        return { success: false, error: "Failed to translate technical risk." };
    }
}

export async function getReportSummaryAction(technicalFindings: string) {
    try {
        const result = await generateReportSummary({ technicalFindings });
        return { success: true, ...result };
    } catch (error) {
        console.error("Report Summary Generation Error:", error);
        return { success: false, error: "Failed to generate report summary." };
    }
}
