import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { cyberRiskQuantificationService } from '../services/cyberRiskQuantification.service';

const DEFAULT_BUDGET_INR = 10_000_000;

const getOrganizationId = (req: AuthenticatedRequest) => {
  if (req.user?.role === 'ADMIN' && typeof req.query.organizationId === 'string') {
    return req.query.organizationId;
  }
  return req.user?.organizationId;
};

class CyberRiskController {
  async getEnterpriseRisk(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = getOrganizationId(req);
      if (!req.user?.id) {
        return res.status(401).json({ message: 'User not found.' });
      }
      if (!organizationId) {
        return res.status(403).json({ message: 'Organization context missing.' });
      }

      const budgetInr = Number.parseInt(String(req.query.budgetInr ?? DEFAULT_BUDGET_INR), 10);
      const risk = await cyberRiskQuantificationService.getEnterpriseRisk(
        organizationId,
        Number.isFinite(budgetInr) && budgetInr > 0 ? budgetInr : DEFAULT_BUDGET_INR,
      );

      res.status(200).json(risk);
    } catch (error) {
      next(error);
    }
  }

  async createSnapshot(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = getOrganizationId(req);
      if (!req.user?.id) {
        return res.status(401).json({ message: 'User not found.' });
      }
      if (!organizationId) {
        return res.status(403).json({ message: 'Organization context missing.' });
      }

      const budgetInr = Number.parseInt(String(req.body?.budgetInr ?? DEFAULT_BUDGET_INR), 10);
      const snapshot = await cyberRiskQuantificationService.persistSnapshot(
        organizationId,
        Number.isFinite(budgetInr) && budgetInr > 0 ? budgetInr : DEFAULT_BUDGET_INR,
      );

      res.status(201).json({
        id: snapshot.id,
        computedAt: snapshot.computedAt,
        expectedAnnualLossInr: Number(snapshot.expectedAnnualLossInr),
        totalFinancialExposureInr: Number(snapshot.totalFinancialExposureInr),
        valueAtRisk95Inr: Number(snapshot.valueAtRisk95Inr),
      });
    } catch (error) {
      next(error);
    }
  }
}

export const cyberRiskController = new CyberRiskController();
