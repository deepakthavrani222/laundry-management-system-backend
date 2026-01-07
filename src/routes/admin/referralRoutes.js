const express = require('express');
const { protect, requirePermission } = require('../../middlewares/auth');
const { injectTenancyFromUser } = require('../../middlewares/tenancyMiddleware');
const { body, param } = require('express-validator');
const {
  getReferralPrograms,
  getReferralProgramById,
  createReferralProgram,
  updateReferralProgram,
  deleteReferralProgram,
  getReferrals,
  createReferral,
  processReferral,
  getReferralAnalytics,
  getReferralStats
} = require('../../controllers/admin/referralController');

const router = express.Router();

// Validation rules
const createProgramValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be 2-100 characters'),
  body('referrerReward')
    .notEmpty()
    .withMessage('Referrer reward is required'),
  body('referrerReward.type')
    .isIn(['credit', 'coupon', 'discount', 'points', 'free_service'])
    .withMessage('Invalid referrer reward type'),
  body('referrerReward.value')
    .isFloat({ min: 0 })
    .withMessage('Referrer reward value must be a positive number'),
  body('refereeReward')
    .notEmpty()
    .withMessage('Referee reward is required'),
  body('refereeReward.type')
    .isIn(['credit', 'coupon', 'discount', 'points', 'free_service'])
    .withMessage('Invalid referee reward type'),
  body('refereeReward.value')
    .isFloat({ min: 0 })
    .withMessage('Referee reward value must be a positive number'),
  body('startDate')
    .isISO8601()
    .withMessage('Valid start date is required'),
  body('endDate')
    .isISO8601()
    .withMessage('Valid end date is required')
    .custom((endDate, { req }) => {
      if (new Date(endDate) <= new Date(req.body.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    })
];

const updateProgramValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be 2-100 characters'),
  body('referrerReward.type')
    .optional()
    .isIn(['credit', 'coupon', 'discount', 'points', 'free_service'])
    .withMessage('Invalid referrer reward type'),
  body('referrerReward.value')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Referrer reward value must be a positive number'),
  body('refereeReward.type')
    .optional()
    .isIn(['credit', 'coupon', 'discount', 'points', 'free_service'])
    .withMessage('Invalid referee reward type'),
  body('refereeReward.value')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Referee reward value must be a positive number'),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Valid start date is required'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('Valid end date is required')
];

const createReferralValidation = [
  body('programId')
    .isMongoId()
    .withMessage('Valid program ID is required'),
  body('userId')
    .isMongoId()
    .withMessage('Valid user ID is required')
];

const processReferralValidation = [
  body('referralCode')
    .trim()
    .notEmpty()
    .withMessage('Referral code is required'),
  body('orderId')
    .isMongoId()
    .withMessage('Valid order ID is required')
];

// Apply authentication and tenancy injection
router.use(protect);
router.use(injectTenancyFromUser);

// Program routes
router.get('/programs/stats', getReferralStats);
router.get('/programs', getReferralPrograms);
router.get('/programs/:programId', param('programId').isMongoId(), getReferralProgramById);
router.post('/programs', createProgramValidation, createReferralProgram);
router.put('/programs/:programId', param('programId').isMongoId(), updateProgramValidation, updateReferralProgram);
router.delete('/programs/:programId', param('programId').isMongoId(), deleteReferralProgram);

// Referral routes
router.get('/', getReferrals);
router.post('/', createReferralValidation, createReferral);
router.post('/process', processReferralValidation, processReferral);
router.get('/analytics', getReferralAnalytics);

module.exports = router;