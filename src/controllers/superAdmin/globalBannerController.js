const Banner = require('../../models/Banner');
const BannerTemplate = require('../../models/BannerTemplate');
const Campaign = require('../../models/Campaign');
const bannerValidationService = require('../../services/bannerValidationService');

/**
 * @route   POST /api/superadmin/global-banners
 * @desc    Create a global banner (Super Admin only)
 * @access  Super Admin
 */
exports.createGlobalBanner = async (req, res) => {
  try {
    const {
      templateId,
      position,
      content,
      imageUrl,
      imageAlt,
      mobileImageUrl,
      linkedCampaign,
      linkedPromotion,
      cta,
      priority,
      schedule
    } = req.body;

    console.log('📝 Creating global banner with data:', JSON.stringify(req.body, null, 2));

    // Validate template
    const template = await BannerTemplate.findById(templateId);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    if (template.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        message: 'Template is not active'
      });
    }

    // Validate position is allowed for template
    const positionValidation = bannerValidationService.validatePosition(position, template);
    if (!positionValidation.valid) {
      return res.status(400).json({
        success: false,
        message: positionValidation.message
      });
    }

    // Validate linked promotion (if provided)
    let promotionData = { type: 'none', id: null };
    
    if (linkedPromotion && linkedPromotion.type && linkedPromotion.id) {
      const { type, id } = linkedPromotion;
      
      console.log('🔍 Validating promotion:', type, id);
      
      // Validate promotion exists
      let promotionModel;
      switch (type) {
        case 'campaign':
          promotionModel = require('../../models/Campaign');
          break;
        case 'discount':
          promotionModel = require('../../models/Discount');
          break;
        case 'coupon':
          promotionModel = require('../../models/Coupon');
          break;
        case 'referral':
          const { ReferralProgram } = require('../../models/Referral');
          promotionModel = ReferralProgram;
          break;
        case 'loyalty':
          const { LoyaltyProgram } = require('../../models/LoyaltyProgram');
          promotionModel = LoyaltyProgram;
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid promotion type'
          });
      }
      
      const promotion = await promotionModel.findById(id);
      
      if (!promotion) {
        console.log('❌ Promotion not found:', type, id);
        return res.status(404).json({
          success: false,
          message: `${type.charAt(0).toUpperCase() + type.slice(1)} not found`
        });
      }
      
      console.log('✅ Promotion validated:', promotion.name || promotion.code);
      promotionData = { type, id };
    } else if (linkedCampaign) {
      // Backward compatibility - if linkedCampaign is provided
      const campaign = await Campaign.findById(linkedCampaign);

      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campaign not found'
        });
      }
      
      promotionData = { type: 'campaign', id: linkedCampaign };
    }

    // Create global banner
    const banner = await Banner.create({
      bannerScope: 'GLOBAL',
      template: templateId,
      templateType: template.type,
      position,
      content,
      imageUrl,
      imageAlt,
      mobileImageUrl,
      linkedPromotion: promotionData,
      linkedCampaign: linkedCampaign || (promotionData.type === 'campaign' ? promotionData.id : null),
      cta,
      priority: priority || 0,
      schedule,
      state: 'APPROVED', // Global banners are auto-approved
      approval: {
        required: false,
        status: 'APPROVED',
        approvedBy: req.user._id,
        approvedAt: new Date()
      },
      createdBy: req.user._id
    });

    console.log('✅ Global banner created:', banner._id);

    // Increment template usage
    await template.incrementUsage();

    // Auto-activate or schedule
    const now = new Date();
    if (schedule.startDate <= now && schedule.endDate >= now) {
      await banner.transitionState('ACTIVE', req.user._id);
    } else if (schedule.startDate > now) {
      await banner.transitionState('SCHEDULED', req.user._id);
    }

    res.status(201).json({
      success: true,
      message: 'Global banner created successfully',
      data: { banner }
    });
  } catch (error) {
    console.error('Error creating global banner:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create global banner'
    });
  }
};

/**
 * @route   GET /api/superadmin/global-banners
 * @desc    Get all global banners
 * @access  Super Admin
 */
