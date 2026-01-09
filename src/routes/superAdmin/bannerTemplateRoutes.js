const express = require('express');
const router = express.Router();
const bannerTemplateController = require('../../controllers/superAdmin/bannerTemplateController');
const { authenticateSuperAdmin } = require('../../middleware/authMiddleware');

// Apply super admin authentication to all routes
router.use(authenticateSuperAdmin);

// Banner Template CRUD
router.post('/', bannerTemplateController.createTemplate);
router.get('/', bannerTemplateController.getAllTemplates);
router.get('/stats/usage', bannerTemplateController.getTemplateStats);
router.get('/by-type/:type', bannerTemplateController.getTemplatesByType);
router.get('/:id', bannerTemplateController.getTemplateById);
router.put('/:id', bannerTemplateController.updateTemplate);
router.delete('/:id', bannerTemplateController.deleteTemplate);
router.patch('/:id/status', bannerTemplateController.toggleTemplateStatus);

module.exports = router;
