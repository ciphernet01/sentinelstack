import { Response, NextFunction, Request } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../config/db';
import { emailService } from '../services/email.service';
import { generateTokenWithExpiry } from '../utils/password';

const INVITE_EXPIRY_HOURS = 72;

const normalizeEmail = (email: string) => {
  const trimmed = String(email || '').trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0) return trimmed;

  let local = trimmed.slice(0, at);
  let domain = trimmed.slice(at + 1);

  // Gmail normalization: dots are ignored in the local-part, and '+tag' aliases deliver to the same mailbox.
  // This helps prevent false mismatches when an invite is sent to one Gmail variant and the user signs in with another.
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    // Canonicalize domain (googlemail.com is treated as gmail.com for delivery).
    domain = 'gmail.com';
    const plusIndex = local.indexOf('+');
    if (plusIndex >= 0) {
      local = local.slice(0, plusIndex);
    }
    local = local.replace(/\./g, '');
  }

  return `${local}@${domain}`;
};

class OrgController {
  async listMyMemberships(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'User not found.' });
      }

      const memberships = await prisma.organizationMember.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          role: true,
          createdAt: true,
          organization: {
            select: { id: true, name: true },
          },
        },
      });

      return res.status(200).json({ memberships });
    } catch (error) {
      next(error);
    }
  }

  async getMyOrganization(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: 'User not found.' });
      }

      // Auto-heal legacy users that predate org memberships (or if active org context is missing).
      let organizationId = req.user?.organizationId;
      if (!organizationId) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, name: true, organization: true, activeOrganizationId: true },
        });

        if (!user) {
          return res.status(401).json({ message: 'User not found.' });
        }

        // If memberships exist, pick the earliest one and set it as active.
        const earliest = await prisma.organizationMember.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: 'asc' },
          select: { organizationId: true },
        });

        if (earliest?.organizationId) {
          organizationId = earliest.organizationId;
          if (!user.activeOrganizationId) {
            await prisma.user.update({
              where: { id: user.id },
              data: { activeOrganizationId: organizationId },
            });
          }
        } else {
          const base = (user.organization || user.name || user.email || 'New User').trim();
          const safeBase = base.length > 60 ? base.slice(0, 60) : base;
          const orgName = safeBase.includes('Workspace') ? safeBase : `${safeBase}'s Workspace`;

          const created = await prisma.$transaction(async (tx) => {
            const org = await tx.organization.create({
              data: { name: orgName },
              select: { id: true, name: true },
            });

            await tx.organizationMember.create({
              data: { organizationId: org.id, userId: user.id, role: 'OWNER' },
            });

            await tx.user.update({
              where: { id: user.id },
              data: { activeOrganizationId: org.id, organization: org.name },
            });

            return org;
          });

          organizationId = created.id;
        }
      }

      if (!organizationId) {
        return res.status(404).json({ message: 'No organization found for this user.' });
      }

      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, email: true, name: true, role: true, persona: true, emailVerified: true },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!org) {
        return res.status(404).json({ message: 'Organization not found.' });
      }

      res.status(200).json({ organization: org });
    } catch (error) {
      next(error);
    }
  }

  async listInvitations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        return res.status(403).json({ message: 'Organization context missing for this user.' });
      }

      const invitations = await prisma.organizationInvitation.findMany({
        where: {
          organizationId,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          token: true,
          expiresAt: true,
          createdAt: true,
        },
      });

      res.status(200).json({ invitations });
    } catch (error) {
      next(error);
    }
  }

  async createInvitation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      const invitedByUserId = req.user?.id;

      if (!organizationId || !invitedByUserId) {
        return res.status(403).json({ message: 'Organization context missing for this user.' });
      }

      const emailRaw = String((req.body as any)?.email || '');
      const roleRaw = String((req.body as any)?.role || 'MEMBER').toUpperCase();
      const email = normalizeEmail(emailRaw);

      if (!email || !email.includes('@')) {
        return res.status(400).json({ message: 'A valid email is required.' });
      }

      const role = roleRaw === 'OWNER' || roleRaw === 'ADMIN' || roleRaw === 'MEMBER' ? roleRaw : 'MEMBER';

      // Prevent inviting an existing member
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        const existingMembership = await prisma.organizationMember.findFirst({
          where: { organizationId, userId: existingUser.id },
          select: { id: true },
        });
        if (existingMembership) {
          return res.status(409).json({ message: 'User is already a member of this organization.' });
        }
      }

      const { token, expiry } = generateTokenWithExpiry(INVITE_EXPIRY_HOURS);

      const invitation = await prisma.organizationInvitation.upsert({
        where: {
          organizationId_email: {
            organizationId,
            email,
          },
        },
        update: {
          role,
          token,
          expiresAt: expiry,
          invitedByUserId,
          acceptedAt: null,
        },
        create: {
          organizationId,
          email,
          role,
          token,
          expiresAt: expiry,
          invitedByUserId,
        },
      });

      const org = await prisma.organization.findUnique({ where: { id: organizationId } });
      const inviter = await prisma.user.findUnique({ where: { id: invitedByUserId }, select: { name: true, email: true } });

      await emailService.sendOrganizationInvitationEmail(
        email,
        token,
        org?.name || 'your organization',
        inviter?.name || inviter?.email || undefined
      );

      res.status(201).json({
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          token: invitation.token,
          expiresAt: invitation.expiresAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async revokeInvitation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        return res.status(403).json({ message: 'Organization context missing for this user.' });
      }

      const { id } = req.params;
      const invitation = await prisma.organizationInvitation.findFirst({
        where: { id, organizationId },
        select: { id: true, acceptedAt: true },
      });

      if (!invitation) {
        return res.status(404).json({ message: 'Invitation not found.' });
      }

      if (invitation.acceptedAt) {
        return res.status(409).json({ message: 'Invitation already accepted.' });
      }

      await prisma.organizationInvitation.delete({ where: { id: invitation.id } });
      return res.status(200).json({ message: 'Invitation revoked.' });
    } catch (error) {
      next(error);
    }
  }

  async resendInvitation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      const invitedByUserId = req.user?.id;

      if (!organizationId || !invitedByUserId) {
        return res.status(403).json({ message: 'Organization context missing for this user.' });
      }

      const { id } = req.params;
      const existing = await prisma.organizationInvitation.findFirst({
        where: { id, organizationId },
      });

      if (!existing || existing.acceptedAt) {
        return res.status(404).json({ message: 'Invitation not found.' });
      }

      const { token, expiry } = generateTokenWithExpiry(INVITE_EXPIRY_HOURS);

      const invitation = await prisma.organizationInvitation.update({
        where: { id: existing.id },
        data: {
          token,
          expiresAt: expiry,
          invitedByUserId,
        },
      });

      const org = await prisma.organization.findUnique({ where: { id: organizationId } });
      const inviter = await prisma.user.findUnique({ where: { id: invitedByUserId }, select: { name: true, email: true } });

      await emailService.sendOrganizationInvitationEmail(
        invitation.email,
        invitation.token,
        org?.name || 'your organization',
        inviter?.name || inviter?.email || undefined
      );

      res.status(200).json({ invitation: { id: invitation.id, email: invitation.email, role: invitation.role, token: invitation.token, expiresAt: invitation.expiresAt } });
    } catch (error) {
      next(error);
    }
  }

  async setActiveOrganization(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'User not found.' });
      }

      const organizationId = String((req.body as any)?.organizationId || '').trim();
      if (!organizationId) {
        return res.status(400).json({ message: 'organizationId is required.' });
      }

      const membership = await prisma.organizationMember.findFirst({
        where: { userId, organizationId },
        select: { organizationId: true },
      });

      if (!membership) {
        return res.status(403).json({ message: 'Forbidden: you are not a member of this organization.' });
      }

      await prisma.user.update({
        where: { id: userId },
        data: { activeOrganizationId: organizationId },
      });

      res.status(200).json({ message: 'Active organization updated.' });
    } catch (error) {
      next(error);
    }
  }

  async updateMemberRole(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        return res.status(403).json({ message: 'Organization context missing for this user.' });
      }

      const { memberId } = req.params;
      const roleRaw = String((req.body as any)?.role || '').toUpperCase();
      const role = roleRaw === 'OWNER' || roleRaw === 'ADMIN' || roleRaw === 'MEMBER' ? roleRaw : null;

      if (!role) {
        return res.status(400).json({ message: 'A valid role is required.' });
      }

      const member = await prisma.organizationMember.findFirst({
        where: { id: memberId, organizationId },
        select: { id: true, role: true, userId: true },
      });

      if (!member) {
        return res.status(404).json({ message: 'Member not found.' });
      }

      if (member.role === role) {
        return res.status(200).json({ member: { id: member.id, role: member.role } });
      }

      // Prevent demoting the last OWNER.
      if (member.role === 'OWNER' && role !== 'OWNER') {
        const ownerCount = await prisma.organizationMember.count({
          where: { organizationId, role: 'OWNER' },
        });
        if (ownerCount <= 1) {
          return res.status(409).json({ message: 'You cannot change the role of the last owner.' });
        }
      }

      const updated = await prisma.organizationMember.update({
        where: { id: member.id },
        data: { role },
        select: { id: true, role: true },
      });

      return res.status(200).json({ member: updated });
    } catch (error) {
      next(error);
    }
  }

  async removeMember(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      const actingUserId = req.user?.id;
      const orgRole = req.user?.organizationRole;

      if (!organizationId || !actingUserId) {
        return res.status(403).json({ message: 'Organization context missing for this user.' });
      }

      const { memberId } = req.params;
      const member = await prisma.organizationMember.findFirst({
        where: { id: memberId, organizationId },
        select: { id: true, role: true, userId: true },
      });

      if (!member) {
        return res.status(404).json({ message: 'Member not found.' });
      }

      if (member.userId === actingUserId) {
        return res.status(400).json({ message: 'You cannot remove yourself from the workspace (use a leave-workspace flow instead).' });
      }

      // Organization ADMINs can only remove MEMBERs.
      if (req.user?.role !== 'ADMIN' && orgRole === 'ADMIN' && member.role !== 'MEMBER') {
        return res.status(403).json({ message: 'Forbidden: admins can only remove members.' });
      }

      // Prevent removing the last OWNER.
      if (member.role === 'OWNER') {
        const ownerCount = await prisma.organizationMember.count({
          where: { organizationId, role: 'OWNER' },
        });
        if (ownerCount <= 1) {
          return res.status(409).json({ message: 'You cannot remove the last owner.' });
        }
      }

      await prisma.$transaction(async (tx) => {
        await tx.organizationMember.delete({ where: { id: member.id } });

        // If the removed user had this org as active, switch them to another org (or null).
        const removedUser = await tx.user.findUnique({
          where: { id: member.userId },
          select: { id: true, activeOrganizationId: true },
        });

        if (removedUser?.activeOrganizationId === organizationId) {
          const nextMembership = await tx.organizationMember.findFirst({
            where: { userId: member.userId },
            orderBy: { createdAt: 'asc' },
            select: { organizationId: true, organization: { select: { name: true } } },
          });

          await tx.user.update({
            where: { id: member.userId },
            data: {
              activeOrganizationId: nextMembership?.organizationId || null,
              organization: nextMembership?.organization?.name || null,
            },
          });
        }
      });

      return res.status(200).json({ message: 'Member removed.' });
    } catch (error) {
      next(error);
    }
  }

  async leaveOrganization(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      const userId = req.user?.id;

      if (!organizationId || !userId) {
        return res.status(403).json({ message: 'Organization context missing for this user.' });
      }

      const membership = await prisma.organizationMember.findFirst({
        where: { organizationId, userId },
        select: { id: true, role: true },
      });

      if (!membership) {
        return res.status(404).json({ message: 'Membership not found.' });
      }

      // Prevent leaving as the last OWNER.
      if (membership.role === 'OWNER') {
        const ownerCount = await prisma.organizationMember.count({
          where: { organizationId, role: 'OWNER' },
        });
        if (ownerCount <= 1) {
          return res.status(409).json({ message: 'You cannot leave the workspace as the last owner.' });
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        await tx.organizationMember.delete({ where: { id: membership.id } });

        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true, activeOrganizationId: true },
        });

        // If the user was actively in this org, move them to another org (or clear).
        if (user?.activeOrganizationId === organizationId) {
          const nextMembership = await tx.organizationMember.findFirst({
            where: { userId },
            orderBy: { createdAt: 'asc' },
            select: { organizationId: true, organization: { select: { name: true } } },
          });

          await tx.user.update({
            where: { id: userId },
            data: {
              activeOrganizationId: nextMembership?.organizationId || null,
              organization: nextMembership?.organization?.name || null,
            },
          });

          return { activeOrganizationId: nextMembership?.organizationId || null };
        }

        return { activeOrganizationId: user?.activeOrganizationId || null };
      });

      return res.status(200).json({ message: 'Left workspace.', ...result });
    } catch (error) {
      next(error);
    }
  }

  async acceptInvitation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const token = String((req.body as any)?.token || '').trim();
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: 'User not found.' });
      }

      if (!token) {
        return res.status(400).json({ message: 'Invitation token is required.' });
      }

      const invitation = await prisma.organizationInvitation.findUnique({
        where: { token },
      });

      if (!invitation || invitation.acceptedAt) {
        return res.status(404).json({ message: 'Invalid invitation token.' });
      }

      if (invitation.expiresAt && new Date() > invitation.expiresAt) {
        return res.status(410).json({ message: 'Invitation token has expired.' });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(401).json({ message: 'User not found.' });
      }

      if (!user.emailVerified) {
        return res.status(403).json({ message: 'Please verify your email address before accepting an invitation.', errorCode: 'EMAIL_NOT_VERIFIED' });
      }

      const currentEmail = normalizeEmail(user.email);
      const invitedEmail = normalizeEmail(invitation.email);
      if (currentEmail !== invitedEmail) {
        return res.status(403).json({
          message: 'This invitation is for a different email address.',
          errorCode: 'INVITE_EMAIL_MISMATCH',
          invitationEmail: invitation.email,
          currentEmail: user.email,
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.organizationMember.upsert({
          where: {
            organizationId_userId: {
              organizationId: invitation.organizationId,
              userId: user.id,
            },
          },
          update: {
            role: invitation.role,
          },
          create: {
            organizationId: invitation.organizationId,
            userId: user.id,
            role: invitation.role,
          },
        });

        await tx.organizationInvitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: new Date() },
        });

        // Keep legacy string field in sync for now.
        const org = await tx.organization.findUnique({ where: { id: invitation.organizationId } });
        if (org) {
          await tx.user.update({
            where: { id: user.id },
            data: {
              organization: org.name,
              activeOrganizationId: org.id,
            },
          });
        }
      });

      res.status(200).json({ message: 'Invitation accepted.' });
    } catch (error) {
      next(error);
    }
  }
}

export const orgController = new OrgController();
