const express = require('express');
const { protectSuperAdmin } = require('../middlewares/auth');
const { body, param } = require('express-validator');
const {
  getGlobalDiscounts,
  createGlobalDiscount,
  updateGlobalDiscount,
  deleteGlobalDiscount,
  getGlobalCoupons,
  createGlobalCoupon,
  updateGlobalCoupon,
  deleteGlobalCoupon,
  getGlobalReferralPrograms,
  createGlobalReferralProgram,
  updateGlobalReferralProgram,
  deleteGlobalReferralProgram,
  getGlobalLoyaltyPrograms,
  createGlobalLoyaltyProgram,
  updateGlobalLoyaltyProgram,
  deleteGlobalLoyaltyProgram,
  getPromotionalOverview,
  getTenanciesForSelection
} = require('../controllers/superAdmin/promotionalController');

const router = express.Router();

// Validation rules
const createGlobalDiscountValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be 2-100 characters'),
  body('rules')
    .isArray({ min: 1 })
    .withMessage('At least one discount rule is required'),
  body('rules.*.type')
    .isIn(['percentage', 'fixed_amount', 'tiered', 'conditional'])
    .withMessage('Invalid discount rule type'),
  body('rules.*.value')
    .isFloat({ min: 0 })
    .withMessage('Discount value must be a positive number'),
  body('startDate')
    .isISO8601()
    .withMessage('Valid start date is required'),
  body('endDate')
    .isISO8601()
    .withMessage('Valid end date is required'),
  body('applicableTenancies')
    .optional()
    .isArray()
    .withMessage('Applicable tenancies must be an array'),
  body('applicableTenancies.*')
    .optional()
    .isMongoId()
    .withMessage('Invalid tenancy ID')
];

const createGlobalCouponValidation = [
  body('code')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Coupon code must be 3-20 characters')
    .matches(/^[A-Z0-9]+$/)
    .withMessage('Coupon code must contain only uppercase letters and numbers'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be 2-100 characters'),
  body('type')
    .isIn(['percentage', 'fixed_amount'])
    .withMessage('Invalid coupon type'),
  body('value')
    .isFloat({ min: 0 })
    .withMessage('Coupon value must be a positive number'),
  body('startDate')
    .isISO8601()
    .withMessage('Valid start date is required'),
  body('endDate')
    .isISO8601()
    .withMessage('Valid end date is required'),
  body('applicableTenancies')
    .optional()
    .isArray()
    .withMessage('Applicable tenancies must be an array'),
  body('applicableTenancies.*')
    .optional()
    .isMongoId()
    .withMessage('Invalid tenancy ID')
];

const createGlobalReferralValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be 2-100 characters'),
  body('referrerReward.type')
    .isIn(['credit', 'coupon', 'discount', 'points', 'free_service'])
    .withMessage('Invalid referrer reward type'),
  body('referrerReward.value')
    .isFloat({ min: 0 })
    .withMessage('Referrer reward value must be a positive number'),
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
    .withMessage('Valid end date is required'),
  body('applicableTenancies')
    .optional()
    .isArray()
    .withMessage('Applicable tenancies must be an array'),
  body('applicableTenancies.*')
    .optional()
    .isMongoId()
    .withMessage('Invalid tenancy ID')
];

const createGlobalLoyaltyValidation = [
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
  body('applicableTenancies')
    .optional()
    .isArray()
    .withMessage('Applicable tenancies must be an array'),
  body('applicableTenancies.*')
    .optional()
    .isMongoId()
    .withMessage('Invalid tenancy ID')
];

// Apply SuperAdmin authentication
router.use(protectSuperAdmin);

// Overview and utilities
router.get('/overview', getPromotionalOverview);
router.get('/tenancies', getTenanciesForSelection);

// Global Discounts
router.get('/discounts', getGlobalDiscounts);
router.post('/discounts', createGlobalDiscountValidation, createGlobalDiscount);
router.put('/discounts/:discountId', param('discountId').isMongoId(), updateGlobalDiscount);
router.delete('/discounts/:discountId', param('discountId').isMongoId(), deleteGlobalDiscount);

// Global Coupons
router.get('/coupons', getGlobalCoupons);
router.post('/coupons', createGlobalCouponValidation, createGlobalCoupon);
router.put('/coupons/:couponId', param('couponId').isMongoId(), updateGlobalCoupon);
router.delete('/coupons/:couponId', param('couponId').isMongoId(), deleteGlobalCoupon);

// Global Referral Programs
router.get('/referrals', getGlobalReferralPrograms);
router.post('/referrals', createGlobalReferralValidation, createGlobalReferralProgram);
router.put('/referrals/:programId', param('programId').isMongoId(), updateGlobalReferralProgram);
router.delete('/referrals/:programId', param('programId').isMongoId(), deleteGlobalReferralProgram);

// Global Loyalty Programs
router.get('/loyalty', getGlobalLoyaltyPrograms);
router.post('/loyalty', createGlobalLoyaltyValidation, createGlobalLoyaltyProgram);
router.put('/loyalty/:programId', param('programId').isMongoId(), updateGlobalLoyaltyProgram);
router.delete('/loyalty/:programId', param('programId').isMongoId(), deleteGlobalLoyaltyProgram);

module.exports = router;