exports.getGlobalBanners = async (req, res) => {
  try {
    const { state, position, templateType, sortBy = 'createdAt', order = 'desc' } = req.query;
    
    const query = { bannerScope: 'GLOBAL' };
    
    if (state) {
      query.state = state;
    }
    
    if (position) {
      query.position = position;
    }
    
    if (templateType) {
      query.templateType = templateType;
    }
    
    const sortOrder = order === 'asc' ? 1 : -1;
    const sortOptions = { [sortBy]: sortOrder };
    
    const banners = await Banner.find(query)
      .populate('template', 'name code type')
      .populate('linkedCampaign', 'name description startDate endDate')
      .populate('createdBy', 'name email')
      .sort(sortOptions);
    
    res.json({
      success: true,
      data: {
        banners,
        count: banners.length
      }
    });
  } catch (error) {
    console.error('Error fetching global banners:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch global banners'
    });
  }
};

/**
 * @route   GET /api/superadmin/all-banners
 * @desc    Get all banners (global + tenant)
 * @access  Super Admin
 */
exports.getAllBanners = async (req, res) => {
  try {
    const { 
      scope, 
      state, 
      position, 
      templateType, 
      tenancyId,
      search,
      page = 1, 
      limit = 20 
    } = req.query;
    
    const query = {};
    
    if (scope) {
      query.bannerScope = scope;
    }
    
    if (state) {
      query.state = state;
    }
    
    if (position) {
      query.position = position;
    }
    
    if (templateType) {
      query.templateType = templateType;
    }
    
    if (tenancyId) {
      query.tenancy = tenancyId;
    }
    
    if (search) {
      query.$or = [
        { 'content.title': { $regex: search, $options: 'i' } },
        { 'content.description': { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [banners, total] = await Promise.all([
      Banner.find(query)
        .populate('template', 'name code type')
        .populate('linkedCampaign', 'name')
        .populate('tenancy', 'name businessName')
        .populate('createdBy', 'name email')
        .sort({ bannerScope: 1, priority: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Banner.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: {
        banners,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching all banners:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banners'
    });
  }
};

/**
 * @route   PUT /api/superadmin/banners/:id
 * @desc    Update any banner (global or tenant)
 * @access  Super Admin
 */
exports.updateBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }
    
    const {
      content,
      imageUrl,
      imageAlt,
      mobileImageUrl,
      cta,
      priority,
      schedule
    } = req.body;
    
    // Update fields
    if (content) banner.content = { ...banner.content, ...content };
    if (imageUrl !== undefined) banner.imageUrl = imageUrl;
    if (imageAlt !== undefined) banner.imageAlt = imageAlt;
    if (mobileImageUrl !== undefined) banner.mobileImageUrl = mobileImageUrl;
    if (cta) banner.cta = { ...banner.cta, ...cta };
    if (priority !== undefined) banner.priority = priority;
    if (schedule) banner.schedule = { ...banner.schedule, ...schedule };
    
    banner.updatedBy = req.user._id;
    
    await banner.save();
    
    res.json({
      success: true,
      message: 'Banner updated successfully',
      data: { banner }
    });
  } catch (error) {
    console.error('Error updating banner:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update banner'
    });
  }
};

/**
 * @route   DELETE /api/superadmin/banners/:id
 * @desc    Delete any banner
 * @access  Super Admin
 */
exports.deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }
    
    await banner.deleteOne();
    
    res.json({
      success: true,
      message: 'Banner deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting banner:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete banner'
    });
  }
};

/**
 * @route   PATCH /api/superadmin/banners/:id/state
 * @desc    Change banner state (pause/resume/activate)
 * @access  Super Admin
 */
