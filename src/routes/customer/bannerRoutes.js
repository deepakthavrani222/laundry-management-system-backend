const express = require('express');
const router = express.Router();
const bannerController = require('../../controllers/customer/bannerController');

// Public routes - no authentication required
router.get('/', bannerController.getActiveBanners);
router.post('/:id/impression', bannerController.recordBannerImpression);
router.post('/:id/click', bannerController.recordBannerClick);

module.exports = router;
