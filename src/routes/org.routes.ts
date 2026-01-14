import { Router } from 'express';
import { orgController } from '../controllers/org.controller';
import { firebaseAuth, requireOrganizationRole } from '../middleware/auth';

const router = Router();

// @route   GET /api/org/me
// @desc    Get current user's organization + members
// @access  Private
router.get('/me', firebaseAuth, orgController.getMyOrganization);

// @route   GET /api/org/memberships
// @desc    List organizations the current user belongs to
// @access  Private
router.get('/memberships', firebaseAuth, orgController.listMyMemberships);

// @route   GET /api/org/invitations
// @desc    List pending invitations
// @access  Private (Org OWNER/ADMIN)
router.get('/invitations', firebaseAuth, requireOrganizationRole(['OWNER', 'ADMIN']), orgController.listInvitations);

// @route   POST /api/org/invitations
// @desc    Invite a member by email
// @access  Private (Org OWNER/ADMIN)
router.post('/invitations', firebaseAuth, requireOrganizationRole(['OWNER', 'ADMIN']), orgController.createInvitation);

// @route   POST /api/org/invitations/:id/resend
// @desc    Resend an invitation (refresh token/expiry)
// @access  Private (Org OWNER/ADMIN)
router.post(
	'/invitations/:id/resend',
	firebaseAuth,
	requireOrganizationRole(['OWNER', 'ADMIN']),
	orgController.resendInvitation
);

// @route   DELETE /api/org/invitations/:id
// @desc    Revoke an invitation
// @access  Private (Org OWNER/ADMIN)
router.delete(
	'/invitations/:id',
	firebaseAuth,
	requireOrganizationRole(['OWNER', 'ADMIN']),
	orgController.revokeInvitation
);

// @route   POST /api/org/invitations/accept
// @desc    Accept an invitation
// @access  Private
router.post('/invitations/accept', firebaseAuth, orgController.acceptInvitation);

// @route   POST /api/org/leave
// @desc    Leave the current active organization
// @access  Private (Org MEMBER+)
router.post('/leave', firebaseAuth, requireOrganizationRole(['OWNER', 'ADMIN', 'MEMBER']), orgController.leaveOrganization);

// @route   PATCH /api/org/members/:memberId
// @desc    Update an organization member role
// @access  Private (Org OWNER)
router.patch(
	'/members/:memberId',
	firebaseAuth,
	requireOrganizationRole(['OWNER']),
	orgController.updateMemberRole
);

// @route   DELETE /api/org/members/:memberId
// @desc    Remove an organization member
// @access  Private (Org OWNER/ADMIN)
router.delete(
	'/members/:memberId',
	firebaseAuth,
	requireOrganizationRole(['OWNER', 'ADMIN']),
	orgController.removeMember
);

// @route   POST /api/org/active
// @desc    Set active organization context
// @access  Private
router.post('/active', firebaseAuth, orgController.setActiveOrganization);

export default router;