exports.changeBannerState = async (req, res) => {
  try {
    let { newState } = req.body;
    
    const banner = await Banner.findById(req.params.id);
    
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }
    
    // Smart state transition - if no newState provided, toggle between ACTIVE and PAUSED
    if (!newState) {
      const currentState = banner.state;
      
      // Determine next state based on current state
      if (currentState === 'ACTIVE') {
        newState = 'PAUSED';
      } else if (currentState === 'PAUSED') {
        newState = 'ACTIVE';
      } else if (currentState === 'APPROVED' || currentState === 'SCHEDULED') {
        newState = 'ACTIVE';
      } else if (currentState === 'DRAFT') {
        newState = 'PENDING_APPROVAL';
      } else {
        return res.status(400).json({
          success: false,
          message: `Cannot toggle state from ${currentState}. Please specify newState.`
        });
      }
    }
    
    // Validate and perform state transition
    await banner.transitionState(newState, req.user._id);
    
    res.json({
      success: true,
      message: `Banner state changed to ${newState}`,
      data: { banner }
    });
  } catch (error) {
    console.error('Error changing banner state:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to change banner state'
    });
  }
};

/**
 * @route   POST /api/superadmin/banners/:id/emergency-disable
 * @desc    Emergency disable any banner
 * @access  Super Admin
 */
exports.emergencyDisable = async (req, res) => {
  try {
    const { reason } = req.body;
    
    const banner = await Banner.findById(req.params.id);
    
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }
    
    // Force to PAUSED state
    if (banner.state === 'ACTIVE') {
      await banner.transitionState('PAUSED', req.user._id);
    }
    
    banner.isActive = false;
    banner.approval.rejectionReason = reason || 'Emergency disabled by Super Admin';
    banner.updatedBy = req.user._id;
    
    await banner.save();
    
    res.json({
      success: true,
      message: 'Banner emergency disabled successfully',
      data: { banner }
    });
  } catch (error) {
    console.error('Error emergency disabling banner:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disable banner'
    });
  }
};

/**
 * @route   GET /api/superadmin/banners/analytics/platform
 * @desc    Get platform-wide banner analytics
 * @access  Super Admin
 */
exports.getPlatformAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, scope } = req.query;
    
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }
    
    const scopeFilter = scope ? { bannerScope: scope } : {};
    
    // Overall stats by scope
    const overallStats = await Banner.aggregate([
      { $match: { ...dateFilter, ...scopeFilter } },
      {
        $group: {
          _id: '$bannerScope',
          totalBanners: { $sum: 1 },
          activeBanners: { $sum: { $cond: [{ $eq: ['$state', 'ACTIVE'] }, 1, 0] } },
          totalImpressions: { $sum: '$analytics.impressions' },
          totalClicks: { $sum: '$analytics.clicks' },
          totalConversions: { $sum: '$analytics.conversions' },
          totalRevenue: { $sum: '$analytics.revenue' }
        }
      }
    ]);
    
    // Stats by template type
    const templateTypeStats = await Banner.aggregate([
      { $match: { ...dateFilter, ...scopeFilter } },
      {
        $group: {
          _id: '$templateType',
          count: { $sum: 1 },
          totalImpressions: { $sum: '$analytics.impressions' },
          totalClicks: { $sum: '$analytics.clicks' },
          avgCTR: {
            $avg: {
              $cond: [
                { $gt: ['$analytics.impressions', 0] },
                { $multiply: [{ $divide: ['$analytics.clicks', '$analytics.impressions'] }, 100] },
                0
              ]
            }
          }
        }
      }
    ]);
    
    // Stats by position
    const positionStats = await Banner.aggregate([
      { $match: { ...dateFilter, ...scopeFilter, state: 'ACTIVE' } },
      {
        $group: {
          _id: '$position',
          count: { $sum: 1 },
          totalImpressions: { $sum: '$analytics.impressions' },
          totalClicks: { $sum: '$analytics.clicks' }
        }
      },
      { $sort: { totalImpressions: -1 } }
    ]);
    
    // Top performing banners
    const topBanners = await Banner.find({
      ...dateFilter,
      ...scopeFilter,
      state: 'ACTIVE'
    })
      .sort({ 'analytics.conversions': -1 })
      .limit(10)
      .populate('template', 'name type')
      .populate('tenancy', 'name')
      .select('content.title bannerScope analytics position');
    
    res.json({
      success: true,
      data: {
        overall: overallStats,
        byTemplateType: templateTypeStats,
        byPosition: positionStats,
        topPerformers: topBanners
      }
    });
  } catch (error) {
    console.error('Error fetching platform analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch platform analytics'
    });
  }
};

