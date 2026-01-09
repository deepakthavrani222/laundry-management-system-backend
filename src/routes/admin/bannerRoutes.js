const express = require('express');
const router = express.Router();
const bannerController = require('../../controllers/admin/bannerController');
const { protect, restrictTo } = require('../../middlewares/auth');
const { upload } = require('../../services/imageUploadService');

// Apply admin authentication to all routes
router.use(protect);
router.use(restrictTo('admin'));

// Image Upload (must be before other routes to avoid conflict)
router.post('/upload-image', upload.single('image'), bannerController.uploadBannerImage);

// Get all promotions for dropdown
router.get('/promotions/all', bannerController.getAllPromotions);

// Template Routes
router.get('/templates/available', bannerController.getAvailableTemplates);
router.get('/templates/:id/validation-rules', bannerController.getTemplateValidationRules);

// Analytics (before /:id routes)
router.get('/analytics/overview', bannerController.getBannerAnalytics);

// Banner CRUD
router.post('/', bannerController.createBanner);
router.get('/', bannerController.getAllBanners);
router.get('/by-state/:state', bannerController.getBannersByState);

// Campaign Integration (before /:id routes)
router.get('/campaigns/:campaignId', bannerController.getBannersByCampaign);

// Banner Workflow (before /:id routes)
router.post('/:id/submit-approval', bannerController.submitForApproval);
router.patch('/:id/state', bannerController.changeBannerState);
router.get('/:id/analytics', bannerController.getBannerAnalyticsById);

// Single banner routes (must be last)
router.get('/:id', bannerController.getBannerById);
router.put('/:id', bannerController.updateBanner);
router.delete('/:id', bannerController.deleteBanner);

module.exports = router;
