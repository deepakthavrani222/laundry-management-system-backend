const express = require('express');
const router = express.Router();
const { protectSuperAdmin } = require('../../middlewares/auth');
const { upload } = require('../../services/imageUploadService');

// Import all banner-related controllers
const bannerTemplateController = require('../../controllers/superAdmin/bannerTemplateController');
const bannerApprovalController = require('../../controllers/superAdmin/bannerApprovalController');
const globalBannerController = require('../../controllers/superAdmin/globalBannerController');

// Apply super admin authentication to all routes
router.use(protectSuperAdmin);

// Debug middleware to log all requests
router.use((req, res, next) => {
  console.log('🔍 Banner Route:', req.method, req.path);
  next();
});

// ============================================
// GET ALL PROMOTIONS (Must be before other routes)
// ============================================
router.get('/promotions/all', globalBannerController.getAllPromotions);

// ============================================
// IMAGE UPLOAD (Must be before other routes)
// ============================================
router.post('/upload-image', upload.single('image'), globalBannerController.uploadBannerImage);

// ============================================
// BANNER TEMPLATES
// ============================================
router.post('/banner-templates', bannerTemplateController.createTemplate);
router.get('/banner-templates', bannerTemplateController.getAllTemplates);
router.get('/banner-templates/stats/usage', bannerTemplateController.getTemplateStats);
router.get('/banner-templates/by-type/:type', bannerTemplateController.getTemplatesByType);
router.get('/banner-templates/:id', bannerTemplateController.getTemplateById);
router.put('/banner-templates/:id', bannerTemplateController.updateTemplate);
router.delete('/banner-templates/:id', bannerTemplateController.deleteTemplate);
router.patch('/banner-templates/:id/status', bannerTemplateController.toggleTemplateStatus);

// ============================================
// BANNER APPROVAL (Must be before generic /banners/:id routes)
// ============================================
router.get('/banners/pending', bannerApprovalController.getPendingBanners);
router.get('/banners/approval-history', bannerApprovalController.getApprovalHistory);
router.get('/banners/approval-stats', bannerApprovalController.getApprovalStats);
router.post('/banners/bulk-approve', bannerApprovalController.bulkApproveBanners);

// ============================================
// GLOBAL BANNERS & MANAGEMENT
// ============================================
router.post('/global-banners', globalBannerController.createGlobalBanner);
router.get('/global-banners', globalBannerController.getGlobalBanners);
router.get('/all-banners', globalBannerController.getAllBanners);
router.get('/analytics/platform', globalBannerController.getPlatformAnalytics);

// Specific banner actions (MUST be before /:id routes)
router.post('/:id/emergency-disable', globalBannerController.emergencyDisable);
router.patch('/:id/state', globalBannerController.changeBannerState);
router.get('/:id/review', bannerApprovalController.getBannerForReview);
router.post('/:id/approve', bannerApprovalController.approveBanner);
router.post('/:id/reject', bannerApprovalController.rejectBanner);

// Generic banner CRUD (must be last)
router.put('/:id', globalBannerController.updateBanner);
router.delete('/:id', globalBannerController.deleteBanner);

module.exports = router;