/**
 * @route   GET /api/superadmin/banners/:id/analytics
 * @desc    Get individual banner analytics
 * @access  Super Admin
 */
exports.getBannerAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const { timeRange } = req.query;

    const banner = await Banner.findById(id)
      .populate('template', 'name type')
      .populate('tenancy', 'name slug');

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    // Calculate date range based on timeRange parameter
    let startDate = new Date(banner.schedule.startDate);
    const now = new Date();

    if (timeRange) {
      switch (timeRange) {
        case '24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case 'all':
        default:
          startDate = new Date(banner.schedule.startDate);
      }
    }

    // Get analytics data
    const analytics = {
      impressions: banner.analytics?.impressions || 0,
      clicks: banner.analytics?.clicks || 0,
      ctr: banner.analytics?.ctr || 0,
      conversions: banner.analytics?.conversions || 0,
      uniqueUsers: banner.analytics?.uniqueUsers || 0,
      revenue: banner.analytics?.revenue || 0,
      avgTimeOnBanner: banner.analytics?.avgTimeOnBanner || 0,
      dismissCount: banner.analytics?.dismissCount || 0
    };

    // Calculate additional metrics
    const conversionRate = analytics.impressions > 0 
      ? ((analytics.conversions / analytics.impressions) * 100).toFixed(2)
      : 0;

    const engagementRate = analytics.impressions > 0
      ? ((analytics.clicks / analytics.impressions) * 100).toFixed(2)
      : 0;

    const avgRevenuePerConversion = analytics.conversions > 0
      ? (analytics.revenue / analytics.conversions).toFixed(2)
      : 0;

    res.json({
      success: true,
      data: {
        banner: {
          id: banner._id,
          title: banner.content?.title,
          templateType: banner.templateType,
          position: banner.position,
          scope: banner.bannerScope,
          state: banner.state,
          priority: banner.priority,
          schedule: banner.schedule,
          tenancy: banner.tenancy
        },
        analytics,
        metrics: {
          conversionRate: parseFloat(conversionRate),
          engagementRate: parseFloat(engagementRate),
          avgRevenuePerConversion: parseFloat(avgRevenuePerConversion)
        },
        timeRange: {
          start: startDate,
          end: now
        }
      }
    });
  } catch (error) {
    console.error('Error fetching banner analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banner analytics'
    });
  }
};


/**
 * @route   GET /api/superadmin/banners/promotions/all
 * @desc    Get all promotions (campaigns, discounts, coupons, referrals, loyalty) for SuperAdmin
 * @access  Super Admin
 */
