const express = require('express');
const { protect, restrictTo } = require('../middlewares/auth');
const { body, param } = require('express-validator');
const {
  getTenantCampaigns,
  createTenantCampaign,
  updateTenantCampaign,
  deleteTenantCampaign,
  getTenantCampaignAnalytics,
  createFromTemplate,
  getAvailableTemplates
} = require('../controllers/admin/campaignController');

const router = express.Router();

// Validation rules
const createCampaignValidation = [
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
  body('budget.type')
    .optional()
    .isIn(['UNLIMITED', 'FIXED_AMOUNT', 'PER_USER', 'PERCENTAGE_OF_REVENUE'])
    .withMessage('Invalid budget type'),
  body('audience.targetType')
    .optional()
    .isIn(['ALL_USERS', 'NEW_USERS', 'EXISTING_USERS', 'SEGMENT', 'CUSTOM'])
    .withMessage('Invalid audience target type')
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
    .withMessage('Invalid campaign status')
];

// Apply Admin authentication to all routes
router.use(protect);
router.use(restrictTo('admin'));

// Campaign CRUD routes
router.get('/', getTenantCampaigns);
router.post('/', createCampaignValidation, createTenantCampaign);
router.put('/:campaignId', param('campaignId').isMongoId(), updateCampaignValidation, updateTenantCampaign);
router.delete('/:campaignId', param('campaignId').isMongoId(), deleteTenantCampaign);

// Analytics
router.get('/analytics', getTenantCampaignAnalytics);

// Template operations
router.get('/templates', getAvailableTemplates);
router.post('/templates/:templateId/create', 
  param('templateId').isMongoId(),
  body('customizations').optional().isObject(),
  createFromTemplate
);

module.exports = router;