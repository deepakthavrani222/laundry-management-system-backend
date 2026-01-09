const Banner = require('../../models/Banner');
const BannerTemplate = require('../../models/BannerTemplate');

/**
 * @route   GET /api/superadmin/banners/pending
 * @desc    Get all pending approval banners
 * @access  Super Admin
 */
exports.getPendingBanners = async (req, res) => {
  try {
    const { tenancyId, templateType, sortBy = 'createdAt', order = 'desc' } = req.query;
    
    const query = {
      state: 'PENDING_APPROVAL',
      'approval.status': 'PENDING'
    };
    
    // Filter by tenancy
    if (tenancyId) {
      query.tenancy = tenancyId;
    }
    
    // Filter by template type
    if (templateType) {
      query.templateType = templateType;
    }
    
    const sortOrder = order === 'asc' ? 1 : -1;
    const sortOptions = { [sortBy]: sortOrder };
    
    const banners = await Banner.find(query)
      .populate('template', 'name code type')
      .populate('linkedCampaign', 'name description startDate endDate')
      .populate('tenancy', 'name businessName')
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
    console.error('Error fetching pending banners:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending banners'
    });
  }
};

/**
 * @route   POST /api/superadmin/banners/:id/approve
 * @desc    Approve a banner
 * @access  Super Admin
 */
exports.approveBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id)
      .populate('template')
      .populate('linkedCampaign');
    
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }
    
    // Check if banner is in pending state
    if (banner.state !== 'PENDING_APPROVAL') {
      return res.status(400).json({
        success: false,
        message: `Cannot approve banner in ${banner.state} state`
      });
    }
    
    // Transition to APPROVED state
    await banner.transitionState('APPROVED', req.user._id);
    
    // Check if should be scheduled or activated immediately
    const now = new Date();
    if (banner.schedule.startDate <= now && banner.schedule.endDate >= now) {
      // Activate immediately
      await banner.transitionState('ACTIVE', req.user._id);
    } else if (banner.schedule.startDate > now) {
      // Schedule for future
      await banner.transitionState('SCHEDULED', req.user._id);
    }
    
    res.json({
      success: true,
      message: 'Banner approved successfully',
      data: { banner }
    });
  } catch (error) {
    console.error('Error approving banner:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to approve banner'
    });
  }
};

/**
 * @route   POST /api/superadmin/banners/:id/reject
 * @desc    Reject a banner
 * @access  Super Admin
 */
