const Campaign = require('../../models/Campaign');
const Tenancy = require('../../models/Tenancy');
const CampaignEngine = require('../../services/campaignEngine');
const { validationResult } = require('express-validator');

// ============ GLOBAL CAMPAIGNS (SuperAdmin Level) ============

// Get all campaigns (global, tenant, templates)
const getAllCampaigns = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, scope, tenancyId } = req.query;
    
    // Build filter
    const filter = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) {
      filter.status = status;
    }
    
    if (scope) {
      filter.campaignScope = scope;
    }
    
    if (tenancyId) {
      filter.$or = [
        { tenancy: tenancyId },
        { applicableTenancies: tenancyId }
      ];
    }
    
    const campaigns = await Campaign.find(filter)
      .sort({ campaignScope: 1, priority: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('promotions.promotionId')
      .populate('createdBy', 'name email')
      .populate('tenancy', 'name slug')
      .populate('applicableTenancies', 'name slug');
    
    const total = await Campaign.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        campaigns,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get all campaigns error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch campaigns'
    });
  }
};

// Create global campaign
const createGlobalCampaign = async (req, res) => {
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
      name, description, startDate, endDate, priority,
      triggers, audience, promotions, budget, limits, stacking,
      applicableTenancies, autoApprovalRules
    } = req.body;
    
    // Validate tenancies if specified
    if (applicableTenancies && applicableTenancies.length > 0) {
      const validTenancies = await Tenancy.find({
        _id: { $in: applicableTenancies },
        status: 'active'
      });
      
      if (validTenancies.length !== applicableTenancies.length) {
        return res.status(400).json({
          success: false,
          message: 'Some specified tenancies are invalid or inactive'
        });
      }
    }
    
    const campaign = new Campaign({
      campaignScope: 'GLOBAL',
      applicableTenancies: applicableTenancies || [],
      name,
      description,
      startDate,
      endDate,
      priority: priority || 0,
      triggers: triggers || [{ type: 'ORDER_CHECKOUT' }],
      audience: audience || { targetType: 'ALL_USERS' },
      promotions: promotions || [],
      budget: {
        ...budget,
        budgetSource: budget?.budgetSource || 'PLATFORM_BUDGET'
      },
      limits: limits || {},
      stacking: stacking || {},
      autoApprovalRules: autoApprovalRules || {},
      createdBy: req.user._id,
      createdByModel: 'SuperAdmin',
      status: 'DRAFT'
    });
    
    await campaign.save();
    
    res.status(201).json({
      success: true,
      message: 'Global campaign created successfully',
      data: { campaign }
    });
  } catch (error) {
    console.error('Create global campaign error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create global campaign'
    });
  }
};

// Create template campaign
const createTemplateCampaign = async (req, res) => {
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
      name, description, templateCategory, triggers, audience, 
      promotions, budget, limits, stacking
    } = req.body;
    
    const template = new Campaign({
      campaignScope: 'TEMPLATE',
      isTemplate: true,
      templateCategory,
      name,
      description,
      // Set default dates for template (will be overridden when used)
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      triggers: triggers || [{ type: 'ORDER_CHECKOUT' }],
      audience: audience || { targetType: 'ALL_USERS' },
      promotions: promotions || [],
      budget: budget || { type: 'UNLIMITED' },
      limits: limits || {},
      stacking: stacking || {},
      createdBy: req.user._id,
      createdByModel: 'SuperAdmin',
      status: 'ACTIVE' // Templates are active by default
    });
    
    await template.save();
    
    res.status(201).json({
      success: true,
      message: 'Template campaign created successfully',
      data: { template }
    });
  } catch (error) {
    console.error('Create template campaign error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create template campaign'
    });
  }
};

// Update campaign (global or template)
const updateCampaign = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const { campaignId } = req.params;
    
    const campaign = await Campaign.findOne({
      _id: campaignId,
      campaignScope: { $in: ['GLOBAL', 'TEMPLATE'] }
    });
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }
    
    const {
      name, description, startDate, endDate, priority,
      triggers, audience, promotions, budget, limits, stacking,
      applicableTenancies, status, templateCategory
    } = req.body;
    
    // Validate tenancies for global campaigns
    if (campaign.campaignScope === 'GLOBAL' && applicableTenancies) {
      const validTenancies = await Tenancy.find({
        _id: { $in: applicableTenancies },
        status: 'active'
      });
      
      if (validTenancies.length !== applicableTenancies.length) {
        return res.status(400).json({
          success: false,
          message: 'Some specified tenancies are invalid or inactive'
        });
      }
    }
    
    // Update fields
    if (name !== undefined) campaign.name = name;
    if (description !== undefined) campaign.description = description;
    if (startDate !== undefined) campaign.startDate = startDate;
    if (endDate !== undefined) campaign.endDate = endDate;
    if (priority !== undefined) campaign.priority = priority;
    if (triggers !== undefined) campaign.triggers = triggers;
    if (audience !== undefined) campaign.audience = audience;
    if (promotions !== undefined) campaign.promotions = promotions;
    if (budget !== undefined) campaign.budget = { ...campaign.budget, ...budget };
    if (limits !== undefined) campaign.limits = { ...campaign.limits, ...limits };
    if (stacking !== undefined) campaign.stacking = { ...campaign.stacking, ...stacking };
    if (status !== undefined) campaign.status = status;
    if (templateCategory !== undefined) campaign.templateCategory = templateCategory;
    
    if (campaign.campaignScope === 'GLOBAL' && applicableTenancies !== undefined) {
      campaign.applicableTenancies = applicableTenancies;
    }
    
    await campaign.save();
    
    res.json({
      success: true,
      message: 'Campaign updated successfully',
      data: { campaign }
    });
  } catch (error) {
    console.error('Update campaign error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update campaign'
    });
  }
};

