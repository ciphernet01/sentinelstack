import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { prisma } from '../config/db';

// Extend Express Request type to include user
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    firebaseId: string;
    email?: string;
    role: 'CLIENT' | 'ADMIN';
    organizationId?: string;
    organizationRole?: 'OWNER' | 'ADMIN' | 'MEMBER';
  };
}

export const firebaseAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization token not found or malformed.' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const firebaseId = decodedToken.uid;

    // Attach firebaseId for routes that might need it (like /init)
    // before the user exists in our DB.
    req.user = {
      id: '', // May not exist yet
      firebaseId: firebaseId,
      role: 'CLIENT', // Default assumption
    };

    const user = await prisma.user.findUnique({
      where: { firebaseId },
      include: {
        memberships: {
          orderBy: { createdAt: 'asc' },
          select: {
            organizationId: true,
            role: true,
          },
        },
      },
    });

    if (user) {
      // If user exists in our DB, overwrite the placeholder with real data
      const desiredOrgId = user.activeOrganizationId || user.memberships?.[0]?.organizationId;
      const activeMembership = desiredOrgId
        ? user.memberships?.find(m => m.organizationId === desiredOrgId) || user.memberships?.[0]
        : undefined;
      req.user = {
        id: user.id,
        firebaseId: user.firebaseId,
        email: user.email,
        role: user.role,
        organizationId: activeMembership?.organizationId,
        organizationRole: activeMembership?.role,
      };
    }
    
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token.', error });
  }
};

export const adminOnly = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // This check now happens *after* firebaseAuth middleware, so req.user is populated
    if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Forbidden: Admin access required.' });
    }
    next();
};

export const requireOrganizationRole = (allowed: Array<'OWNER' | 'ADMIN' | 'MEMBER'>) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'User not found.' });
    }

    // Global admins bypass org-role checks.
    if (req.user.role === 'ADMIN') {
      return next();
    }

    if (!req.user.organizationId || !req.user.organizationRole) {
      return res.status(403).json({ message: 'Organization context missing for this user.' });
    }

    if (!allowed.includes(req.user.organizationRole)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient organization permissions.' });
    }

    next();
  };
};
