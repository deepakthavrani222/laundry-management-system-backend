const Banner = require('../../models/Banner');
const { validationResult } = require('express-validator');
const { upload, uploadImage } = require('../../services/imageUploadService');

// Get all tenant banners
const getTenantBanners = async (req, res) => {
  try {
    const tenancyId = req.user.tenancy;
    const { page = 1, limit = 10, search, status, type, targetPage } = req.query;
    
    // Build filter for tenant banners only
    const filter = { 
      bannerScope: 'TENANT',
      tenancy: tenancyId
    };
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) {
      filter.status = status;
    }
    
    if (type) {
      filter.type = type;
    }
    
    if (targetPage) {
      filter.targetPages = targetPage;
    }
    
    const banners = await Banner.find(filter)
      .sort({ priority: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
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
    console.error('Get tenant banners error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banners'
    });
  }
};

// Get single banner by ID
const getBannerById = async (req, res) => {
  try {
    const { bannerId } = req.params;
    const tenancyId = req.user.tenancy;
    
    const banner = await Banner.findOne({
      _id: bannerId,
      bannerScope: 'TENANT',
      tenancy: tenancyId
    })
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .populate('linkedPromotion.promotionId');
    
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
    console.error('Get banner error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banner'
    });
  }
};

// Create tenant banner
const createTenantBanner = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const tenancyId = req.user.tenancy;
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
      bannerScope: 'TENANT',
      tenancy: tenancyId,
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
      createdByModel: 'Admin',
      status: 'DRAFT'
    });
    
    await banner.save();
    
    res.status(201).json({
      success: true,
      message: 'Banner created successfully',
      data: { banner }
    });
  } catch (error) {
    console.error('Create banner error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create banner'
    });
  }
};

// Update tenant banner
const updateTenantBanner = async (req, res) => {
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
    const tenancyId = req.user.tenancy;
    
    const banner = await Banner.findOne({
      _id: bannerId,
      bannerScope: 'TENANT',
      tenancy: tenancyId
    });
    
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }
    
    // Don't allow editing active banners with high impressions
    if (banner.status === 'ACTIVE' && banner.analytics.impressions > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit active banner with significant impressions. Please create a new banner instead.'
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
    banner.updatedByModel = 'Admin';
    
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

// Delete tenant banner
const deleteTenantBanner = async (req, res) => {
  try {
    const { bannerId } = req.params;
    const tenancyId = req.user.tenancy;
    
    const banner = await Banner.findOne({
      _id: bannerId,
      bannerScope: 'TENANT',
      tenancy: tenancyId
    });
    
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }
    
    // Don't allow deleting active banners with conversions
    if (banner.status === 'ACTIVE' && banner.analytics.conversions > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete active banner with conversions. Please pause it instead.'
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

// Toggle banner status (activate/pause)
const toggleBannerStatus = async (req, res) => {
  try {
    const { bannerId } = req.params;
    const tenancyId = req.user.tenancy;
    
    const banner = await Banner.findOne({
      _id: bannerId,
      bannerScope: 'TENANT',
      tenancy: tenancyId
    });
    
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }
    
    // Toggle between ACTIVE and PAUSED
    if (banner.status === 'ACTIVE') {
      banner.status = 'PAUSED';
    } else if (banner.status === 'PAUSED' || banner.status === 'DRAFT') {
      banner.status = 'ACTIVE';
    } else {
      return res.status(400).json({
        success: false,
        message: 'Banner cannot be toggled from current status'
      });
    }
    
    banner.updatedBy = req.user._id;
    banner.updatedByModel = 'Admin';
    
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

// Get banner analytics
const getBannerAnalytics = async (req, res) => {
  try {
    const { bannerId } = req.params;
    const tenancyId = req.user.tenancy;
    
    const banner = await Banner.findOne({
      _id: bannerId,
      bannerScope: 'TENANT',
      tenancy: tenancyId
    });
    
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }
    
    // Calculate analytics
    const analytics = {
      impressions: banner.analytics.impressions,
      clicks: banner.analytics.clicks,
      conversions: banner.analytics.conversions,
      revenue: banner.analytics.revenue,
      ctr: banner.ctr,
      conversionRate: banner.conversionRate,
      avgRevenuePerConversion: banner.analytics.conversions > 0 
        ? (banner.analytics.revenue / banner.analytics.conversions).toFixed(2)
        : 0,
      daysActive: Math.ceil((new Date() - banner.startDate) / (1000 * 60 * 60 * 24)),
      daysRemaining: Math.ceil((banner.endDate - new Date()) / (1000 * 60 * 60 * 24))
    };
    
    res.json({
      success: true,
      data: { analytics }
    });
  } catch (error) {
    console.error('Get banner analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banner analytics'
    });
  }
};

// Upload banner image
const uploadBannerImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }
    
    // Upload and optimize image
    const result = await uploadImage(req.file.buffer, req.file.originalname, {
      width: 1200,
      quality: 85,
      format: 'webp',
      folder: 'uploads/banners'
    });
    
    res.json({
      success: true,
      message: 'Image uploaded successfully',
      data: result
    });
  } catch (error) {
    console.error('Upload banner image error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload image'
    });
  }
};

module.exports = {
  getTenantBanners,
  getBannerById,
  createTenantBanner,
  updateTenantBanner,
  deleteTenantBanner,
  toggleBannerStatus,
  getBannerAnalytics,
  uploadBannerImage
};
