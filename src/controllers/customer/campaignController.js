const Campaign = require('../../models/Campaign');

// Get active campaigns for customer
const getActiveCampaigns = async (req, res) => {
  try {
    const userId = req.user._id;
    const tenancyId = req.user.tenancy;
    const { page } = req.query; // HOME, SERVICES, CHECKOUT, etc.
    
    const now = new Date();
    
    // Get tenant campaigns
    const tenantCampaigns = await Campaign.find({
      tenancy: tenancyId,
      campaignScope: 'TENANT',
      status: 'ACTIVE',
      startDate: { $lte: now },
      endDate: { $gte: now }
    })
    .populate('promotions.promotionId')
    .sort({ priority: -1 });
    
    // Get global campaigns applicable to this tenancy
    const globalCampaigns = await Campaign.find({
      campaignScope: 'GLOBAL',
      status: 'ACTIVE',
      startDate: { $lte: now },
      endDate: { $gte: now },
      $or: [
        { applicableTenancies: tenancyId },
        { applicableTenancies: { $size: 0 } } // Empty array means all tenancies
      ]
    })
    .populate('promotions.promotionId')
    .sort({ priority: -1 });
    
    // Merge and sort by priority
    let allCampaigns = [...tenantCampaigns, ...globalCampaigns]
      .sort((a, b) => b.priority - a.priority);
    
    // Filter by page if specified
    if (page) {
      allCampaigns = allCampaigns.filter(campaign => {
        // Check if campaign has triggers for this page
        const triggers = campaign.triggers || [];
        return triggers.some(trigger => {
          if (page === 'HOME') return trigger.type === 'PAGE_VISIT';
          if (page === 'CHECKOUT') return trigger.type === 'ORDER_CHECKOUT';
          if (page === 'REGISTRATION') return trigger.type === 'USER_REGISTRATION';
          return true;
        });
      });
    }
    
    // Format for customer display
    const formattedCampaigns = allCampaigns.map(campaign => ({
      _id: campaign._id,
      name: campaign.name,
      description: campaign.description,
      campaignScope: campaign.campaignScope,
      priority: campaign.priority,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      promotions: campaign.promotions.map(p => ({
        type: p.type,
        promotionId: p.promotionId?._id,
        overrides: p.overrides
      })),
      audience: campaign.audience,
      triggers: campaign.triggers
    }));
    
    res.json({
      success: true,
      data: {
        campaigns: formattedCampaigns
      }
    });
  } catch (error) {
    console.error('Get active campaigns error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active campaigns'
    });
  }
};

// Get campaign details
const getCampaignDetails = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const tenancyId = req.user.tenancy;
    
    const campaign = await Campaign.findOne({
      _id: campaignId,
      status: 'ACTIVE',
      $or: [
        { tenancy: tenancyId, campaignScope: 'TENANT' },
        { campaignScope: 'GLOBAL', applicableTenancies: tenancyId },
        { campaignScope: 'GLOBAL', applicableTenancies: { $size: 0 } }
      ]
    }).populate('promotions.promotionId');
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        campaign: {
          _id: campaign._id,
          name: campaign.name,
          description: campaign.description,
          campaignScope: campaign.campaignScope,
          startDate: campaign.startDate,
          endDate: campaign.endDate,
          promotions: campaign.promotions,
          audience: campaign.audience,
          triggers: campaign.triggers,
          limits: campaign.limits
        }
      }
    });
  } catch (error) {
    console.error('Get campaign details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch campaign details'
    });
  }
};

// Claim campaign offer (if manual claim is required)
const claimCampaignOffer = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const userId = req.user._id;
    const tenancyId = req.user.tenancy;
    
    const campaign = await Campaign.findOne({
      _id: campaignId,
      status: 'ACTIVE',
      $or: [
        { tenancy: tenancyId, campaignScope: 'TENANT' },
        { campaignScope: 'GLOBAL', applicableTenancies: tenancyId },
        { campaignScope: 'GLOBAL', applicableTenancies: { $size: 0 } }
      ]
    });
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found or not available'
      });
    }
    
    // Check if user has already claimed
    const userClaims = campaign.limits?.userClaims || [];
    const existingClaim = userClaims.find(claim => 
      claim.userId.toString() === userId.toString()
    );
    
    if (existingClaim) {
      return res.status(400).json({
        success: false,
        message: 'You have already claimed this offer'
      });
    }
    
    // Check per-user limit
    if (campaign.limits?.perUserLimit > 0) {
      const userClaimCount = userClaims.filter(claim => 
        claim.userId.toString() === userId.toString()
      ).length;
      
      if (userClaimCount >= campaign.limits.perUserLimit) {
        return res.status(400).json({
          success: false,
          message: 'You have reached the claim limit for this campaign'
        });
      }
    }
    
    // Add claim
    if (!campaign.limits) campaign.limits = {};
    if (!campaign.limits.userClaims) campaign.limits.userClaims = [];
    
    campaign.limits.userClaims.push({
      userId,
      claimedAt: new Date()
    });
    
    await campaign.save();
    
    res.json({
      success: true,
      message: 'Campaign offer claimed successfully',
      data: {
        campaign: {
          _id: campaign._id,
          name: campaign.name,
          promotions: campaign.promotions
        }
      }
    });
  } catch (error) {
    console.error('Claim campaign offer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to claim campaign offer'
    });
  }
};

module.exports = {
  getActiveCampaigns,
  getCampaignDetails,
  claimCampaignOffer
};
