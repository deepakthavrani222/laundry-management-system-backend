const express = require('express');
const { protect, requirePermission } = require('../../middlewares/auth');
const { injectTenancyFromUser } = require('../../middlewares/tenancyMiddleware');
const { body, param } = require('express-validator');
const {
  getLoyaltyPrograms,
  getLoyaltyProgramById,
  createLoyaltyProgram,
  updateLoyaltyProgram,
  deleteLoyaltyProgram,
  getLoyaltyMembers,
  getLoyaltyMemberById,
  enrollUser,
  awardPoints,
  redeemPoints,
  getLoyaltyAnalytics,
  getLoyaltyStats
} = require('../../controllers/admin/loyaltyController');

const router = express.Router();

// Validation rules
const createProgramValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be 2-100 characters'),
  body('type')
    .isIn(['points', 'tiered', 'punch_card', 'cashback', 'subscription'])
    .withMessage('Invalid loyalty program type'),
  body('startDate')
    .isISO8601()
    .withMessage('Valid start date is required'),
  body('pointsConfig.earningRate')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Earning rate must be a positive number'),
  body('pointsConfig.redemptionRate')
    .optional()
    .isFloat({ min: 1 })
    .withMessage('Redemption rate must be at least 1'),
  body('tiers')
    .optional()
    .isArray()
    .withMessage('Tiers must be an array'),
  body('punchCardConfig.punchesRequired')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Punches required must be at least 1'),
  body('cashbackConfig.percentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Cashback percentage must be between 0 and 100'),
  body('subscriptionConfig.monthlyFee')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Monthly fee must be a positive number')
];

const updateProgramValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be 2-100 characters'),
  body('type')
    .optional()
    .isIn(['points', 'tiered', 'punch_card', 'cashback', 'subscription'])
    .withMessage('Invalid loyalty program type'),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Valid start date is required'),
  body('pointsConfig.earningRate')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Earning rate must be a positive number'),
  body('pointsConfig.redemptionRate')
    .optional()
    .isFloat({ min: 1 })
    .withMessage('Redemption rate must be at least 1')
];

const enrollUserValidation = [
  body('programId')
    .isMongoId()
    .withMessage('Valid program ID is required'),
  body('userId')
    .isMongoId()
    .withMessage('Valid user ID is required')
];

const awardPointsValidation = [
  body('points')
    .isInt({ min: 1 })
    .withMessage('Points must be a positive integer'),
  body('reason')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Reason must be 1-200 characters'),
  body('orderId')
    .optional()
    .isMongoId()
    .withMessage('Valid order ID is required')
];

const redeemPointsValidation = [
  body('points')
    .isInt({ min: 1 })
    .withMessage('Points must be a positive integer'),
  body('redemptionType')
    .isIn(['credit', 'discount', 'free_service', 'cashback'])
    .withMessage('Invalid redemption type'),
  body('value')
    .isFloat({ min: 0 })
    .withMessage('Redemption value must be a positive number')
];

// Apply authentication and tenancy injection
router.use(protect);
router.use(injectTenancyFromUser);

// Program routes
router.get('/programs/stats', getLoyaltyStats);
router.get('/programs', getLoyaltyPrograms);
router.get('/programs/:programId', param('programId').isMongoId(), getLoyaltyProgramById);
router.post('/programs', createProgramValidation, createLoyaltyProgram);
router.put('/programs/:programId', param('programId').isMongoId(), updateProgramValidation, updateLoyaltyProgram);
router.delete('/programs/:programId', param('programId').isMongoId(), deleteLoyaltyProgram);

// Member routes
router.get('/members', getLoyaltyMembers);
router.get('/members/:memberId', param('memberId').isMongoId(), getLoyaltyMemberById);
router.post('/members/enroll', enrollUserValidation, enrollUser);
router.post('/members/:memberId/award-points', param('memberId').isMongoId(), awardPointsValidation, awardPoints);
router.post('/members/:memberId/redeem-points', param('memberId').isMongoId(), redeemPointsValidation, redeemPoints);

// Analytics
router.get('/analytics', getLoyaltyAnalytics);

module.exports = router;