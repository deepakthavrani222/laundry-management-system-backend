const express = require('express');
const { protect, requirePermission } = require('../../middlewares/auth');
const { injectTenancyFromUser } = require('../../middlewares/tenancyMiddleware');
const { body, param } = require('express-validator');
const {
  getDiscounts,
  getDiscountById,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  toggleDiscountStatus,
  getDiscountAnalytics,
  applyDiscountsToOrder,
  getDiscountStats
} = require('../../controllers/admin/discountController');

const router = express.Router();

// Validation rules
const createDiscountValidation = [
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
    .withMessage('Valid end date is required')
    .custom((endDate, { req }) => {
      if (new Date(endDate) <= new Date(req.body.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    })
];

const updateDiscountValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be 2-100 characters'),
  body('rules')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one discount rule is required'),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Valid start date is required'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('Valid end date is required')
];

const applyDiscountsValidation = [
  body('order')
    .notEmpty()
    .withMessage('Order details are required'),
  body('order.totalAmount')
    .isFloat({ min: 0 })
    .withMessage('Order total amount must be a positive number'),
  body('userId')
    .isMongoId()
    .withMessage('Valid user ID is required')
];

// Apply authentication and tenancy injection
router.use(protect);
router.use(injectTenancyFromUser);

// Routes
router.get('/stats', getDiscountStats);
router.get('/', getDiscounts);
router.get('/:discountId', param('discountId').isMongoId(), getDiscountById);
router.post('/', createDiscountValidation, createDiscount);
router.put('/:discountId', param('discountId').isMongoId(), updateDiscountValidation, updateDiscount);
router.delete('/:discountId', param('discountId').isMongoId(), deleteDiscount);
router.patch('/:discountId/toggle', param('discountId').isMongoId(), toggleDiscountStatus);
router.get('/:discountId/analytics', param('discountId').isMongoId(), getDiscountAnalytics);
router.post('/apply', applyDiscountsValidation, applyDiscountsToOrder);

module.exports = router;