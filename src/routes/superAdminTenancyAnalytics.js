const express = require('express');
const router = express.Router();
const tenancyAnalyticsController = require('../controllers/superAdmin/tenancyAnalyticsController');
const { authenticateSuperAdmin, requirePermission } = require('../middlewares/superAdminAuth');

// All routes require superadmin authentication
router.use(authenticateSuperAdmin);

// Platform-wide analytics
router.get('/platform', requirePermission('analytics'), tenancyAnalyticsController.getPlatformAnalytics);

// Compare tenancies
router.post('/compare', requirePermission('analytics'), tenancyAnalyticsController.compareTenancies);

// Single tenancy analytics
router.get('/:tenancyId', requirePermission('analytics'), tenancyAnalyticsController.getTenancyAnalytics);

module.exports = router;
