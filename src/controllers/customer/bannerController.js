const Banner = require('../../models/Banner');

/**
 * @route   GET /api/customer/banners/position/:position
 * @desc    Get active banners for a specific position
 * @access  Public
 */
exports.getBannersByPosition = async (req, res) => {
  try {
    const { position } = req.params;
    const tenancyId = req.tenancyId; // From subdomain middleware
    
    // Get banners for this position
    const banners = await Banner.getActiveBannersByPosition(position, tenancyId);
    
    // Filter based on template type and position settings
    const filteredBanners = banners.filter(banner => {
      // Check responsive settings based on device (could be enhanced with user-agent detection)
      return banner.isActive;
    });
    
    // For SLIDER positions, return multiple banners
    // For other positions, return only the highest priority banner
    let result = filteredBanners;
    
    if (!position.includes('SLIDER') && !position.includes('CARD_GRID')) {
      result = filteredBanners.slice(0, 1); // Only top priority banner
    }
    
    // Populate necessary fields
    const populatedBanners = await Banner.populate(result, [
      { path: 'template', select: 'name code type layout design settings responsive' },
      { path: 'linkedCampaign', select: 'name description startDate endDate' }
    ]);
    
    // Add cache control headers to prevent browser caching
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    });
    
    res.json({
      success: true,
      data: {
        position,
        banners: populatedBanners,
        count: populatedBanners.length
      }
    });
  } catch (error) {
    console.error('Error fetching banners by position:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banners'
    });
  }
};

/**
 * @route   POST /api/customer/banners/:id/impression
 * @desc    Record banner impression
 * @access  Public
 */
exports.recordImpression = async (req, res) => {
  try {
    const { id } = req.params;
    
    const banner = await Banner.findById(id);
    
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }
    
    // Record impression
    await banner.recordImpression();
    
    res.json({
      success: true,
      message: 'Impression recorded',
      data: {
        impressions: banner.analytics.impressions
      }
    });
  } catch (error) {
    console.error('Error recording impression:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record impression'
    });
  }
};

/**
 * @route   POST /api/customer/banners/:id/click
 * @desc    Record banner click
 * @access  Public
 */
exports.recordClick = async (req, res) => {
  try {
    const { id } = req.params;
    
    const banner = await Banner.findById(id);
    
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }
    
    // Record click
    await banner.recordClick();
    
    // Return campaign link if available
    const campaignLink = banner.cta?.link || '/offers';
    
    res.json({
      success: true,
      message: 'Click recorded',
      data: {
        clicks: banner.analytics.clicks,
        redirectUrl: campaignLink
      }
    });
  } catch (error) {
    console.error('Error recording click:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record click'
    });
  }
};

/**
 * @route   GET /api/customer/banners/page/:page
 * @desc    Get all active banners for a page (all positions)
 * @access  Public
 */
exports.getBannersByPage = async (req, res) => {
  try {
    const { page } = req.params; // e.g., 'HOME', 'SERVICES', 'OFFERS'
    const tenancyId = req.tenancyId;
    
    // Get all positions for this page
    const pagePositions = {
      HOME: ['HOME_HERO_TOP', 'HOME_SLIDER_MID', 'HOME_STRIP_TOP', 'HOME_STRIP_BOTTOM', 'HOME_CARD_SIDEBAR'],
      SERVICES: ['SERVICES_HERO_TOP', 'SERVICES_SLIDER_MID', 'SERVICES_CARD_GRID'],
      OFFERS: ['OFFERS_HERO_TOP', 'OFFERS_SLIDER_MID', 'OFFERS_CARD_GRID'],
      CHECKOUT: ['CHECKOUT_STRIP_TOP', 'CHECKOUT_CARD_SIDEBAR'],
      DASHBOARD: ['DASHBOARD_HERO_TOP', 'DASHBOARD_CARD_GRID'],
      LOGIN: ['LOGIN_HERO_SIDE', 'LOGIN_STRIP_TOP']
    };
    
    const positions = pagePositions[page.toUpperCase()] || [];
    
    // Also include global positions
    const globalPositions = ['GLOBAL_STRIP_TOP', 'GLOBAL_MODAL_CENTER', 'GLOBAL_FLOATING_CORNER'];
    const allPositions = [...positions, ...globalPositions];
    
    // Fetch banners for all positions
    const bannersByPosition = {};
    
    for (const position of allPositions) {
      const banners = await Banner.getActiveBannersByPosition(position, tenancyId);
      
      if (banners.length > 0) {
        // Populate
        const populated = await Banner.populate(banners, [
          { path: 'template', select: 'name code type layout design settings responsive' },
          { path: 'linkedCampaign', select: 'name description' }
        ]);
        
        bannersByPosition[position] = populated;
      }
    }
    
    // Add cache control headers to prevent browser caching
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    });
    
    res.json({
      success: true,
      data: {
        page,
        bannersByPosition
      }
    });
  } catch (error) {
    console.error('Error fetching banners by page:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banners'
    });
  }
};

/**
 * @route   POST /api/customer/banners/:id/conversion
 * @desc    Record banner conversion (when order is placed)
 * @access  Private (Customer)
 */
exports.recordConversion = async (req, res) => {
  try {
    const { id } = req.params;
    const { orderValue } = req.body;
    
    const banner = await Banner.findById(id);
    
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }
    
    // Record conversion
    const result = await banner.recordConversion(orderValue || 0);
    
    res.json({
      success: true,
      message: 'Conversion recorded',
      data: result
    });
  } catch (error) {
    console.error('Error recording conversion:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record conversion'
    });
  }
};

/**
 * @route   GET /api/customer/banners/active-campaigns
 * @desc    Get all active campaign banners
 * @access  Public
 */
exports.getActiveCampaignBanners = async (req, res) => {
  try {
    const tenancyId = req.tenancyId;
    const now = new Date();
    
    const banners = await Banner.find({
      $or: [
        { tenancy: tenancyId, bannerScope: 'TENANT' },
        { bannerScope: 'GLOBAL' }
      ],
      state: 'ACTIVE',
      isActive: true,
      'schedule.startDate': { $lte: now },
      'schedule.endDate': { $gte: now }
    })
      .populate('template', 'name code type')
      .populate('linkedCampaign', 'name description startDate endDate')
      .sort({ priority: -1 });
    
    // Add cache control headers to prevent browser caching
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    });
    
    res.json({
      success: true,
      data: {
        banners,
        count: banners.length
      }
    });
  } catch (error) {
    console.error('Error fetching active campaign banners:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banners'
    });
  }
};
