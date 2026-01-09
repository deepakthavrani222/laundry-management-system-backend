const express = require('express');
const { body } = require('express-validator');
const {
  getTenantCampaigns,
  createTenantCampaign,
  updateTenantCampaign,
  deleteTenantCampaign,
  getTenantCampaignAnalytics,
  createFromTemplate,
  getAvailableTemplates
} = require('../../controllers/admin/campaignController');

const router = express.Router();

// Validation rules for creation
const campaignValidation = [
  body('name').trim().notEmpty().withMessage('Campaign name is required'),
  body('startDate').isISO8601().withMessage('Valid start date is required'),
  body('endDate').isISO8601().withMessage('Valid end date is required'),
  body('promotions').optional().isArray().withMessage('Promotions must be an array')
];

// Validation rules for updates (all fields optional)
const campaignUpdateValidation = [
  body('name').optional().trim().notEmpty().withMessage('Campaign name cannot be empty'),
  body('startDate').optional().isISO8601().withMessage('Valid start date is required'),
  body('endDate').optional().isISO8601().withMessage('Valid end date is required'),
  body('promotions').optional().isArray().withMessage('Promotions must be an array'),
  body('status').optional().isIn(['DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']).withMessage('Invalid status value')
];

// Get all tenant campaigns
router.get('/', getTenantCampaigns);

// Get campaign analytics
router.get('/analytics', getTenantCampaignAnalytics);

// Get available templates
router.get('/templates', getAvailableTemplates);

// Create campaign from template
router.post('/templates/:templateId/create', createFromTemplate);

// Create new tenant campaign
router.post('/', campaignValidation, createTenantCampaign);

// Update tenant campaign
router.put('/:campaignId', campaignUpdateValidation, updateTenantCampaign);

// Delete tenant campaign
router.delete('/:campaignId', deleteTenantCampaign);

module.exports = router;
