const Banner = require('../../models/Banner');
const Tenancy = require('../../models/Tenancy');
const { validationResult } = require('express-validator');

// Get all banners (tenant + global)
const getAllBanners = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, scope, tenancyId } = req.query;
    
    // Build filter
    const filter = {};
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) {
      filter.status = status;
    }
    
    if (scope) {
      filter.bannerScope = scope;
    }
    
    if (tenancyId) {
      filter.tenancy = tenancyId;
    }
    
    const banners = await Banner.find(filter)
      .sort({ bannerScope: 1, priority: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .populate('tenancy', 'name slug')
      .populate('linkedPromotion.promotionId');
    
    const total = await Banner.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        banners,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get all banners error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banners'
    });
  }
};

// Create global banner
const createGlobalBanner = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const {
      title,
      description,
      imageUrl,
      imageAlt,
      mobileImageUrl,
      type,
      linkedPromotion,
      ctaText,
      ctaLink,
      targetPages,
      position,
      priority,
      startDate,
      endDate
    } = req.body;
    
    const banner = new Banner({
      bannerScope: 'GLOBAL',
      title,
      description,
      imageUrl,
      imageAlt,
      mobileImageUrl,
      type: type || 'PROMOTIONAL',
      linkedPromotion: linkedPromotion || { type: 'NONE' },
      ctaText: ctaText || 'Learn More',
      ctaLink,
      targetPages: targetPages || ['HOME'],
      position: position || 'TOP',
      priority: priority || 0,
      startDate: startDate || new Date(),
      endDate,
      createdBy: req.user._id,
      createdByModel: 'SuperAdmin',
      status: 'ACTIVE' // Global banners are auto-approved
    });
    
    await banner.save();
    
    res.status(201).json({
      success: true,
      message: 'Global banner created successfully',
      data: { banner }
    });
  } catch (error) {
    console.error('Create global banner error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create global banner'
    });
  }
};

// Update any banner (tenant or global)
const updateBanner = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const { bannerId } = req.params;
    
    const banner = await Banner.findById(bannerId);
    
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }
    
    const {
      title,
      description,
      imageUrl,
      imageAlt,
      mobileImageUrl,
      type,
      linkedPromotion,
      ctaText,
      ctaLink,
      targetPages,
      position,
      priority,
      startDate,
      endDate,
      status
    } = req.body;
    
    // Update fields
    if (title !== undefined) banner.title = title;
    if (description !== undefined) banner.description = description;
    if (imageUrl !== undefined) banner.imageUrl = imageUrl;
    if (imageAlt !== undefined) banner.imageAlt = imageAlt;
    if (mobileImageUrl !== undefined) banner.mobileImageUrl = mobileImageUrl;
    if (type !== undefined) banner.type = type;
    if (linkedPromotion !== undefined) banner.linkedPromotion = linkedPromotion;
    if (ctaText !== undefined) banner.ctaText = ctaText;
    if (ctaLink !== undefined) banner.ctaLink = ctaLink;
    if (targetPages !== undefined) banner.targetPages = targetPages;
    if (position !== undefined) banner.position = position;
    if (priority !== undefined) banner.priority = priority;
    if (startDate !== undefined) banner.startDate = startDate;
    if (endDate !== undefined) banner.endDate = endDate;
    if (status !== undefined) banner.status = status;
    
    banner.updatedBy = req.user._id;
    banner.updatedByModel = 'SuperAdmin';
    
    await banner.save();
    
    res.json({
      success: true,
      message: 'Banner updated successfully',
      data: { banner }
    });
  } catch (error) {
    console.error('Update banner error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update banner'
    });
  }
};

// Delete any banner
const deleteBanner = async (req, res) => {
  try {
    const { bannerId } = req.params;
    
    const banner = await Banner.findById(bannerId);
    
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }
    
    await Banner.findByIdAndDelete(bannerId);
    
    res.json({
      success: true,
      message: 'Banner deleted successfully'
    });
  } catch (error) {
    console.error('Delete banner error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete banner'
    });
  }
};

// Approve or reject banner
const approveBanner = async (req, res) => {
  try {
    const { bannerId } = req.params;
    const { action, reason } = req.body; // action: 'approve' | 'reject'
    
    const banner = await Banner.findById(bannerId);
    
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }
    
    if (banner.status !== 'PENDING_APPROVAL') {
      return res.status(400).json({
        success: false,
        message: 'Banner is not pending approval'
      });
    }
    
    if (action === 'approve') {
      banner.status = 'ACTIVE';
      banner.approvedBy = req.user._id;
      banner.approvedAt = new Date();
    } else if (action === 'reject') {
      banner.status = 'REJECTED';
      banner.rejectionReason = reason || 'Rejected by SuperAdmin';
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be "approve" or "reject"'
      });
    }
    
    await banner.save();
    
    res.json({
      success: true,
      message: `Banner ${action}d successfully`,
      data: { banner }
    });
  } catch (error) {
    console.error('Approve banner error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process banner approval'
    });
  }
};

