const Banner = require('../../models/Banner');
const BannerTemplate = require('../../models/BannerTemplate');
const Campaign = require('../../models/Campaign');
const bannerValidationService = require('../../services/bannerValidationService');
const bannerLifecycleService = require('../../services/bannerLifecycleService');

/**
 * @route   GET /api/admin/banner-templates/available
 * @desc    Get available templates for admin
 * @access  Admin
 */
exports.getAvailableTemplates = async (req, res) => {
  try {
    const { type } = req.query;
    
    const query = { status: 'ACTIVE' };
    
    if (type) {
      query.type = type;
    }
    
    const templates = await BannerTemplate.find(query)
      .select('-createdBy -updatedBy')
      .sort({ type: 1, name: 1 });
    
    res.json({
      success: true,
      data: {
        templates,
        count: templates.length
      }
    });
  } catch (error) {
    console.error('Error fetching available templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch templates'
    });
  }
};

/**
 * @route   GET /api/admin/banner-templates/:id/validation-rules
 * @desc    Get validation rules for a template
 * @access  Admin
 */
exports.getTemplateValidationRules = async (req, res) => {
  try {
    const result = await bannerValidationService.getValidationRules(req.params.id);
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching validation rules:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch validation rules'
    });
  }
};

/**
 * @route   POST /api/admin/banners
 * @desc    Create a new banner (template-based)
 * @access  Admin
 */
exports.createBanner = async (req, res) => {
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

    console.log('📝 Creating banner with data:');
    console.log('  - templateId:', templateId);
    console.log('  - position:', position);
    console.log('  - imageUrl:', imageUrl);
    console.log('  - linkedCampaign:', linkedCampaign);
    console.log('  - linkedPromotion:', linkedPromotion);
    console.log('  - Full body:', JSON.stringify(req.body, null, 2));

    const tenancyId = req.user.tenancy;

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

    // Validate position is NOT global
    if (position.startsWith('GLOBAL_')) {
      return res.status(403).json({
        success: false,
        message: 'Cannot create banners for GLOBAL positions. Only Super Admin can create global banners.'
      });
    }

    // Validate banner data
    const validationData = {
      templateId,
      position,
      content,
      imageUrl: imageUrl || '',  // Ensure imageUrl is always a string
      linkedCampaign,
      schedule
    };
    
    console.log('🔍 Validation data:', JSON.stringify(validationData, null, 2));
    console.log('🔍 imageUrl value:', imageUrl);
    console.log('🔍 imageUrl in validationData:', validationData.imageUrl);
    
    const validation = await bannerValidationService.validateBannerData(
      validationData,
      templateId
    );

    console.log('🔍 Validation result:', JSON.stringify(validation, null, 2));

    if (!validation.valid) {
      console.log('❌ Validation failed with errors:', validation.errors);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      });
    }
    
    console.log('✅ Validation passed successfully');

    // Validate linked promotion (if provided)
    let promotionData = { type: 'none', id: null };
    
    if (linkedPromotion && linkedPromotion.type && linkedPromotion.id) {
      const { type, id } = linkedPromotion;
      
      // Validate promotion exists and belongs to tenancy
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
      
      const promotion = await promotionModel.findOne({
        _id: id,
        tenancy: tenancyId
      });
      
      if (!promotion) {
        return res.status(404).json({
          success: false,
          message: `${type.charAt(0).toUpperCase() + type.slice(1)} not found or does not belong to your tenancy`
        });
      }
      
      promotionData = { type, id };
    } else if (linkedCampaign) {
      // Backward compatibility - if linkedCampaign is provided
      const campaign = await Campaign.findOne({
        _id: linkedCampaign,
        tenancy: tenancyId
      });

      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campaign not found or does not belong to your tenancy'
        });
      }
      
      promotionData = { type: 'campaign', id: linkedCampaign };
    }

    // Create banner
    const banner = await Banner.create({
      tenancy: tenancyId,
      bannerScope: 'TENANT',
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
      state: 'DRAFT',
      approval: {
        required: true,
        status: 'PENDING'
      },
      createdBy: req.user._id
    });

    // Increment template usage
    await template.incrementUsage();

    res.status(201).json({
      success: true,
      message: 'Banner created successfully. Submit for approval to activate.',
      data: { banner }
    });
  } catch (error) {
    console.error('Error creating banner:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create banner'
    });
  }
};

