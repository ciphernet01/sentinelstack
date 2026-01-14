import { Finding } from '@prisma/client';

const severityWeights = {
  CRITICAL: 5,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  INFO: 0,
};

/**
 * Calculates a deterministic risk score (0-100) for an assessment based on its findings.
 * @param findings - An array of findings for the assessment.
 * @returns A numeric risk score.
 */
export const calculateRiskScore = (findings: Finding[]): number => {
  if (!findings || findings.length === 0) {
    return 0;
  }

  let weightedSum = 0;
  let maxWeight = 0;

  findings.forEach(finding => {
    const weight = severityWeights[finding.severity];
    weightedSum += weight;
    maxWeight += severityWeights.CRITICAL; // Max possible score is all critical
  });
  
  if (maxWeight === 0) return 0;
  
  // Normalize the score to be out of 100
  const score = (weightedSum / maxWeight) * 100;
  
  return Math.min(100, Math.round(score)); // Cap at 100 and round
};


/**
 * Gets a count of findings for each severity level.
 * @param findings - An array of findings.
 * @returns An object with counts for each severity.
 */
export const getSeverityCounts = (findings: Finding[]) => {
    const counts = {
        CRITICAL: 0,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0,
        INFO: 0
    };

    findings.forEach(finding => {
        if (finding.severity in counts) {
            counts[finding.severity]++;
        }
    });

    return counts;
}