exports.rejectBanner = async (req, res) => {
  try {
    const { reason } = req.body;
    
    if (!reason || reason.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }
    
    const banner = await Banner.findById(req.params.id);
    
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }
    
    // Check if banner is in pending state
    if (banner.state !== 'PENDING_APPROVAL') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject banner in ${banner.state} state`
      });
    }
    
    // Set rejection reason
    banner.approval.rejectionReason = reason;
    
    // Transition to REJECTED state
    await banner.transitionState('REJECTED', req.user._id);
    
    res.json({
      success: true,
      message: 'Banner rejected successfully',
      data: { banner }
    });
  } catch (error) {
    console.error('Error rejecting banner:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to reject banner'
    });
  }
};

/**
 * @route   GET /api/superadmin/banners/approval-history
 * @desc    Get banner approval history
 * @access  Super Admin
 */
exports.getApprovalHistory = async (req, res) => {
  try {
    const { 
      tenancyId, 
      status, 
      startDate, 
      endDate,
      page = 1, 
      limit = 20 
    } = req.query;
    
    const query = {
      state: { $in: ['APPROVED', 'REJECTED'] }
    };
    
    // Filter by tenancy
    if (tenancyId) {
      query.tenancy = tenancyId;
    }
    
    // Filter by approval status
    if (status) {
      query['approval.status'] = status;
    }
    
    // Filter by date range
    if (startDate || endDate) {
      query['approval.approvedAt'] = {};
      if (startDate) {
        query['approval.approvedAt'].$gte = new Date(startDate);
      }
      if (endDate) {
        query['approval.approvedAt'].$lte = new Date(endDate);
      }
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [banners, total] = await Promise.all([
      Banner.find(query)
        .populate('template', 'name code type')
        .populate('linkedCampaign', 'name')
        .populate('tenancy', 'name businessName')
        .populate('createdBy', 'name email')
        .populate('approval.approvedBy', 'name email')
        .populate('approval.rejectedBy', 'name email')
        .sort({ 'approval.approvedAt': -1, 'approval.rejectedAt': -1 })
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
    console.error('Error fetching approval history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch approval history'
    });
  }
};

/**
 * @route   GET /api/superadmin/banners/approval-stats
 * @desc    Get approval statistics
 * @access  Super Admin
 */
exports.getApprovalStats = async (req, res) => {
  try {
    const stats = await Banner.aggregate([
      {
        $match: {
          bannerScope: 'TENANT'
        }
      },
      {
        $group: {
          _id: '$approval.status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const stateStats = await Banner.aggregate([
      {
        $match: {
          bannerScope: 'TENANT'
        }
      },
      {
        $group: {
          _id: '$state',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Format results
    const approvalStats = {
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0
    };
    
    stats.forEach(stat => {
      approvalStats[stat._id] = stat.count;
    });
    
    const stateCount = {};
    stateStats.forEach(stat => {
      stateCount[stat._id] = stat.count;
    });
    
    // Get recent activity
    const recentApprovals = await Banner.find({
      'approval.status': 'APPROVED',
      'approval.approvedAt': { $exists: true }
    })
      .populate('tenancy', 'name')
      .populate('approval.approvedBy', 'name')
      .sort({ 'approval.approvedAt': -1 })
      .limit(5);
    
    const recentRejections = await Banner.find({
      'approval.status': 'REJECTED',
      'approval.rejectedAt': { $exists: true }
    })
      .populate('tenancy', 'name')
      .populate('approval.rejectedBy', 'name')
      .sort({ 'approval.rejectedAt': -1 })
      .limit(5);
    
    res.json({
      success: true,
      data: {
        approvalStats,
        stateStats: stateCount,
        recentActivity: {
          approvals: recentApprovals,
          rejections: recentRejections
        }
      }
    });
  } catch (error) {
    console.error('Error fetching approval stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch approval statistics'
    });
  }
};

/**
 * @route   POST /api/superadmin/banners/:id/review
 * @desc    Get banner details for review
 * @access  Super Admin
 */
exports.getBannerForReview = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id)
      .populate('template')
      .populate('linkedCampaign')
      .populate('tenancy', 'name businessName email phone')
      .populate('createdBy', 'name email');
    
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }
    
    // Get validation rules from template
    const validationRules = {
      image: banner.template.layout.image,
      fields: banner.template.layout.fields,
      cta: banner.template.layout.cta,
      allowedPositions: banner.template.allowedPositions
    };
    
    // Get campaign details
    const campaign = banner.linkedCampaign;
    const campaignInfo = campaign ? {
      name: campaign.name,
      description: campaign.description,
      status: campaign.status,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      isActive: campaign.isActive
    } : null;
    
    res.json({
      success: true,
      data: {
        banner,
        validationRules,
        campaignInfo
      }
    });
  } catch (error) {
    console.error('Error fetching banner for review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banner details'
    });
  }
};

/**
 * @route   POST /api/superadmin/banners/bulk-approve
 * @desc    Bulk approve banners
 * @access  Super Admin
 */
exports.bulkApproveBanners = async (req, res) => {
  try {
    const { bannerIds } = req.body;
    
    if (!bannerIds || !Array.isArray(bannerIds) || bannerIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Banner IDs array is required'
      });
    }
    
    const results = {
      approved: [],
      failed: []
    };
    
    for (const bannerId of bannerIds) {
      try {
        const banner = await Banner.findById(bannerId);
        
        if (!banner) {
          results.failed.push({ bannerId, reason: 'Banner not found' });
          continue;
        }
        
        if (banner.state !== 'PENDING_APPROVAL') {
          results.failed.push({ bannerId, reason: `Banner is in ${banner.state} state` });
          continue;
        }
        
        await banner.transitionState('APPROVED', req.user._id);
        
        // Auto-activate or schedule
        const now = new Date();
        if (banner.schedule.startDate <= now && banner.schedule.endDate >= now) {
          await banner.transitionState('ACTIVE', req.user._id);
        } else if (banner.schedule.startDate > now) {
          await banner.transitionState('SCHEDULED', req.user._id);
        }
        
        results.approved.push(bannerId);
      } catch (error) {
        results.failed.push({ bannerId, reason: error.message });
      }
    }
    
    res.json({
      success: true,
      message: `Approved ${results.approved.length} banner(s)`,
      data: results
    });
  } catch (error) {
    console.error('Error bulk approving banners:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk approve banners'
    });
  }
};