/**
 * @route   GET /api/admin/banners
 * @desc    Get all banners for admin's tenancy
 * @access  Admin
 */
exports.getAllBanners = async (req, res) => {
  try {
    const { 
      state, 
      position, 
      templateType, 
      search,
      sortBy = 'createdAt',
      order = 'desc',
      page = 1,
      limit = 20
    } = req.query;

    const tenancyId = req.user.tenancy;
    
    console.log('📋 Fetching banners for tenancy:', tenancyId);
    
    const query = { tenancy: tenancyId };
    
    if (state) {
      query.state = state;
    }
    
    if (position) {
      query.position = position;
    }
    
    if (templateType) {
      query.templateType = templateType;
    }
    
    if (search) {
      query.$or = [
        { 'content.title': { $regex: search, $options: 'i' } },
        { 'content.description': { $regex: search, $options: 'i' } }
      ];
    }
    
    const sortOrder = order === 'asc' ? 1 : -1;
    const sortOptions = { [sortBy]: sortOrder };
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [banners, total] = await Promise.all([
      Banner.find(query)
        .populate('template', 'name code type')
        .populate('linkedCampaign', 'name description startDate endDate status')
        .populate('createdBy', 'name email')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Banner.countDocuments(query)
    ]);
    
    console.log(`✅ Found ${banners.length} banners`);
    
    // Manually populate linkedPromotion based on type
    for (const banner of banners) {
      if (banner.linkedPromotion && banner.linkedPromotion.type && banner.linkedPromotion.id) {
        try {
          let promotionModel;
          const promotionType = banner.linkedPromotion.type;
          
          switch (promotionType) {
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
          }
          
          if (promotionModel) {
            const promotion = await promotionModel.findById(banner.linkedPromotion.id)
              .select('name description code type startDate endDate status')
              .lean();
            
            if (promotion) {
              banner.linkedPromotion.details = promotion;
            }
          }
        } catch (err) {
          console.error(`Failed to populate ${banner.linkedPromotion.type}:`, err.message);
          // Continue without promotion details
        }
      }
    }
    
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
    console.error('❌ Error fetching banners:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banners',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/admin/banners/:id
 * @desc    Get single banner
 * @access  Admin
 */
exports.getBannerById = async (req, res) => {
  try {
    const tenancyId = req.user.tenancy;
    
    const banner = await Banner.findOne({
      _id: req.params.id,
      tenancy: tenancyId
    })
      .populate('template')
      .populate('linkedCampaign')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .populate('approval.approvedBy', 'name email')
      .populate('approval.rejectedBy', 'name email');
    
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }
    
    res.json({
      success: true,
      data: { banner }
    });
  } catch (error) {
    console.error('Error fetching banner:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banner'
    });
  }
};

/**
 * @route   PUT /api/admin/banners/:id
 * @desc    Update banner (only if in DRAFT or REJECTED state)
 * @access  Admin
 */
exports.updateBanner = async (req, res) => {
  try {
    const tenancyId = req.user.tenancy;
    
    const banner = await Banner.findOne({
      _id: req.params.id,
      tenancy: tenancyId
    });
    
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }
    
    // Can only update if in DRAFT or REJECTED state
    if (!['DRAFT', 'REJECTED'].includes(banner.state)) {
      return res.status(400).json({
        success: false,
        message: `Cannot update banner in ${banner.state} state. Only DRAFT or REJECTED banners can be updated.`
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
    
    // If was rejected, clear rejection reason
    if (banner.state === 'REJECTED') {
      banner.approval.rejectionReason = '';
    }
    
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
 * @route   DELETE /api/admin/banners/:id
 * @desc    Delete banner (only if in DRAFT or REJECTED state)
 * @access  Admin
 */
exports.deleteBanner = async (req, res) => {
  try {
    const tenancyId = req.user.tenancy;
    
    const banner = await Banner.findOne({
      _id: req.params.id,
      tenancy: tenancyId
    });
    
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }
    
    // Can only delete if in DRAFT, REJECTED, or COMPLETED state
    if (!['DRAFT', 'REJECTED', 'COMPLETED'].includes(banner.state)) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete banner in ${banner.state} state. Only DRAFT, REJECTED, or COMPLETED banners can be deleted.`
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
 * @route   POST /api/admin/banners/:id/submit-approval
 * @desc    Submit banner for approval
 * @access  Admin
 */
exports.submitForApproval = async (req, res) => {
  try {
    const tenancyId = req.user.tenancy;
    
    const banner = await Banner.findOne({
      _id: req.params.id,
      tenancy: tenancyId
    }).populate('template');
    
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }
    
    console.log('📋 Submitting banner for approval:');
    console.log('  - Banner ID:', banner._id);
    console.log('  - Current state:', banner.state);
    console.log('  - Template:', banner.template?.name);
    console.log('  - Image URL:', banner.imageUrl);
    console.log('  - Position:', banner.position);
    
    // Can only submit if in DRAFT state
    if (banner.state !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        message: `Cannot submit banner in ${banner.state} state. Only DRAFT banners can be submitted.`
      });
    }
    
    // Validate banner before submission
    const validationData = {
      templateId: banner.template._id,
      position: banner.position,
      content: banner.content,
      imageUrl: banner.imageUrl,
      linkedCampaign: banner.linkedCampaign,
      schedule: banner.schedule
    };
    
    console.log('🔍 Validating banner data:', JSON.stringify(validationData, null, 2));
    
    const validation = await bannerValidationService.validateBannerData(
      validationData,
      banner.template._id
    );
    
    console.log('✅ Validation result:', validation);
    
    if (!validation.valid) {
      console.log('❌ Validation failed:', validation.errors);
      return res.status(400).json({
        success: false,
        message: 'Banner validation failed. Please fix errors before submitting.',
        errors: validation.errors
      });
    }
    
    // Transition to PENDING_APPROVAL
    await banner.transitionState('PENDING_APPROVAL', req.user._id);
    
    res.json({
      success: true,
      message: 'Banner submitted for approval successfully',
      data: { banner }
    });
  } catch (error) {
    console.error('Error submitting banner for approval:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit banner for approval'
    });
  }
};

/**
 * @route   PATCH /api/admin/banners/:id/state
 * @desc    Change banner state (pause/resume)
 * @access  Admin
 */
exports.changeBannerState = async (req, res) => {
  try {
    const { newState } = req.body;
    const tenancyId = req.user.tenancy;
    
    const banner = await Banner.findOne({
      _id: req.params.id,
      tenancy: tenancyId
    });
    
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }
    
    // Admin can only pause/resume (ACTIVE <-> PAUSED)
    if (banner.state === 'ACTIVE' && newState === 'PAUSED') {
      await banner.transitionState('PAUSED', req.user._id);
    } else if (banner.state === 'PAUSED' && newState === 'ACTIVE') {
      await banner.transitionState('ACTIVE', req.user._id);
    } else {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from ${banner.state} to ${newState}. Admin can only pause/resume active banners.`
      });
    }
    
    res.json({
      success: true,
      message: `Banner ${newState.toLowerCase()} successfully`,
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
 * @route   GET /api/admin/banners/by-state/:state
 * @desc    Get banners by state
 * @access  Admin
 */
exports.getBannersByState = async (req, res) => {
  try {
    const { state } = req.params;
    const tenancyId = req.user.tenancy;
    
    const banners = await Banner.find({
      tenancy: tenancyId,
      state
    })
      .populate('template', 'name code type')
      .populate('linkedCampaign', 'name')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: {
        banners,
        count: banners.length
      }
    });
  } catch (error) {
    console.error('Error fetching banners by state:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banners'
    });
  }
};

/**
 * @route   GET /api/admin/banners/analytics/overview
 * @desc    Get banner analytics overview for tenancy
 * @access  Admin
 */
exports.getBannerAnalytics = async (req, res) => {
  try {
    const tenancyId = req.user.tenancy;
    const { startDate, endDate } = req.query;
    
    const dateFilter = { tenancy: tenancyId };
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }
    
    // Overall stats
    const overallStats = await Banner.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalBanners: { $sum: 1 },
          activeBanners: { $sum: { $cond: [{ $eq: ['$state', 'ACTIVE'] }, 1, 0] } },
          totalImpressions: { $sum: '$analytics.impressions' },
          totalClicks: { $sum: '$analytics.clicks' },
          totalConversions: { $sum: '$analytics.conversions' },
          totalRevenue: { $sum: '$analytics.revenue' }
        }
      }
    ]);
    
    // Stats by state
    const stateStats = await Banner.aggregate([
      { $match: { tenancy: tenancyId } },
      {
        $group: {
          _id: '$state',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Stats by position
    const positionStats = await Banner.aggregate([
      { $match: { ...dateFilter, state: 'ACTIVE' } },
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
      state: 'ACTIVE'
    })
      .sort({ 'analytics.conversions': -1 })
      .limit(5)
      .populate('template', 'name type')
      .select('content.title analytics position');
    
    // Lifecycle stats
    const lifecycleStats = await bannerLifecycleService.getLifecycleStats(tenancyId);
    
    res.json({
      success: true,
      data: {
        overall: overallStats[0] || {
          totalBanners: 0,
          activeBanners: 0,
          totalImpressions: 0,
          totalClicks: 0,
          totalConversions: 0,
          totalRevenue: 0
        },
        byState: stateStats,
        byPosition: positionStats,
        topPerformers: topBanners,
        lifecycle: lifecycleStats.data
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
 * @route   GET /api/admin/banners/:id/analytics
 * @desc    Get analytics for specific banner
 * @access  Admin
 */
exports.getBannerAnalyticsById = async (req, res) => {
  try {
    const tenancyId = req.user.tenancy;
    
    const banner = await Banner.findOne({
      _id: req.params.id,
      tenancy: tenancyId
    })
      .populate('template', 'name type')
      .populate('linkedCampaign', 'name')
      .select('content.title position state analytics schedule');
    
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }
    
    // Calculate CTR and conversion rate
    const ctr = banner.analytics.impressions > 0 
      ? ((banner.analytics.clicks / banner.analytics.impressions) * 100).toFixed(2)
      : 0;
    
    const conversionRate = banner.analytics.clicks > 0
      ? ((banner.analytics.conversions / banner.analytics.clicks) * 100).toFixed(2)
      : 0;
    
    const avgOrderValue = banner.analytics.conversions > 0
      ? (banner.analytics.revenue / banner.analytics.conversions).toFixed(2)
      : 0;
    
    res.json({
      success: true,
      data: {
        banner,
        metrics: {
          ctr,
          conversionRate,
          avgOrderValue
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
 * @route   GET /api/admin/campaigns/:campaignId/banners
 * @desc    Get all banners linked to a campaign
 * @access  Admin
 */
exports.getBannersByCampaign = async (req, res) => {
  try {
    const tenancyId = req.user.tenancy;
    const { campaignId } = req.params;
    
    // Verify campaign belongs to tenancy
    const campaign = await Campaign.findOne({
      _id: campaignId,
      tenancy: tenancyId
    });
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }
    
    const banners = await Banner.find({
      tenancy: tenancyId,
      linkedCampaign: campaignId
    })
      .populate('template', 'name code type')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: {
        campaign: {
          id: campaign._id,
          name: campaign.name
        },
        banners,
        count: banners.length
      }
    });
  } catch (error) {
    console.error('Error fetching banners by campaign:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banners'
    });
  }
};


/**
 * @route   GET /api/admin/banners/promotions/all
 * @desc    Get all promotions (campaigns, discounts, coupons, referrals, loyalty) for dropdown
 * @access  Admin
 */
exports.getAllPromotions = async (req, res) => {
  try {
    const tenancyId = req.user.tenancy;
    
    console.log('📋 Fetching promotions for tenancy:', tenancyId);

    // Import models
    const Campaign = require('../../models/Campaign');
    const Discount = require('../../models/Discount');
    const Coupon = require('../../models/Coupon');
    const { ReferralProgram } = require('../../models/Referral');
    const { LoyaltyProgram } = require('../../models/LoyaltyProgram');

    // Fetch all active promotions with error handling
    const [campaigns, discounts, coupons, referrals, loyaltyPrograms] = await Promise.allSettled([
      Campaign.find({ tenancy: tenancyId, status: { $in: ['DRAFT', 'ACTIVE', 'SCHEDULED'] } })
        .select('name description startDate endDate status')
        .sort({ createdAt: -1 })
        .lean(),
      
      Discount.find({ tenancy: tenancyId, isActive: true })
        .select('name description startDate endDate')
        .sort({ createdAt: -1 })
        .lean(),
      
      Coupon.find({ tenancy: tenancyId, isActive: true })
        .select('code name description startDate endDate')
        .sort({ createdAt: -1 })
        .lean(),
      
      ReferralProgram.find({ tenancy: tenancyId, isActive: true })
        .select('name description startDate endDate')
        .sort({ createdAt: -1 })
        .lean(),
      
      LoyaltyProgram.find({ tenancy: tenancyId, isActive: true })
        .select('name description type startDate endDate')
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
        name: c.name,
        description: c.description,
        status: c.status,
        startDate: c.startDate,
        endDate: c.endDate
      })) : [],
      
      discounts: discounts.status === 'fulfilled' ? discounts.value.map(d => ({
        id: d._id.toString(),
        type: 'discount',
        name: d.name,
        description: d.description,
        startDate: d.startDate,
        endDate: d.endDate
      })) : [],
      
      coupons: coupons.status === 'fulfilled' ? coupons.value.map(c => ({
        id: c._id.toString(),
        type: 'coupon',
        name: `${c.code} - ${c.name}`,
        description: c.description,
        startDate: c.startDate,
        endDate: c.endDate
      })) : [],
      
      referrals: referrals.status === 'fulfilled' ? referrals.value.map(r => ({
        id: r._id.toString(),
        type: 'referral',
        name: r.name,
        description: r.description,
        startDate: r.startDate,
        endDate: r.endDate
      })) : [],
      
      loyalty: loyaltyPrograms.status === 'fulfilled' ? loyaltyPrograms.value.map(l => ({
        id: l._id.toString(),
        type: 'loyalty',
        name: `${l.name} (${l.type})`,
        description: l.description,
        startDate: l.startDate,
        endDate: l.endDate
      })) : []
    };

    console.log('📦 Returning promotions:', {
      campaigns: promotions.campaigns.length,
      discounts: promotions.discounts.length,
      coupons: promotions.coupons.length,
      referrals: promotions.referrals.length,
      loyalty: promotions.loyalty.length
    });
    
    // Log sample data for debugging
    if (promotions.discounts.length > 0) {
      console.log('📋 Sample Discount:', JSON.stringify(promotions.discounts[0], null, 2));
    }
    if (promotions.campaigns.length > 0) {
      console.log('📋 Sample Campaign:', JSON.stringify(promotions.campaigns[0], null, 2));
    }

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
 * @route   POST /api/admin/banners/upload-image
 * @desc    Upload banner image
 * @access  Admin
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
