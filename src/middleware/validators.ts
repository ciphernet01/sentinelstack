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
    body('authorizationConfirmed').isBoolean().custom(value => {
        if (value !== true) {
            throw new Error('Authorization must be confirmed to proceed.');
        }
        return true;
    }),
    body('notes').optional().isString(),
    handleValidationErrors,
];
