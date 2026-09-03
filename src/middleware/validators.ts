import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

export const validateAssessmentCreation = [
    body('name').isString().notEmpty().withMessage('Assessment name is required.'),
    body('targetUrl').isURL().withMessage('A valid target URL is required.'),
    body('scope').isIn(['WEB', 'API', 'AUTH', 'FULL']).withMessage('Invalid scope value.'),
    body('toolPreset').optional().isIn(['default', 'access-control', 'deep', 'enterprise']).withMessage('Invalid tool preset.'),
    body('authorizationConfirmed').isBoolean().custom(value => {
        if (value !== true) {
            throw new Error('Authorization must be confirmed to proceed.');
        }
        return true;
    }),
    body('notes').optional().isString(),
    body('assessmentProfile').optional().isObject().withMessage('Assessment profile must be an object.'),
    body('assessmentProfile.environment').optional().isIn(['PRODUCTION', 'STAGING', 'DEVELOPMENT', 'OTHER']),
    body('assessmentProfile.businessCriticality').optional().isIn(['LOW', 'MODERATE', 'HIGH', 'CRITICAL']),
    body('assessmentProfile.dataClassification').optional().isIn(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'REGULATED']),
    body('assessmentProfile.rateLimitProfile').optional().isIn(['CONSERVATIVE', 'STANDARD', 'AGGRESSIVE']),
    body('assessmentProfile.complianceFrameworks').optional().isArray({ max: 10 }),
    body('assessmentProfile.complianceFrameworks.*').optional().isIn(['SOC2', 'ISO27001', 'PCI_DSS', 'HIPAA', 'GDPR', 'NIST_CSF', 'CIS', 'RBI', 'SEBI']),
    body('assessmentProfile.authorizedBy').optional().isString().isLength({ max: 160 }),
    body('assessmentProfile.authorizationTicket').optional().isString().isLength({ max: 160 }),
    body('assessmentProfile.emergencyContact').optional().isString().isLength({ max: 200 }),
    body('assessmentProfile.testWindowStart').optional({ nullable: true }).isISO8601(),
    body('assessmentProfile.testWindowEnd').optional({ nullable: true }).isISO8601(),
    body('assessmentProfile.outOfScope').optional().isString().isLength({ max: 4000 }),
    body('scanOptions').optional().isObject().withMessage('Scan options must be an object.'),
    body('scanOptions.cookies').optional().isString().isLength({ max: 8000 }),
    body('scanOptions.headers').optional().isObject().withMessage('Custom headers must be an object.'),
    body('scanOptions.wordlist').optional().isString().isLength({ max: 500 }),
    handleValidationErrors,
];