// Delete campaign
const deleteCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    const campaign = await Campaign.findById(campaignId);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }
    
    // Don't allow deleting active campaigns with usage (except templates)
    if (campaign.campaignScope !== 'TEMPLATE' && 
        campaign.status === 'ACTIVE' && 
        campaign.limits.usedCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete active campaign that has been used'
      });
    }
    
    await Campaign.findByIdAndDelete(campaignId);
    
    res.json({
      success: true,
      message: 'Campaign deleted successfully'
    });
  } catch (error) {
    console.error('Delete campaign error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete campaign'
    });
  }
};

// Approve/reject campaign
const approveCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { action, reason } = req.body; // action: 'approve' | 'reject'
    
    const campaign = await Campaign.findById(campaignId);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }
    
    if (campaign.status !== 'PENDING_APPROVAL') {
      return res.status(400).json({
        success: false,
        message: 'Campaign is not pending approval'
      });
    }
    
    if (action === 'approve') {
      campaign.status = 'ACTIVE';
      campaign.approvedBy = req.user._id;
      campaign.approvedAt = new Date();
    } else if (action === 'reject') {
      campaign.status = 'DRAFT';
      // You might want to add a rejection reason field
    }
    
    await campaign.save();
    
    res.json({
      success: true,
      message: `Campaign ${action}d successfully`,
      data: { campaign }
    });
  } catch (error) {
    console.error('Approve campaign error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process campaign approval'
    });
  }
};

// Pause/resume campaign
const toggleCampaignStatus = async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    const campaign = await Campaign.findById(campaignId);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }
    
    if (campaign.status === 'ACTIVE') {
      campaign.status = 'PAUSED';
    } else if (campaign.status === 'PAUSED') {
      campaign.status = 'ACTIVE';
    } else {
      return res.status(400).json({
        success: false,
        message: 'Campaign cannot be toggled from current status'
      });
    }
    
    await campaign.save();
    
    res.json({
      success: true,
      message: `Campaign ${campaign.status.toLowerCase()} successfully`,
      data: { campaign }
    });
  } catch (error) {
    console.error('Toggle campaign status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle campaign status'
    });
  }
};

// Get campaign analytics across all tenancies
const getCampaignAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, tenancyId, scope } = req.query;
    
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
      scopeFilter.campaignScope = scope;
    }
    
    // Build tenancy filter
    const tenancyFilter = {};
    if (tenancyId) {
      tenancyFilter.$or = [
        { tenancy: tenancyId },
        { applicableTenancies: tenancyId }
      ];
    }
    
    // Get overall campaign statistics
    const overallStats = await Campaign.aggregate([
      { $match: { ...dateFilter, ...scopeFilter, ...tenancyFilter } },
      {
        $group: {
          _id: '$campaignScope',
          totalCampaigns: { $sum: 1 },
          activeCampaigns: { $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0] } },
          totalBudgetSpent: { $sum: '$budget.spentAmount' },
          totalSavings: { $sum: '$analytics.totalSavings' },
          totalConversions: { $sum: '$analytics.conversions' },
          totalRevenue: { $sum: '$analytics.totalRevenue' },
          avgConversionRate: { $avg: '$analytics.conversions' }
        }
      }
    ]);
    
    // Get top performing campaigns
    const topCampaigns = await Campaign.find({
      ...dateFilter,
      ...scopeFilter,
      ...tenancyFilter,
      status: 'ACTIVE'
    })
    .sort({ 'analytics.conversions': -1 })
    .limit(10)
    .populate('tenancy', 'name slug')
    .select('name campaignScope analytics tenancy');
    
    // Get tenancy performance comparison
    const tenancyPerformance = await Campaign.aggregate([
      { 
        $match: { 
          campaignScope: { $in: ['TENANT', 'GLOBAL'] },
          ...dateFilter
        }
      },
      {
        $group: {
          _id: '$tenancy',
          campaignCount: { $sum: 1 },
          totalSavings: { $sum: '$analytics.totalSavings' },
          totalConversions: { $sum: '$analytics.conversions' },
          totalRevenue: { $sum: '$analytics.totalRevenue' }
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
      { $unwind: { path: '$tenancy', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          tenancyName: { $ifNull: ['$tenancy.name', 'Global Campaigns'] },
          tenancySlug: { $ifNull: ['$tenancy.slug', 'global'] },
          campaignCount: 1,
          totalSavings: 1,
          totalConversions: 1,
          totalRevenue: 1,
          avgSavingsPerCampaign: {
            $cond: [
              { $gt: ['$campaignCount', 0] },
              { $divide: ['$totalSavings', '$campaignCount'] },
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
      topCampaigns,
      tenancyPerformance
    };
    
    res.json({
      success: true,
      data: { analytics }
    });
  } catch (error) {
    console.error('Get campaign analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch campaign analytics'
    });
  }
};

// Get tenancies for selection
const getTenanciesForSelection = async (req, res) => {
  try {
    const tenancies = await Tenancy.find({ status: 'active' })
      .select('name slug domain subdomain')
      .sort({ name: 1 });
    
    res.json({
      success: true,
      data: { tenancies }
    });
  } catch (error) {
    console.error('Get tenancies error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tenancies'
    });
  }
};

module.exports = {
  getAllCampaigns,
  createGlobalCampaign,
  createTemplateCampaign,
  updateCampaign,
  deleteCampaign,
  approveCampaign,
  toggleCampaignStatus,
  getCampaignAnalytics,
  getTenanciesForSelection
};