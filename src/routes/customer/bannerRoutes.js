const express = require('express');
const router = express.Router();
const bannerController = require('../../controllers/customer/bannerController');
const { protect, optionalAuth } = require('../../middlewares/auth');

// Public routes (no auth required)
router.get('/position/:position', bannerController.getBannersByPosition);
router.get('/page/:page', bannerController.getBannersByPage);
router.get('/active-campaigns', bannerController.getActiveCampaignBanners);
router.post('/:id/impression', bannerController.recordImpression);
router.post('/:id/click', bannerController.recordClick);

// Private routes (customer auth required)
router.post('/:id/conversion', protect, bannerController.recordConversion);

module.exports = router;