// Toggle banner status (pause/resume)
const toggleBannerStatus = async (req, res) => {
  try {
    const { bannerId } = req.params;
    
    const banner = await Banner.findById(bannerId);
    
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }
    
    // Toggle between ACTIVE and PAUSED
    if (banner.status === 'ACTIVE') {
      banner.status = 'PAUSED';
    } else if (banner.status === 'PAUSED') {
      banner.status = 'ACTIVE';
    } else {
      return res.status(400).json({
        success: false,
        message: 'Banner cannot be toggled from current status'
      });
    }
    
    banner.updatedBy = req.user._id;
    banner.updatedByModel = 'SuperAdmin';
    
    await banner.save();
    
    res.json({
      success: true,
      message: `Banner ${banner.status.toLowerCase()} successfully`,
      data: { banner }
    });
  } catch (error) {
    console.error('Toggle banner status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle banner status'
    });
  }
};

// Get platform-wide analytics
const getPlatformAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, scope } = req.query;
    
    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }
    
    // Build scope filter
    const scopeFilter = {};
    if (scope) {
      scopeFilter.bannerScope = scope;
    }
    
    // Get overall banner statistics
    const overallStats = await Banner.aggregate([
      { $match: { ...dateFilter, ...scopeFilter } },
      {
        $group: {
          _id: '$bannerScope',
          totalBanners: { $sum: 1 },
          activeBanners: { $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0] } },
          totalImpressions: { $sum: '$analytics.impressions' },
          totalClicks: { $sum: '$analytics.clicks' },
          totalConversions: { $sum: '$analytics.conversions' },
          totalRevenue: { $sum: '$analytics.revenue' }
        }
      }
    ]);
    
    // Get top performing banners
    const topBanners = await Banner.find({
      ...dateFilter,
      ...scopeFilter,
      status: 'ACTIVE'
    })
    .sort({ 'analytics.conversions': -1 })
    .limit(10)
    .populate('tenancy', 'name slug')
    .select('title bannerScope analytics tenancy');
    
    // Get tenancy performance comparison
    const tenancyPerformance = await Banner.aggregate([
      { 
        $match: { 
          bannerScope: 'TENANT',
          ...dateFilter
        }
      },
      {
        $group: {
          _id: '$tenancy',
          bannerCount: { $sum: 1 },
          totalImpressions: { $sum: '$analytics.impressions' },
          totalClicks: { $sum: '$analytics.clicks' },
          totalConversions: { $sum: '$analytics.conversions' },
          totalRevenue: { $sum: '$analytics.revenue' }
        }
      },
      {
        $lookup: {
          from: 'tenancies',
          localField: '_id',
          foreignField: '_id',
          as: 'tenancy'
        }
      },
      { $unwind: '$tenancy' },
      {
        $project: {
          tenancyName: '$tenancy.name',
          tenancySlug: '$tenancy.slug',
          bannerCount: 1,
          totalImpressions: 1,
          totalClicks: 1,
          totalConversions: 1,
          totalRevenue: 1,
          avgCTR: {
            $cond: [
              { $gt: ['$totalImpressions', 0] },
              { $multiply: [{ $divide: ['$totalClicks', '$totalImpressions'] }, 100] },
              0
            ]
          }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 }
    ]);
    
    const analytics = {
      overview: overallStats,
      topBanners,
      tenancyPerformance
    };
    
    res.json({
      success: true,
      data: { analytics }
    });
  } catch (error) {
    console.error('Get platform analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch platform analytics'
    });
  }
};

// Emergency disable banner
const disableBanner = async (req, res) => {
  try {
    const { bannerId } = req.params;
    const { reason } = req.body;
    
    const banner = await Banner.findById(bannerId);
    
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }
    
    banner.status = 'PAUSED';
    banner.isActive = false;
    banner.rejectionReason = reason || 'Disabled by SuperAdmin';
    banner.updatedBy = req.user._id;
    banner.updatedByModel = 'SuperAdmin';
    
    await banner.save();
    
    res.json({
      success: true,
      message: 'Banner disabled successfully',
      data: { banner }
    });
  } catch (error) {
    console.error('Disable banner error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disable banner'
    });
  }
};

module.exports = {
  getAllBanners,
  createGlobalBanner,
  updateBanner,
  deleteBanner,
  approveBanner,
  toggleBannerStatus,
  getPlatformAnalytics,
  disableBanner
};