exports.getAllPromotions = async (req, res) => {
  try {
    console.log('📋 SuperAdmin fetching all promotions (global + all tenants)');

    // Import models
    const Campaign = require('../../models/Campaign');
    const Discount = require('../../models/Discount');
    const Coupon = require('../../models/Coupon');
    const { ReferralProgram } = require('../../models/Referral');
    const { LoyaltyProgram } = require('../../models/LoyaltyProgram');

    // Fetch all promotions (global + all tenants) with error handling
    const [campaigns, discounts, coupons, referrals, loyaltyPrograms] = await Promise.allSettled([
      Campaign.find({ status: { $in: ['DRAFT', 'ACTIVE', 'SCHEDULED'] } })
        .select('name description startDate endDate status tenancy')
        .populate('tenancy', 'name businessName')
        .sort({ createdAt: -1 })
        .lean(),
      
      Discount.find({ isActive: true })
        .select('name description startDate endDate tenancy')
        .populate('tenancy', 'name businessName')
        .sort({ createdAt: -1 })
        .lean(),
      
      Coupon.find({ isActive: true })
        .select('code name description startDate endDate tenancy')
        .populate('tenancy', 'name businessName')
        .sort({ createdAt: -1 })
        .lean(),
      
      ReferralProgram.find({ isActive: true })
        .select('name description startDate endDate tenancy')
        .populate('tenancy', 'name businessName')
        .sort({ createdAt: -1 })
        .lean(),
      
      LoyaltyProgram.find({ isActive: true })
        .select('name description type startDate endDate tenancy')
        .populate('tenancy', 'name businessName')
        .sort({ createdAt: -1 })
        .lean()
    ]);

    console.log('✅ Campaigns:', campaigns.status, campaigns.status === 'fulfilled' ? campaigns.value.length : campaigns.reason);
    console.log('✅ Discounts:', discounts.status, discounts.status === 'fulfilled' ? discounts.value.length : discounts.reason);
    console.log('✅ Coupons:', coupons.status, coupons.status === 'fulfilled' ? coupons.value.length : coupons.reason);
    console.log('✅ Referrals:', referrals.status, referrals.status === 'fulfilled' ? referrals.value.length : referrals.reason);
    console.log('✅ Loyalty:', loyaltyPrograms.status, loyaltyPrograms.status === 'fulfilled' ? loyaltyPrograms.value.length : loyaltyPrograms.reason);

    // Format for dropdown - handle both success and failure
    const promotions = {
      campaigns: campaigns.status === 'fulfilled' ? campaigns.value.map(c => ({
        id: c._id.toString(),
        type: 'campaign',
        name: `${c.name} ${c.tenancy?.name ? `(${c.tenancy.name})` : ''}`,
        description: c.description,
        status: c.status,
        startDate: c.startDate,
        endDate: c.endDate,
        tenancy: c.tenancy
      })) : [],
      
      discounts: discounts.status === 'fulfilled' ? discounts.value.map(d => ({
        id: d._id.toString(),
        type: 'discount',
        name: `${d.name} ${d.tenancy?.name ? `(${d.tenancy.name})` : ''}`,
        description: d.description,
        startDate: d.startDate,
        endDate: d.endDate,
        tenancy: d.tenancy
      })) : [],
      
      coupons: coupons.status === 'fulfilled' ? coupons.value.map(c => ({
        id: c._id.toString(),
        type: 'coupon',
        name: `${c.code} - ${c.name} ${c.tenancy?.name ? `(${c.tenancy.name})` : ''}`,
        description: c.description,
        startDate: c.startDate,
        endDate: c.endDate,
        tenancy: c.tenancy
      })) : [],
      
      referrals: referrals.status === 'fulfilled' ? referrals.value.map(r => ({
        id: r._id.toString(),
        type: 'referral',
        name: `${r.name} ${r.tenancy?.name ? `(${r.tenancy.name})` : ''}`,
        description: r.description,
        startDate: r.startDate,
        endDate: r.endDate,
        tenancy: r.tenancy
      })) : [],
      
      loyalty: loyaltyPrograms.status === 'fulfilled' ? loyaltyPrograms.value.map(l => ({
        id: l._id.toString(),
        type: 'loyalty',
        name: `${l.name} (${l.type}) ${l.tenancy?.name ? `(${l.tenancy.name})` : ''}`,
        description: l.description,
        startDate: l.startDate,
        endDate: l.endDate,
        tenancy: l.tenancy
      })) : []
    };

    console.log('📦 Returning promotions:', {
      campaigns: promotions.campaigns.length,
      discounts: promotions.discounts.length,
      coupons: promotions.coupons.length,
      referrals: promotions.referrals.length,
      loyalty: promotions.loyalty.length
    });

    res.json({
      success: true,
      data: promotions
    });
  } catch (error) {
    console.error('❌ Error fetching promotions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch promotions',
      error: error.message
    });
  }
};


/**
 * @route   POST /api/superadmin/banners/upload-image
 * @desc    Upload banner image for SuperAdmin
 * @access  Super Admin
 */
exports.uploadBannerImage = async (req, res) => {
  try {
    const imageUploadService = require('../../services/imageUploadService');
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    // Upload and optimize image
    const result = await imageUploadService.uploadImage(
      req.file.buffer,
      req.file.originalname,
      {
        width: 1200,
        quality: 85,
        format: 'webp',
        folder: 'uploads/banners'
      }
    );

    res.json({
      success: true,
      data: {
        url: result.url,
        filename: result.filename,
        size: result.size,
        dimensions: {
          width: result.width,
          height: result.height
        }
      }
    });
  } catch (error) {
    console.error('Error uploading banner image:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload image'
    });
  }
};
