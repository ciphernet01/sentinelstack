
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../config/db';
import * as admin from 'firebase-admin';
import { emailService } from '../services/email.service';
import { generateTokenWithExpiry, PasswordValidator } from '../utils/password';

const parsePersona = (raw: unknown): 'SECURITY_ANALYST' | 'COMPLIANCE_MANAGER' | 'EXECUTIVE' | 'ADMINISTRATOR' | null => {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  switch (v) {
    case 'security_analyst':
    case 'security-analyst':
    case 'security analyst':
      return 'SECURITY_ANALYST';
    case 'compliance_manager':
    case 'compliance-manager':
    case 'compliance manager':
      return 'COMPLIANCE_MANAGER';
    case 'executive':
      return 'EXECUTIVE';
    case 'administrator':
    case 'admin':
      return 'ADMINISTRATOR';
    default:
      return null;
  }
};

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;
const PASSWORD_HISTORY_LIMIT = 5;

class AuthController {

  async login(req: Request, res: Response, next: NextFunction) {
    const { idToken } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    if (!idToken) {
      return res.status(400).json({ success: false, message: 'ID token is required.' });
    }

    try {
      // 1. Verify the ID token using Firebase Admin SDK
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const firebaseId = decodedToken.uid;

      // 2. Find the user in our database
      const user = await prisma.user.findUnique({
        where: { firebaseId },
        include: {
          memberships: {
            orderBy: { createdAt: 'asc' },
            include: {
              organization: true,
            },
          },
        },
      });

      if (!user) {
        return res.status(404).json({ 
          success: false, 
          message: 'User not found in database. Please initialize the user.',
          errorCode: 'USER_NOT_INITIALIZED' 
        });
      }

      // 3. Check if account is locked
      if (user.lockedUntil && new Date() < user.lockedUntil) {
        const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
        return res.status(423).json({
          success: false,
          message: `Account is temporarily locked due to multiple failed login attempts. Please try again in ${minutesLeft} minutes.`,
          errorCode: 'ACCOUNT_LOCKED',
        });
      }

      // 4. Check if email is verified
      if (!user.emailVerified) {
        return res.status(403).json({
          success: false,
          message: 'Please verify your email address before logging in.',
          errorCode: 'EMAIL_NOT_VERIFIED',
        });
      }

      // 5. Reset failed attempts on successful login
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
          lastLoginIp: ipAddress,
        },
      });

      // 6. Create audit log
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN',
          ipAddress,
          userAgent,
          metadata: { success: true },
        },
      });

      // 7. Send user data back
      const desiredOrgId = user.activeOrganizationId || user.memberships?.[0]?.organizationId;
      const activeMembership = desiredOrgId
        ? user.memberships?.find(m => m.organizationId === desiredOrgId) || user.memberships?.[0]
        : undefined;

      const orgName = activeMembership?.organization?.name || user.organization;
      res.status(200).json({
        success: true,
        message: 'Login successful.',
        user: {
          id: user.id,
          name: user.name || 'User',
          email: user.email,
          role: user.role,
          organization: orgName,
          organizationId: activeMembership?.organizationId,
          organizationRole: activeMembership?.role,
          emailVerified: user.emailVerified,
        },
      });

    } catch (error: any) {
      // Log failed login attempt
      try {
        if (error.code && error.code.startsWith('auth/')) {
          // Try to get user by email from Firebase if possible
          const email = req.body.email;
          if (email) {
            const user = await prisma.user.findUnique({ where: { email } });
            if (user) {
              const newFailedAttempts = user.failedLoginAttempts + 1;
              const shouldLock = newFailedAttempts >= MAX_FAILED_ATTEMPTS;
              
              const updateData: any = {
                failedLoginAttempts: newFailedAttempts,
              };

              if (shouldLock) {
                const lockUntil = new Date();
                lockUntil.setMinutes(lockUntil.getMinutes() + LOCKOUT_DURATION_MINUTES);
                updateData.lockedUntil = lockUntil;
                
                // Send account locked email
                if (typeof emailService.sendAccountLockedEmail === 'function') {
                  await emailService.sendAccountLockedEmail(user.email, user.name || undefined);
                }
              }

              await prisma.user.update({
                where: { id: user.id },
                data: updateData,
              });

              await prisma.auditLog.create({
                data: {
                  userId: user.id,
                  action: 'LOGIN_FAILED',
                  ipAddress: req.ip || 'unknown',
                  userAgent: req.headers['user-agent'] || 'unknown',
                  metadata: { reason: error.message, attempts: newFailedAttempts },
                },
              });
            }
          }
        }
      } catch (auditError) {
        console.error('Error logging failed login:', auditError);
      }

      let errorMessage = 'An unexpected error occurred during login.';
      if (error.code && error.code.startsWith('auth/')) {
        errorMessage = `Firebase token verification failed: ${error.message}`;
      }
      res.status(401).json({ success: false, message: errorMessage });
    }
  }

  async initUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const firebaseId = req.user?.firebaseId;

    if (!firebaseId) {
      return res.status(401).json({ message: 'Firebase ID not found on authenticated user.' });
    }

    try {
      // Check if user already exists
      let user = await prisma.user.findUnique({
        where: { firebaseId },
      });

      if (user) {
        // Auto-heal legacy users that predate organizations.
        const existingMembership = await prisma.organizationMember.findFirst({
          where: { userId: user.id },
          select: { id: true },
        });
        if (!existingMembership) {
          const org = await prisma.organization.create({
            data: {
              name: user.organization || 'Acme Corporation',
            },
          });
          await prisma.organizationMember.create({
            data: {
              organizationId: org.id,
              userId: user.id,
              role: 'OWNER',
            },
          });

          if (!user.activeOrganizationId) {
            await prisma.user.update({
              where: { id: user.id },
              data: { activeOrganizationId: org.id },
            });
          }
        } else if (!user.activeOrganizationId) {
          // Default active org to the earliest membership.
          const earliest = await prisma.organizationMember.findFirst({
            where: { userId: user.id },
            orderBy: { createdAt: 'asc' },
            select: { organizationId: true },
          });
          if (earliest?.organizationId) {
            await prisma.user.update({
              where: { id: user.id },
              data: { activeOrganizationId: earliest.organizationId },
            });
          }
        }

        // Check if email is verified before returning user
        if (!user.emailVerified) {
          return res.status(403).json({
            success: false,
            message: 'Please verify your email address before accessing the platform.',
            errorCode: 'EMAIL_NOT_VERIFIED',
          });
        }
        return res.status(200).json({ message: 'User already initialized.', user });
      }

      // Try to find user by email
      const firebaseUser = await admin.auth().getUser(firebaseId);
      if (!firebaseUser.email) {
        return res.status(400).json({ message: 'User email not found in Firebase token.' });
      }

      user = await prisma.user.findUnique({ where: { email: firebaseUser.email } });
      if (user) {
        // Auto-heal legacy users that predate organizations.
        const existingMembership = await prisma.organizationMember.findFirst({
          where: { userId: user.id },
          select: { id: true },
        });
        if (!existingMembership) {
          const org = await prisma.organization.create({
            data: {
              name: user.organization || 'Acme Corporation',
            },
          });
          await prisma.organizationMember.create({
            data: {
              organizationId: org.id,
              userId: user.id,
              role: 'OWNER',
            },
          });

          if (!user.activeOrganizationId) {
            await prisma.user.update({
              where: { id: user.id },
              data: { activeOrganizationId: org.id },
            });
          }
        } else if (!user.activeOrganizationId) {
          const earliest = await prisma.organizationMember.findFirst({
            where: { userId: user.id },
            orderBy: { createdAt: 'asc' },
            select: { organizationId: true },
          });
          if (earliest?.organizationId) {
            await prisma.user.update({
              where: { id: user.id },
              data: { activeOrganizationId: earliest.organizationId },
            });
          }
        }

        // Check if email is verified before returning user
        if (!user.emailVerified) {
          if (user.firebaseId !== firebaseId) {
            user = await prisma.user.update({
              where: { email: firebaseUser.email },
              data: { firebaseId },
            });
          }
          return res.status(403).json({
            success: false,
            message: 'Please verify your email address before accessing the platform.',
            errorCode: 'EMAIL_NOT_VERIFIED',
          });
        }
        if (user.firebaseId !== firebaseId) {
          user = await prisma.user.update({
            where: { email: firebaseUser.email },
            data: { firebaseId },
          });
        }
        return res.status(200).json({ message: 'User already initialized (by email).', user });
      }

      // Create new user with verification token
      const { token, expiry } = generateTokenWithExpiry(24); // 24 hours for email verification

      const requestedNameRaw = typeof (req.body as any)?.name === 'string'
        ? String((req.body as any).name).trim()
        : '';

      const requestedName = requestedNameRaw && requestedNameRaw.length <= 80 ? requestedNameRaw : '';

      const requestedOrgNameRaw = typeof (req.body as any)?.organizationName === 'string'
        ? String((req.body as any).organizationName).trim()
        : '';

      const requestedPersona = parsePersona((req.body as any)?.persona);

      const fallbackOrgName = (() => {
        const base = (requestedName || firebaseUser.displayName || firebaseUser.email || 'New User').trim();
        const safeBase = base.length > 60 ? base.slice(0, 60) : base;
        return `${safeBase}'s Workspace`;
      })();

      const orgName = requestedOrgNameRaw && requestedOrgNameRaw.length <= 80 ? requestedOrgNameRaw : fallbackOrgName;

      try {
        user = await prisma.$transaction(async (tx) => {
          const org = await tx.organization.create({
            data: {
              name: orgName,
            },
          });

          const createdUser = await tx.user.create({
            data: {
              firebaseId: firebaseId,
              email: firebaseUser.email!,
              name: requestedName || firebaseUser.displayName || 'New User',
              organization: org.name,
              role: 'CLIENT',
              persona: requestedPersona || undefined,
              activeOrganizationId: org.id,
              emailVerificationToken: token,
              emailVerificationExpiry: expiry,
            },
          });

          await tx.organizationMember.create({
            data: {
              organizationId: org.id,
              userId: createdUser.id,
              role: 'OWNER',
            },
          });

          return createdUser;
        });
      } catch (error: any) {
        // If multiple init requests race, the second create can hit unique constraints.
        // Treat init as idempotent by fetching the existing user and responding accordingly.
        if (error?.code === 'P2002') {
          const existingByFirebaseId = await prisma.user.findUnique({ where: { firebaseId } });
          const existingByEmail = firebaseUser.email
            ? await prisma.user.findUnique({ where: { email: firebaseUser.email } })
            : null;

          user = existingByFirebaseId || existingByEmail;

          if (user) {
            // Auto-heal legacy users that predate organizations.
            const existingMembership = await prisma.organizationMember.findFirst({
              where: { userId: user.id },
              select: { id: true },
            });
            if (!existingMembership) {
              const org = await prisma.organization.create({
                data: {
                  name: user.organization || 'Acme Corporation',
                },
              });
              await prisma.organizationMember.create({
                data: {
                  organizationId: org.id,
                  userId: user.id,
                  role: 'OWNER',
                },
              });

              if (!user.activeOrganizationId) {
                await prisma.user.update({
                  where: { id: user.id },
                  data: { activeOrganizationId: org.id },
                });
              }
            } else if (!user.activeOrganizationId) {
              const earliest = await prisma.organizationMember.findFirst({
                where: { userId: user.id },
                orderBy: { createdAt: 'asc' },
                select: { organizationId: true },
              });
              if (earliest?.organizationId) {
                await prisma.user.update({
                  where: { id: user.id },
                  data: { activeOrganizationId: earliest.organizationId },
                });
              }
            }

            if (!user.emailVerified) {
              return res.status(403).json({
                success: false,
                message: 'Please verify your email address before accessing the platform.',
                errorCode: 'EMAIL_NOT_VERIFIED',
              });
            }

            return res.status(200).json({ message: 'User already initialized.', user });
          }
        }

        throw error;
      }

      // Send verification email
      const emailer = emailService;
      await emailer.sendVerificationEmail(user.email, token);

      // IMPORTANT: Do NOT treat a newly-created unverified user as authenticated.
      // Keep behavior consistent with the existing-user path above.
      return res.status(403).json({
        success: false,
        message: 'Please verify your email address before accessing the platform.',
        errorCode: 'EMAIL_NOT_VERIFIED',
      });

    } catch (error) {
      next(error);
    }
  }

  async verifyEmail(req: Request, res: Response, next: NextFunction) {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Verification token is required.' });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { emailVerificationToken: token },
      });

      if (!user) {
        return res.status(404).json({ message: 'Invalid verification token.' });
      }

      if (user.emailVerified) {
        return res.status(200).json({ message: 'Email already verified.' });
      }

      if (user.emailVerificationExpiry && new Date() > user.emailVerificationExpiry) {
        return res.status(410).json({ message: 'Verification token has expired. Please request a new one.' });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpiry: null,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'EMAIL_VERIFIED',
          ipAddress: req.ip || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
        },
      });

      res.status(200).json({ message: 'Email verified successfully! You can now log in.' });
    } catch (error) {
      next(error);
    }
  }

  async resendVerificationEmail(req: Request, res: Response, next: NextFunction) {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    try {
      const user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        // Don't reveal if user exists
        return res.status(200).json({ message: 'If this email is registered, a verification link has been sent.' });
      }

      if (user.emailVerified) {
        return res.status(400).json({ message: 'Email is already verified.' });
      }

      const { token, expiry } = generateTokenWithExpiry(24);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationToken: token,
          emailVerificationExpiry: expiry,
        },
      });

      const emailer = emailService;
      await emailer.sendVerificationEmail(user.email, token);

      res.status(200).json({ message: 'Verification email sent successfully.' });
    } catch (error) {
      next(error);
    }
  }

  async requestPasswordReset(req: Request, res: Response, next: NextFunction) {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    try {
      const user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        // Don't reveal if user exists
        return res.status(200).json({ message: 'If this email is registered, a password reset link has been sent.' });
      }

      const { token, expiry } = generateTokenWithExpiry(1); // 1 hour for password reset

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: token,
          passwordResetExpiry: expiry,
        },
      });

      if (typeof emailService.sendPasswordResetEmail === 'function') {
        await emailService.sendPasswordResetEmail(user.email, token, user.name || undefined);
      }

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'PASSWORD_RESET_REQUESTED',
          ipAddress: req.ip || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
        },
      });

      res.status(200).json({ message: 'Password reset link sent successfully.' });
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required.' });
    }

    try {
      // Validate password strength
      const validation = PasswordValidator.validate(newPassword);
      if (!validation.isValid) {
        return res.status(400).json({ message: 'Invalid password.', errors: validation.errors });
      }

      const user = await prisma.user.findUnique({
        where: { passwordResetToken: token },
      });

      if (!user) {
        return res.status(404).json({ message: 'Invalid reset token.' });
      }

      if (user.passwordResetExpiry && new Date() > user.passwordResetExpiry) {
        return res.status(410).json({ message: 'Reset token has expired. Please request a new one.' });
      }

      // Check password history
      if (PasswordValidator.checkPasswordHistory(newPassword, user.passwordHistory)) {
        return res.status(400).json({ 
          message: `You cannot reuse any of your last ${PASSWORD_HISTORY_LIMIT} passwords.` 
        });
      }

      // Update password in Firebase
      await admin.auth().updateUser(user.firebaseId, {
        password: newPassword,
      });

      // Update password history
      const hashedPassword = PasswordValidator.hashPassword(newPassword);
      const newHistory = [hashedPassword, ...user.passwordHistory].slice(0, PASSWORD_HISTORY_LIMIT);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: null,
          passwordResetExpiry: null,
          lastPasswordChange: new Date(),
          passwordHistory: newHistory,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'PASSWORD_RESET',
          ipAddress: req.ip || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
        },
      });

      res.status(200).json({ message: 'Password reset successfully. You can now log in with your new password.' });
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized.' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required.' });
    }

    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }

      // Validate new password strength
      const validation = PasswordValidator.validate(newPassword);
      if (!validation.isValid) {
        return res.status(400).json({ message: 'Invalid password.', errors: validation.errors });
      }

      // Check password history
      if (PasswordValidator.checkPasswordHistory(newPassword, user.passwordHistory)) {
        return res.status(400).json({ 
          message: `You cannot reuse any of your last ${PASSWORD_HISTORY_LIMIT} passwords.` 
        });
      }

      // Verify current password with Firebase
      const firebaseUser = await admin.auth().getUser(user.firebaseId);
      // Note: We can't directly verify the password, so we'll update it and let Firebase handle validation

      // Update password in Firebase
      await admin.auth().updateUser(user.firebaseId, {
        password: newPassword,
      });

      // Update password history
      const hashedPassword = PasswordValidator.hashPassword(newPassword);
      const newHistory = [hashedPassword, ...user.passwordHistory].slice(0, PASSWORD_HISTORY_LIMIT);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastPasswordChange: new Date(),
          passwordHistory: newHistory,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'PASSWORD_CHANGED',
          ipAddress: req.ip || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
        },
      });

      res.status(200).json({ message: 'Password changed successfully.' });
    } catch (error: any) {
      if (error.code === 'auth/wrong-password') {
        return res.status(401).json({ message: 'Current password is incorrect.' });
      }
      next(error);
    }
  }

  async getOnboardingStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { onboardingComplete: true },
      });

      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }

      // Also check if user has any assessments
      const assessmentCount = await prisma.assessment.count({
        where: { userId: req.user!.id },
      });

      res.json({
        onboardingComplete: user.onboardingComplete,
        hasAssessments: assessmentCount > 0,
      });
    } catch (error) {
      next(error);
    }
  }

  async completeOnboarding(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await prisma.user.update({
        where: { id: req.user!.id },
        data: { onboardingComplete: true },
      });

      res.json({ success: true, message: 'Onboarding completed.' });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
