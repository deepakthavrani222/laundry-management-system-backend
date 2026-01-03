const express = require('express');
const router = express.Router();
const invitationController = require('../controllers/superAdmin/invitationController');
const { authenticateSuperAdmin, requirePermission } = require('../middlewares/superAdminAuth');

// All routes require superadmin authentication
router.use(authenticateSuperAdmin);

// Invite laundry admin to a tenancy
router.post(
  '/invite',
  requirePermission('users'),
  invitationController.inviteLaundryAdmin
);

// Get pending invitations
router.get(
  '/pending',
  requirePermission('users'),
  invitationController.getPendingInvitations
);

// Resend invitation
router.post(
  '/:userId/resend',
  requirePermission('users'),
  invitationController.resendInvitation
);

// Cancel invitation
router.delete(
  '/:userId',
  requirePermission('users'),
  invitationController.cancelInvitation
);

module.exports = router;
