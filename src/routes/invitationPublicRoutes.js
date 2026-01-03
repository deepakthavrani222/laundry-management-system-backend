const express = require('express');
const router = express.Router();
const invitationController = require('../controllers/superAdmin/invitationController');

// Accept invitation (public - no auth required)
router.post('/accept', invitationController.acceptInvitation);

module.exports = router;
