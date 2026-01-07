const express = require('express');
const { protectSuperAdmin } = require('../middlewares/auth');
const { body, param } = require('express-validator');
const {
  getAllCampaigns,
  createGlobalCampaign,
  createTemplateCampaign,
  updateCampaign,
  deleteCampaign,
  approveCampaign,
  toggleCampaignStatus,
  getCampaignAnalytics,
  getTenanciesForSelection
} = require('../controllers/superAdmin/campaignController');

const router = express.Router();

// Validation rules
const createGlobalCampaignValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Campaign name must be 2-100 characters'),
  body('startDate')
    .isISO8601()
    .withMessage('Valid start date is required'),
  body('endDate')
    .isISO8601()
    .withMessage('Valid end date is required'),
  body('promotions')
    .isArray({ min: 1 })
    .withMessage('At least one promotion is required'),
  body('promotions.*.type')
    .isIn(['DISCOUNT', 'COUPON', 'LOYALTY_POINTS', 'WALLET_CREDIT'])
    .withMessage('Invalid promotion type'),
  body('promotions.*.promotionId')
    .isMongoId()
    .withMessage('Valid promotion ID is required'),
  body('applicableTenancies')
    .optional()
    .isArray()
    .withMessage('Applicable tenancies must be an array'),
  body('applicableTenancies.*')
    .optional()
    .isMongoId()
    .withMessage('Invalid tenancy ID'),
  body('budget.type')
    .optional()
    .isIn(['UNLIMITED', 'FIXED_AMOUNT', 'PER_USER', 'PERCENTAGE_OF_REVENUE'])
    .withMessage('Invalid budget type'),
  body('budget.budgetSource')
    .optional()
    .isIn(['TENANT_BUDGET', 'PLATFORM_BUDGET', 'SHARED_SPLIT'])
    .withMessage('Invalid budget source')
];

const createTemplateCampaignValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Template name must be 2-100 characters'),
  body('templateCategory')
    .isIn(['SEASONAL', 'PROMOTIONAL', 'RETENTION', 'ACQUISITION', 'LOYALTY'])
    .withMessage('Valid template category is required'),
  body('promotions')
    .isArray({ min: 1 })
    .withMessage('At least one promotion is required'),
  body('promotions.*.type')
    .isIn(['DISCOUNT', 'COUPON', 'LOYALTY_POINTS', 'WALLET_CREDIT'])
    .withMessage('Invalid promotion type'),
  body('promotions.*.promotionId')
    .isMongoId()
    .withMessage('Valid promotion ID is required')
];

const updateCampaignValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Campaign name must be 2-100 characters'),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Valid start date is required'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('Valid end date is required'),
  body('status')
    .optional()
    .isIn(['DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'])
    .withMessage('Invalid campaign status'),
  body('applicableTenancies')
    .optional()
    .isArray()
    .withMessage('Applicable tenancies must be an array'),
  body('applicableTenancies.*')
    .optional()
    .isMongoId()
    .withMessage('Invalid tenancy ID')
];

const approvalValidation = [
  body('action')
    .isIn(['approve', 'reject'])
    .withMessage('Action must be approve or reject'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must not exceed 500 characters')
];

// Apply SuperAdmin authentication to all routes
router.use(protectSuperAdmin);

// Overview and utilities
router.get('/analytics', getCampaignAnalytics);
router.get('/tenancies', getTenanciesForSelection);

// Campaign CRUD routes
router.get('/', getAllCampaigns);
router.post('/global', createGlobalCampaignValidation, createGlobalCampaign);
router.post('/templates', createTemplateCampaignValidation, createTemplateCampaign);
router.put('/:campaignId', param('campaignId').isMongoId(), updateCampaignValidation, updateCampaign);
router.delete('/:campaignId', param('campaignId').isMongoId(), deleteCampaign);

// Campaign management
router.post('/:campaignId/approve', param('campaignId').isMongoId(), approvalValidation, approveCampaign);
router.post('/:campaignId/toggle', param('campaignId').isMongoId(), toggleCampaignStatus);

module.exports = router;